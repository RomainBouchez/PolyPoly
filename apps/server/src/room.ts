import { randomUUID } from 'node:crypto';
import {
  applyAction,
  createInitialState,
  createRng,
  getLegalActions,
  IllegalActionError,
  SQUAT_CARD_ID,
  type GameAction,
  type GameEvent,
  type GameState,
  type NewPlayerInfo,
  type Rng,
} from '@polypoly/engine';
import { DEFAULT_GAME_CONFIG, type GameConfig, type PlayerId, type PlayerIdentity, type RoomInfo, type RoomPhase } from '@polypoly/shared';

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];

/** Every GameAction except the server-only time-limit tick, which has no playerId. */
export type PlayerGameAction = Exclude<GameAction, { type: 'check-time-limit' }>;

interface SeatedPlayer {
  identity: PlayerIdentity;
  sessionToken: string;
  socketId: string | null;
}

export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  config: GameConfig;
  seed: number | null;
  startedAt: number | null;
  players: SeatedPlayer[];
  gameState: GameState | null;
}

export class Room {
  code = 'HOME';
  phase: RoomPhase = 'lobby';
  config: GameConfig = { ...DEFAULT_GAME_CONFIG };
  seed: number | null = null;
  startedAt: number | null = null;
  gameState: GameState | null = null;
  private rng: Rng | null = null;
  private players = new Map<PlayerId, SeatedPlayer>();

  toRoomInfo(): RoomInfo {
    return {
      code: this.code,
      phase: this.phase,
      players: [...this.players.values()].map((p) => p.identity),
    };
  }

  private nextColor(): string {
    const used = new Set([...this.players.values()].map((p) => p.identity.color));
    return COLORS.find((c) => !used.has(c)) ?? COLORS[this.players.size % COLORS.length]!;
  }

  /** Joins a new player, or — if playerId/sessionToken match a known seat —
   *  reconnects to it. Reconnecting is allowed at any room phase; joining
   *  fresh is only allowed in the lobby, before the seat count is locked in. */
  join(params: { name?: string; playerId?: PlayerId; sessionToken?: string }): { playerId: PlayerId; sessionToken: string } | { error: string } {
    if (params.playerId && params.sessionToken) {
      const existing = this.players.get(params.playerId);
      if (existing && existing.sessionToken === params.sessionToken) {
        existing.identity.connected = true;
        return { playerId: existing.identity.id, sessionToken: existing.sessionToken };
      }
      return { error: 'Session not recognized — join as a new player instead' };
    }

    if (this.phase !== 'lobby') return { error: 'Game already started — cannot join as a new player' };
    if (this.players.size >= this.config.maxPlayers) return { error: 'Room is full' };

    const playerId = randomUUID();
    const sessionToken = randomUUID();
    const seated: SeatedPlayer = {
      identity: {
        id: playerId,
        name: params.name?.trim() || `Player ${this.players.size + 1}`,
        token: sessionToken,
        color: this.nextColor(),
        isHost: this.players.size === 0,
        connected: true,
      },
      sessionToken,
      socketId: null,
    };
    this.players.set(playerId, seated);
    return { playerId, sessionToken };
  }

  bindSocket(playerId: PlayerId, socketId: string): void {
    const seated = this.players.get(playerId);
    if (seated) {
      seated.socketId = socketId;
      seated.identity.connected = true;
    }
  }

  /** Marks whoever owns this socket as disconnected. They keep their seat —
   *  reconnecting later with the same session token rebinds them. */
  handleDisconnect(socketId: string): PlayerId | null {
    for (const seated of this.players.values()) {
      if (seated.socketId === socketId) {
        seated.socketId = null;
        seated.identity.connected = false;
        return seated.identity.id;
      }
    }
    return null;
  }

  socketIdFor(playerId: PlayerId): string | null {
    return this.players.get(playerId)?.socketId ?? null;
  }

  allSocketIds(): string[] {
    return [...this.players.values()].map((p) => p.socketId).filter((id): id is string => id !== null);
  }

  updateConfig(playerId: PlayerId, patch: Partial<GameConfig>): void {
    this.requireHost(playerId);
    if (this.phase !== 'lobby') throw new IllegalActionError('Cannot change rules once the game has started');
    // Bots aren't implemented yet — force the toggle off regardless of what the client sends.
    this.config = { ...this.config, ...patch, allowBots: false };
  }

  start(playerId: PlayerId): void {
    this.requireHost(playerId);
    if (this.phase !== 'lobby') throw new IllegalActionError('Game already started');
    if (this.players.size < 2) throw new IllegalActionError('Need at least 2 players to start');

    const playerInfos: NewPlayerInfo[] = [...this.players.values()].map((p) => ({
      id: p.identity.id,
      name: p.identity.name,
      color: p.identity.color,
    }));
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.rng = createRng(this.seed);
    this.gameState = createInitialState(this.config, playerInfos, this.rng);
    this.phase = 'playing';
    this.startedAt = Date.now();
  }

