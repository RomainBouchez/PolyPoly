export type PropertyGroup =
  | 'portugal' | 'greece' | 'norway' | 'netherlands'
  | 'spain' | 'italy' | 'uk' | 'france';

export interface HealthEffect {
  cashDelta: number;
  healthDelta: number;
  /** Resets health to 50 instead of applying healthDelta, once per player per game. */
  pharmacy?: boolean;
}

export interface PropertyTile {
  kind: 'property';
  index: number;
  group: PropertyGroup;
  name: string;
  emoji: string;
  price: number;
  /** Base rent, then rent with 1..4 houses, then rent with a hotel. Length 6. */
  rentLadder: [number, number, number, number, number, number];
  houseCost: number;
  mortgageValue: number;
  /** Only present in health-mode games; see packages/engine/src/rules.ts. */
  healthEffect?: HealthEffect;
}

export interface AirportTile {
  kind: 'airport';
  index: number;
  name: string;
  price: number;
  mortgageValue: number;
}

export interface UtilityTile {
  kind: 'utility';
  index: number;
  name: string;
  price: number;
  mortgageValue: number;
}

/** Ownable like an airport, but never charges rent for landing on it — its
 *  only income is the illness payout when someone rolls double-1. */
export interface HospitalTile {
  kind: 'hospital';
  index: number;
  name: string;
  price: number;
  mortgageValue: number;
}

export interface TaxTile {
  kind: 'tax';
  index: number;
  name: string;
  amount: number;
}

export interface CardTile {
  kind: 'card';
  index: number;
  deck: 'travel' | 'customs';
}

export interface CornerTile {
  kind: 'go' | 'jail' | 'vacation' | 'go-to-jail';
  index: number;
  name: string;
}

/** Landing here fines the player if their health is below the emergency
 *  threshold (only meaningful in health-mode games); see rules.ts. */
export interface EmergencyTile {
  kind: 'emergency';
  index: number;
  name: string;
}

/** The inverse of a rainy day — landing here while it's raining cuts the
 *  rain short and starts a few turns of halved rent instead. Landing here
 *  while it isn't raining does nothing; see rules.ts. */
export interface SunnyTile {
  kind: 'sunny';
  index: number;
  name: string;
}

export type Tile =
  | PropertyTile
  | AirportTile
  | UtilityTile
  | HospitalTile
  | TaxTile
  | CardTile
  | CornerTile
  | EmergencyTile
  | SunnyTile;

export interface Board {
  tiles: Tile[];
}

export type OwnableTile = PropertyTile | AirportTile | UtilityTile | HospitalTile;

export function isOwnable(tile: Tile): tile is OwnableTile {
  return tile.kind === 'property' || tile.kind === 'airport' || tile.kind === 'utility' || tile.kind === 'hospital';
}
