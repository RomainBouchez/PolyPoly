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

export interface RoomInfo {
  code: string;
  phase: RoomPhase;
  players: PlayerIdentity[];
}