  private requireHost(playerId: PlayerId): void {
    const seated = this.players.get(playerId);
    if (!seated?.identity.isHost) throw new IllegalActionError('Only the host can do that');
  }

  /** Ends whatever game is running and returns everyone to the lobby, keeping
   *  their seats — an admin escape hatch for a stuck or unwanted game. */
  resetToLobby(): void {
    this.phase = 'lobby';
    this.gameState = null;
    this.seed = null;
    this.startedAt = null;
  }

  /** Removes a player entirely, freeing their seat. Only allowed in the lobby
   *  — kicking mid-game would leave the engine's turn order pointing at a
   *  player Room no longer knows about. Returns the socket id to disconnect,
   *  if they were connected, and promotes a new host if the host was kicked. */
  kickPlayer(playerId: PlayerId): string | null {
    if (this.phase !== 'lobby') {
      throw new IllegalActionError('Reset the game before kicking a player');
    }
    const seated = this.players.get(playerId);
    if (!seated) throw new IllegalActionError('Player not found');

    this.players.delete(playerId);
    if (seated.identity.isHost) {
      const next = [...this.players.values()][0];
      if (next) next.identity.isHost = true;
    }
    return seated.socketId;
  }

  /** Applies a client action, trusting only the server-bound playerId for
   *  who is acting — never the client-supplied payload. */
  applyPlayerAction(boundPlayerId: PlayerId, action: PlayerGameAction): { events: GameEvent[] } {
    if (this.phase !== 'playing' || !this.gameState || !this.rng) {
      throw new IllegalActionError('No game in progress');
    }
    if (action.playerId !== boundPlayerId) {
      throw new IllegalActionError('You can only act as yourself');
    }
    return this.runAction(action);
  }

  /** Testing/dev helper for the host — grants a Squat charge directly,
   *  skipping the "land on Chance, draw the card" chain during a play session. */
  grantSquat(playerId: PlayerId, buildingLevel: number): GameEvent[] {
    if (this.phase !== 'playing' || !this.gameState) {
      throw new IllegalActionError('No game in progress');
    }
    if (!this.gameState.players[playerId]) throw new IllegalActionError('Player not found');
    if (![1, 2, 3, 5].includes(buildingLevel)) throw new IllegalActionError('Invalid building level');

    const next = structuredClone(this.gameState);
    next.heldSquatCards.push({ cardId: SQUAT_CARD_ID, deck: 'travel', playerId, buildingLevel });
    this.gameState = next;
    return [{ type: 'squat-granted', playerId, buildingLevel }];
  }

  /** Server-driven, not tied to any player — checked on a timer for time-limit games. */
  tickTimeLimit(elapsedMinutes: number): { events: GameEvent[] } {
    if (this.phase !== 'playing' || !this.gameState || !this.rng) return { events: [] };
    return this.runAction({ type: 'check-time-limit', elapsedMinutes });
  }

  private runAction(action: GameAction): { events: GameEvent[] } {
    const { state, events } = applyAction(this.gameState!, action, this.rng!);
    this.gameState = state;
    if (state.phase.type === 'game-over') this.phase = 'ended';
    return { events };
  }

  legalActionsFor(playerId: PlayerId): GameAction[] {
    if (!this.gameState) return [];
    return getLegalActions(this.gameState, playerId);
  }

  toSnapshot(): RoomSnapshot {
    return {
      code: this.code,
      phase: this.phase,
      config: this.config,
      seed: this.seed,
      startedAt: this.startedAt,
      players: [...this.players.values()],
      gameState: this.gameState,
    };
  }

  static fromSnapshot(snapshot: RoomSnapshot): Room {
    const room = new Room();
    room.code = snapshot.code;
    room.phase = snapshot.phase;
    // Merge over defaults so a snapshot saved before a new config field
    // existed (e.g. squatCards) still loads with a sane value instead of
    // undefined.
    room.config = { ...DEFAULT_GAME_CONFIG, ...snapshot.config };
    room.seed = snapshot.seed;
    room.startedAt = snapshot.startedAt;
    room.gameState = migrateGameState(snapshot.gameState);
    for (const seated of snapshot.players) {
      room.players.set(seated.identity.id, { ...seated, socketId: null, identity: { ...seated.identity, connected: false } });
    }
    // A restored rng does not replay from the original seed — it just needs to
    // keep producing fresh, fair rolls for the rest of this game.
    if (room.phase === 'playing') room.rng = createRng(Date.now() >>> 0);
    return room;
  }
}

/** Backfills fields added after this snapshot may have been saved (e.g. the
 *  Squat mechanic's heldSquatCards / squattedPlayerIds), so an in-progress
 *  game surviving a server restart doesn't crash on the first missing array. */
function migrateGameState(state: GameState | null): GameState | null {
  if (!state) return state;
  return {
    ...state,
    heldSquatCards: state.heldSquatCards ?? [],
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, { ...player, squattedPlayerIds: player.squattedPlayerIds ?? [] }]),
    ),
  };
}
