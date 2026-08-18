import { randomUUID } from 'node:crypto';
import {
  applyAction,
  createInitialState,
  createRng,
  getLegalActions,
  IllegalActionError,
  jailTileIndex,
  netWorth,
  SQUAT_CARD_ID,
  type GameAction,
  type GameEvent,
  type GameState,
  type LoggedEvent,
  type NewPlayerInfo,
  type Rng,
} from '@polypoly/engine';
import {
  COLOR_PALETTE,
  DEFAULT_GAME_CONFIG,
  type GameConfig,
  type NetWorthSnapshot,
  type PlayerId,
  type PlayerIdentity,
  type RoomInfo,
  type RoomPhase,
} from '@polypoly/shared';

/** Every GameAction except the server-only time-limit tick, which has no playerId. */
export type PlayerGameAction = Exclude<GameAction, { type: 'check-time-limit' }>;

/** Safety-valve only, not a routine limit — a real game runs on the order of
 *  1,500-2,500 events even in an extreme multi-hour session; this guards
 *  against a pathological loop, not anything a normal game approaches. */
const MATCH_LOG_CAP = 10_000;

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
  // Temporary, in-memory record of this game's events, for the end-of-game
  // stats screen — reset on every start() and never persisted, since it only
  // needs to survive one game, not a server restart. `matchLogTruncated`
  // flips once the safety-valve cap is hit, so the stats screen can honestly
  // flag incomplete data rather than silently under-report.
  private matchLog: LoggedEvent[] = [];
  private matchLogTruncated = false;
  // One entry per completed round — net worth doesn't appear on any single
  // event (it's cash plus property plus houses, all moving independently), so
  // it can't be derived from matchLog after the fact the way everything else
  // in the stats screen is. This has to be captured as it happens instead.
  private netWorthHistory: NetWorthSnapshot[] = [];
  private lastSnapshottedRound = 1;

  /** Tags each event with the round/turn number of the state it produced
   *  (read after the state has already advanced), so a future time-based
   *  stat is answerable without ever touching this recording code again. */
  private recordEvents(events: GameEvent[]): void {
    if (!this.gameState) return;
    const { roundNumber, turnNumber } = this.gameState;
    for (const event of events) {
      if (this.matchLog.length >= MATCH_LOG_CAP) {
        this.matchLogTruncated = true;
        return;
      }
      this.matchLog.push({ event, roundNumber, turnNumber });
    }
  }

  toRoomInfo(): RoomInfo {
    return {
      code: this.code,
      phase: this.phase,
      players: [...this.players.values()].map((p) => p.identity),
    };
  }

  /** Picks a colour for a new seat. Honours a requested colour if it is a
   *  real palette entry and still free; otherwise (no request, invalid
   *  request, or someone beat them to it) falls back to the first unused
   *  palette entry — the old auto-assign behaviour, which is what keeps an
   *  old client or an empty choice working. */
  private nextColor(requested?: string): string {
    const used = new Set([...this.players.values()].map((p) => p.identity.color));
    if (requested && (COLOR_PALETTE as readonly string[]).includes(requested) && !used.has(requested)) return requested;
    return COLOR_PALETTE.find((c) => !used.has(c)) ?? COLOR_PALETTE[this.players.size % COLOR_PALETTE.length]!;
  }

  /** Joins a new player, or — if playerId/sessionToken match a known seat —
   *  reconnects to it. Reconnecting is allowed at any room phase; joining
   *  fresh is only allowed in the lobby, before the seat count is locked in.
   *
   *  A mid-game exception: if someone joins with just a `name` (no token —
   *  e.g. they lost their stored session, or they're on a new device) and
   *  that name matches a seated player who is currently disconnected, they
   *  reclaim that seat instead of being turned away. This is a deliberately
   *  low-trust mechanism — knowing a disconnected player's name is enough to
   *  take their seat — acceptable for a LAN party game but worth knowing. */
  join(params: {
    name?: string;
    color?: string;
    playerId?: PlayerId;
    sessionToken?: string;
  }): { playerId: PlayerId; sessionToken: string } | { error: string } {
    if (params.playerId && params.sessionToken) {
      const existing = this.players.get(params.playerId);
      if (existing && existing.sessionToken === params.sessionToken) {
        existing.identity.connected = true;
        return { playerId: existing.identity.id, sessionToken: existing.sessionToken };
      }
      return { error: 'Session not recognized — join as a new player instead' };
    }

    if (this.phase !== 'lobby') {
      const reclaimed = this.reclaimDisconnectedSeat(params.name);
      if (reclaimed) return reclaimed;
      return { error: 'Game already started — cannot join as a new player' };
    }
    if (this.players.size >= this.config.maxPlayers) return { error: 'Room is full' };

    const playerId = randomUUID();
    const sessionToken = randomUUID();
    const seated: SeatedPlayer = {
      identity: {
        id: playerId,
        name: params.name?.trim() || `Player ${this.players.size + 1}`,
        color: this.nextColor(params.color),
        isHost: this.players.size === 0,
        connected: true,
      },
      sessionToken,
      socketId: null,
    };
    this.players.set(playerId, seated);
    return { playerId, sessionToken };
  }

  /** Finds a currently-disconnected seat whose name matches (trimmed,
   *  case-insensitive — it's re-typed by hand on a phone), rebinds it with a
   *  fresh session token, and marks it connected again. If more than one
   *  disconnected seat shares the name, the earliest-seated one wins (stable
   *  Map iteration order = join order) — arbitrary but deterministic. */
  private reclaimDisconnectedSeat(name: string | undefined): { playerId: PlayerId; sessionToken: string } | null {
    const normalized = name?.trim().toLowerCase();
    if (!normalized) return null;
    for (const seated of this.players.values()) {
      if (seated.identity.connected) continue;
      if (seated.identity.name.trim().toLowerCase() !== normalized) continue;
      const sessionToken = randomUUID();
      seated.sessionToken = sessionToken;
      seated.identity.connected = true;
      return { playerId: seated.identity.id, sessionToken };
    }
    return null;
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

  /** Lets a seated player pick their own colour while still in the lobby.
   *  Colour becomes fixed the moment the game starts, since it is baked into
   *  the board tokens and the activity history from then on.
   *
   *  No-duplicates is enforced here the same way `join` enforces it: the
   *  membership check and the write both happen synchronously within this
   *  one call, and Node never interleaves two socket handlers mid-function,
   *  so two players tapping the same swatch at once still resolve in order —
   *  whoever's request runs second sees the first player's colour as taken
   *  and gets rejected, never a silent overwrite. */
  setColor(playerId: PlayerId, color: string): void {
    if (this.phase !== 'lobby') throw new IllegalActionError('Cannot change colour once the game has started');
    const seated = this.players.get(playerId);
    if (!seated) throw new IllegalActionError('Player not found');
    if (!(COLOR_PALETTE as readonly string[]).includes(color)) throw new IllegalActionError('Not a valid colour');
    const takenByOther = [...this.players.values()].some((p) => p.identity.id !== playerId && p.identity.color === color);
    if (takenByOther) throw new IllegalActionError('That colour is already taken');
    seated.identity.color = color;
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
    this.matchLog = [];
    this.matchLogTruncated = false;
    this.lastSnapshottedRound = 1;
    // Round 1's baseline — everyone at their starting cash, nothing owned yet
    // — so the wealth chart has a real first point rather than starting blank
    // until the first round actually finishes.
    this.netWorthHistory = [{ roundNumber: 1, values: this.snapshotNetWorth(this.gameState) }];
  }

  private snapshotNetWorth(state: GameState): Record<PlayerId, number> {
    return Object.fromEntries(state.turnOrder.map((id) => [id, netWorth(state, id)]));
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
    const events: GameEvent[] = [{ type: 'squat-granted', playerId, buildingLevel }];
    this.recordEvents(events);
    return events;
  }

  /** Testing/dev helper for the host — jails a player outright, which is the
   *  only way into the hostage flow without waiting to land on Go To Jail. */
  sendToJail(playerId: PlayerId): GameEvent[] {
    if (this.phase !== 'playing' || !this.gameState) {
      throw new IllegalActionError('No game in progress');
    }
    const player = this.gameState.players[playerId];
    if (!player) throw new IllegalActionError('Player not found');
    if (player.status !== 'active') throw new IllegalActionError('That player is out of the game');

    const next = structuredClone(this.gameState);
    const target = next.players[playerId]!;
    target.position = jailTileIndex(next.board);
    target.inJail = true;
    target.jailTurns = 0;
    // Straight to the jail decision when it is their turn, so the hostage
    // option is reachable on the very next action rather than a turn later.
    if (next.turnOrder[next.currentPlayerIndex] === playerId) {
      next.phase = { type: 'awaiting-jail-decision', playerId };
    }
    this.gameState = next;
    const events: GameEvent[] = [{ type: 'sent-to-jail', playerId, reason: 'card' }];
    this.recordEvents(events);
    return events;
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
    this.recordEvents(events);
    // A snapshot per completed round, not per action — an action only ever
    // advances the round number by at most one, so this fires at most once
    // per call.
    if (state.roundNumber !== this.lastSnapshottedRound) {
      this.lastSnapshottedRound = state.roundNumber;
      this.netWorthHistory.push({ roundNumber: state.roundNumber, values: this.snapshotNetWorth(state) });
    } else if (state.phase.type === 'game-over') {
      // A cascade of bankruptcies can end the game mid-round, before the
      // round boundary above ever fires — without this the chart's last
      // point would lag one round behind the standings shown next to it.
      const values = this.snapshotNetWorth(state);
      const lastSnapshot = this.netWorthHistory[this.netWorthHistory.length - 1];
      if (lastSnapshot && lastSnapshot.roundNumber === state.roundNumber) lastSnapshot.values = values;
      else this.netWorthHistory.push({ roundNumber: state.roundNumber, values });
    }
    return { events };
  }

  legalActionsFor(playerId: PlayerId): GameAction[] {
    if (!this.gameState) return [];
    return getLegalActions(this.gameState, playerId);
  }

  /** For the end-of-game stats screen. `logComplete` is false once the
   *  safety-valve cap has been hit at any point this game — the caller
   *  should present figures that depend on full coverage (e.g. total turns
   *  served in jail) as a caveated estimate rather than an exact count. */
  getMatchLog(): { log: LoggedEvent[]; logComplete: boolean; netWorthHistory: NetWorthSnapshot[] } {
    return { log: this.matchLog, logComplete: !this.matchLogTruncated, netWorthHistory: this.netWorthHistory };
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
    // The engine reads the config off the game state, not off the room, so a
    // flag added after a game started would sit undefined here and read as
    // off — silently disabling a rule for the rest of that game.
    config: { ...DEFAULT_GAME_CONFIG, ...state.config },
    heldSquatCards: state.heldSquatCards ?? [],
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, { ...player, squattedPlayerIds: player.squattedPlayerIds ?? [] }]),
    ),
  };
}
