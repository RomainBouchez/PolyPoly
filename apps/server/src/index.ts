import { networkInterfaces } from 'node:os';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { IllegalActionError } from '@polypoly/engine';
import type { ClientToServerEvents, PlayerId, ServerToClientEvents } from '@polypoly/shared';
import { loadSnapshot, saveSnapshot } from './persistence.js';
import { Room, type PlayerGameAction } from './room.js';

const PORT = Number(process.env.PORT ?? 4000);
const __dirname = dirname(fileURLToPath(import.meta.url));

const snapshot = loadSnapshot();
const room = snapshot ? Room.fromSnapshot(snapshot) : new Room();

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));

const webDist = join(__dirname, '../../web/dist');
app.use(express.static(webDist));
app.get('*', (_req, res) => res.sendFile(join(webDist, 'index.html')));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

function persist(): void {
  saveSnapshot(room.toSnapshot());
}

function broadcastRoomUpdate(): void {
  io.emit('room:update', room.toRoomInfo(), room.config);
}

function broadcastGameState(events: unknown[]): void {
  if (room.gameState) io.emit('game:state', room.gameState, events);
}

function errorMessage(err: unknown): string {
  return err instanceof IllegalActionError || err instanceof Error ? err.message : 'Unknown error';
}

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  let boundPlayerId: PlayerId | null = null;

  // Sent immediately so pages that never join — the shared board display,
  // the admin page — still see current state without a join round-trip.
  socket.emit('room:update', room.toRoomInfo(), room.config);
  if (room.gameState) socket.emit('game:state', room.gameState, []);

  socket.on('join', (payload, ack) => {
    const result = room.join(payload);
    if ('error' in result) {
      ack({ ok: false, reason: result.error });
      return;
    }
    boundPlayerId = result.playerId;
    room.bindSocket(result.playerId, socket.id);
    ack({ ok: true, playerId: result.playerId, sessionToken: result.sessionToken, room: room.toRoomInfo() });
    if (room.gameState) socket.emit('game:state', room.gameState, []);
    broadcastRoomUpdate();
  });

  socket.on('player:set-color', (color, ack) => {
    if (!boundPlayerId) {
      ack({ ok: false, reason: 'Not joined' });
      return;
    }
    try {
      room.setColor(boundPlayerId, color);
      broadcastRoomUpdate();
      persist();
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, reason: errorMessage(err) });
    }
  });

  socket.on('config:update', (patch) => {
    if (!boundPlayerId) return;
    try {
      room.updateConfig(boundPlayerId, patch);
      broadcastRoomUpdate();
    } catch (err) {
      socket.emit('error', errorMessage(err));
    }
  });

  socket.on('game:start', () => {
    if (!boundPlayerId) return;
    try {
      room.start(boundPlayerId);
      broadcastRoomUpdate();
      broadcastGameState([]);
      persist();
    } catch (err) {
      socket.emit('error', errorMessage(err));
    }
  });

  socket.on('game:action', (action, ack) => {
    if (!boundPlayerId) {
      ack({ ok: false, reason: 'Not joined' });
      return;
    }
    try {
      const { events } = room.applyPlayerAction(boundPlayerId, action as PlayerGameAction);
      broadcastGameState(events);
      persist();
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, reason: errorMessage(err) });
    }
  });

  socket.on('admin:reset', (ack) => {
    room.resetToLobby();
    broadcastRoomUpdate();
    persist();
    ack({ ok: true });
  });

  socket.on('admin:kick', (playerId, ack) => {
    try {
      const kickedSocketId = room.kickPlayer(playerId);
      if (kickedSocketId) io.sockets.sockets.get(kickedSocketId)?.disconnect(true);
      broadcastRoomUpdate();
      persist();
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, reason: errorMessage(err) });
    }
  });

  socket.on('admin:grant-squat', (playerId, buildingLevel, ack) => {
    try {
      const events = room.grantSquat(playerId, buildingLevel);
      broadcastGameState(events);
      persist();
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, reason: errorMessage(err) });
    }
  });

  socket.on('admin:send-to-jail', (playerId, ack) => {
    try {
      const events = room.sendToJail(playerId);
      broadcastGameState(events);
      persist();
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, reason: errorMessage(err) });
    }
  });

  socket.on('game:match-log', (ack) => {
    if (room.phase !== 'playing' && room.phase !== 'ended') {
      ack({ ok: false, reason: 'No game in progress' });
      return;
    }
    const { log, logComplete, netWorthHistory } = room.getMatchLog();
    ack({ ok: true, log, logComplete, netWorthHistory });
  });

  socket.on('disconnect', () => {
    const playerId = room.handleDisconnect(socket.id);
    if (playerId) broadcastRoomUpdate();
  });
});

setInterval(() => {
  if (room.phase !== 'playing' || room.config.endCondition.type !== 'time-limit' || !room.startedAt) return;
  const elapsedMinutes = (Date.now() - room.startedAt) / 60_000;
  const { events } = room.tickTimeLimit(elapsedMinutes);
  if (events.length > 0) {
    broadcastGameState(events);
    persist();
  }
}, 30_000);

const SKIPPED_INTERFACE_NAME = /tailscale|vethernet|virtualbox|docker|wsl/i;
const SKIPPED_ADDRESS_PREFIX = ['192.168.56.']; // VirtualBox host-only default range
const WIFI_INTERFACE_NAME = /wi-?fi|wlan/i;

function lanUrl(): string {
  const candidates: { name: string; ip: string }[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (SKIPPED_INTERFACE_NAME.test(name)) continue;
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (SKIPPED_ADDRESS_PREFIX.some((p) => addr.address.startsWith(p))) continue;
      candidates.push({ name, ip: addr.address });
    }
  }
  // Prefer the actual wifi adapter, since that's what a phone on the same
  // network will be reachable through — other private ranges tend to belong
  // to VPNs or virtual adapters that only this machine can see.
  const wifi = candidates.find((c) => WIFI_INTERFACE_NAME.test(c.name));
  const home = candidates.find((c) => c.ip.startsWith('192.168.'));
  return `http://${wifi?.ip ?? home?.ip ?? candidates[0]?.ip ?? 'localhost'}:${PORT}`;
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`PolyPoly server listening on ${lanUrl()}`);
});
