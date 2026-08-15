export type PlayerId = string;

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
