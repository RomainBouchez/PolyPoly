export type PlayerId = string;

/** The full set of colours a seat can take. Shared between server (which
 *  enforces it) and client (which renders it as swatches) so they can never
 *  drift apart. Sized to match the 8-seat maxPlayers cap in config.ts. */
export const COLOR_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6', '#ec4899'] as const;

/** Broadcast to every client in `RoomInfo`, so it must hold nothing secret.
 *  The seat's session token deliberately lives only on the server (and in the
 *  owning client's own storage) — it used to be duplicated here and shipped to
 *  everyone, which handed every player the credentials to any other seat. */
export interface PlayerIdentity {
  id: PlayerId;
  name: string;
  color: string;
  isHost: boolean;
  connected: boolean;
}

export type RoomPhase = 'lobby' | 'playing' | 'ended';

/** Each active player's net worth at the close of one round, for the
 *  end-of-game wealth-over-time chart. Lives here rather than in the engine
 *  because the shape is pure primitives (a round number, a PlayerId->number
 *  map) — no GameEvent/GameState type is needed to describe it, so it costs
 *  nothing to give the client a precise type instead of the `unknown` the
 *  match log itself has to fall back to. */
export interface NetWorthSnapshot {
  roundNumber: number;
  values: Record<PlayerId, number>;
}

export interface RoomInfo {
  code: string;
  phase: RoomPhase;
  players: PlayerIdentity[];
}
