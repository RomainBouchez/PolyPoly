export type PlayerId = string;

export interface PlayerIdentity {
  id: PlayerId;
  name: string;
  token: string;
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
