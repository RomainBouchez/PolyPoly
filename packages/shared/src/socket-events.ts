import type { GameConfig } from './config.js';
import type { NetWorthSnapshot, PlayerId, RoomInfo } from './room.js';

export interface JoinPayload {
  roomCode: string;
  name?: string;
  /** Requested seat colour, from COLOR_PALETTE. Optional — an old client or
   *  an empty choice still gets a seat via the server's auto-assign. Ignored
   *  entirely on reconnect/reclaim, which keep whatever colour the seat
   *  already had. */
  color?: string;
  /** Present on reconnect: rebinds to the existing seat instead of creating a new one. */
  playerId?: PlayerId;
  sessionToken?: string;
}

export interface JoinAck {
  ok: true;
  playerId: PlayerId;
  sessionToken: string;
  room: RoomInfo;
}

export interface JoinError {
  ok: false;
  reason: string;
}

export interface ClientToServerEvents {
  join: (payload: JoinPayload, ack: (result: JoinAck | JoinError) => void) => void;
  /** Lobby-only: change the caller's own seat colour. Once the game starts,
   *  colour is baked into the board and the activity history. */
  'player:set-color': (color: string, ack: (result: { ok: boolean; reason?: string }) => void) => void;
  'config:update': (config: Partial<GameConfig>) => void;
  'game:start': () => void;
  /** Generic game action envelope; the engine's GameAction union is the real payload shape. */
  'game:action': (action: unknown, ack: (result: { ok: boolean; reason?: string }) => void) => void;
  /** Admin controls — no auth beyond being on the LAN, matching the rest of this app. */
  'admin:reset': (ack: (result: { ok: boolean; reason?: string }) => void) => void;
  'admin:kick': (playerId: PlayerId, ack: (result: { ok: boolean; reason?: string }) => void) => void;
  /** Testing helper: grants a Squat charge directly, skipping the "land on
   *  Chance, draw the card" chain. buildingLevel is 1, 2, 3, or 5 (hotel). */
  'admin:grant-squat': (playerId: PlayerId, buildingLevel: number, ack: (result: { ok: boolean; reason?: string }) => void) => void;
  'admin:send-to-jail': (playerId: PlayerId, ack: (result: { ok: boolean; reason?: string }) => void) => void;
  /** Full event history for the just-ended (or in-progress) game, for the
   *  match-stats screen. `log` is an engine `LoggedEvent[]`, kept as
   *  `unknown` here the same way 'game:state' does — shared has no
   *  dependency on the engine package. `netWorthHistory` needs no such
   *  workaround — its shape is pure primitives, defined in this package. */
  'game:match-log': (
    ack: (
      result:
        | { ok: true; log: unknown[]; logComplete: boolean; netWorthHistory: NetWorthSnapshot[] }
        | { ok: false; reason: string },
    ) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'room:update': (room: RoomInfo, config: GameConfig) => void;
  'game:state': (state: unknown, events: unknown[]) => void;
  'error': (message: string) => void;
}
