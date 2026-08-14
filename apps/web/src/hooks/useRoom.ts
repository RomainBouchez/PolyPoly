import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction, GameEvent, GameState } from '@polypoly/engine';
import type { GameConfig, PlayerId, RoomInfo } from '@polypoly/shared';
import { socket } from '../socket.js';
import { clearSession, loadSession, saveSession } from '../session.js';

const MAX_EVENT_LOG = 200;

export interface RoomHandle {
  connected: boolean;
  joined: boolean;
  room: RoomInfo | null;
  config: GameConfig | null;
  gameState: GameState | null;
  events: GameEvent[];
  myPlayerId: PlayerId | null;
  error: string | null;
  joinAsNew: (name: string) => void;
  updateConfig: (patch: Partial<GameConfig>) => void;
  startGame: () => void;
  sendAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}

export function useRoom(): RoomHandle {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptedAutoJoin = useRef(false);

  const doJoin = useCallback((payload: { name?: string; playerId?: string; sessionToken?: string }) => {
    socket.emit('join', { roomCode: 'HOME', ...payload }, (result) => {
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setMyPlayerId(result.playerId);
      setRoom(result.room);
      saveSession({ playerId: result.playerId, sessionToken: result.sessionToken });
      setError(null);
    });
  }, []);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      if (!attemptedAutoJoin.current) {
        attemptedAutoJoin.current = true;
        const saved = loadSession();
        if (saved) doJoin(saved);
      }
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onRoomUpdate(nextRoom: RoomInfo, nextConfig: GameConfig) {
      setRoom(nextRoom);
      setConfig(nextConfig);
    }
    function onGameState(state: unknown, newEvents: unknown) {
      setGameState(state as GameState);
      const batch = newEvents as GameEvent[];
      if (batch.length > 0) {
        setEvents((prev) => [...prev, ...batch].slice(-MAX_EVENT_LOG));
      }
    }
    function onError(message: string) {
      setError(message);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:update', onRoomUpdate);
    socket.on('game:state', onGameState);
    socket.on('error', onError);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:update', onRoomUpdate);
      socket.off('game:state', onGameState);
      socket.off('error', onError);
    };
  }, [doJoin]);

  const joinAsNew = useCallback(
    (name: string) => {
      clearSession();
      doJoin({ name });
    },
    [doJoin],
  );

  const updateConfig = useCallback((patch: Partial<GameConfig>) => {
    socket.emit('config:update', patch);
  }, []);

  const startGame = useCallback(() => {
    socket.emit('game:start');
  }, []);

  const sendAction = useCallback((action: GameAction) => {
    return new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      socket.emit('game:action', action, resolve);
    });
  }, []);

  return {
    connected,
    joined: myPlayerId !== null,
    room,
    config,
    gameState,
    events,
    myPlayerId,
    error,
    joinAsNew,
    updateConfig,
    startGame,
    sendAction,
  };
}
