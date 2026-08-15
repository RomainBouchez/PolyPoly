export interface GameConfig {
  /** Room is only reachable via its URL. Stored, has no effect while there is one room. */
  privateRoom: boolean;
  /** Bots fill empty seats. Not implemented in V1 — always false, UI keeps the toggle disabled. */
  allowBots: boolean;
  /** Owning every property in a colour group doubles the base rent. */
  doubleRentOnFullSet: boolean;
  /** All tax and bank payments accumulate on the Vacation tile; landing on it collects the pot. */
  vacationCash: boolean;
  /** Skipping a purchase sends the property to auction among the other players. */
  auction: boolean;
  /** Rent is not collected on properties owned by a player currently in jail. */
  noRentInPrison: boolean;
  /** Properties can be mortgaged for 50% of their price; mortgaged properties earn no rent. */
  mortgage: boolean;
  /** Houses/hotels within a colour group must be built and sold off evenly. */
  evenBuild: boolean;
  /** Bank holds only 32 houses and 12 hotels; building can stall on scarcity. */
  limitedHouseSupply: boolean;
  /** Health economy: certain tiles cost/restore health, rolling 1-1 makes you
   *  sick and forces a payout to hospital owners, and being sick blocks the
   *  Go cash bonus. */
  healthMode: boolean;
  /** A "form alliance" card lets two players share halved rent between each
   *  other, and (with healthMode also on) transfer health, for 3 turns. */
  allianceMode: boolean;
  /** At a random turn early in the game, rent everywhere doubles for 1-2 turns. */
  rainyDay: boolean;
  /** While in jail, a player may take one opponent's property hostage —
   *  voiding its rent — until they get out of jail. */
  hostageMode: boolean;
  /** Chance/Community cards can grant a Squat pass — skip paying rent once
   *  on a property matching a randomly assigned building level, but never
   *  twice against the same opponent. Blocked while sick (health mode). */
  squatCards: boolean;

  maxPlayers: number;
  startingCash: number;

  endCondition: EndCondition;
}

export type EndCondition =
  | { type: 'last-standing' }
  | { type: 'turn-limit'; turns: number }
  | { type: 'time-limit'; minutes: number };

export const DEFAULT_GAME_CONFIG: GameConfig = {
  privateRoom: false,
  allowBots: false,
  doubleRentOnFullSet: true,
  vacationCash: false,
  auction: true,
  noRentInPrison: false,
  mortgage: true,
  evenBuild: true,
  limitedHouseSupply: false,
  healthMode: false,
  allianceMode: false,
  rainyDay: false,
  hostageMode: false,
  squatCards: true,
  maxPlayers: 8,
  startingCash: 1500,
  endCondition: { type: 'last-standing' },
};
