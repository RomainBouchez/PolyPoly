import type { GameConfig } from './config.js';
import type { PlayerId, RoomInfo } from './room.js';

export interface JoinPayload {
  roomCode: string;
  name?: string;
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
}

export interface ServerToClientEvents {
  'room:update': (room: RoomInfo, config: GameConfig) => void;
  'game:state': (state: unknown, events: unknown[]) => void;
  'error': (message: string) => void;
}
