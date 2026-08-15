import { airportTiles, getOwnableTile, getTile, groupTiles, utilityTiles } from './board.js';
import type { GameState, PlayerId } from './types.js';

export const JAIL_FINE = 50;
export const MAX_JAIL_TURNS = 3;
export const GO_SALARY = 200;
/** Being sick used to void the Go salary outright, which left a sick player
 *  with no way to fund the very things that cure them. They now collect a
 *  reduced salary instead of nothing. */
export const GO_SALARY_SICK = 100;

export const HEALTH_START = 50;
export const HEALTH_MAX = 100;
export const HEALTH_SICK_THRESHOLD = 20;
export const ILLNESS_PENALTY = 20;
export const ILLNESS_PENALTY_DOUBLE = 30;
/** Paid to each hospital owner on a 1-1 roll, indexed by how many hospitals
 *  that owner holds. The top rate was 150 — with one player holding all three
 *  hospitals that is a punishing hit on a ~2.8% roll, so the curve is flatter
 *  now: owning the set is still clearly worth it without being crushing. */
export const HOSPITAL_PAYOUT = [25, 50, 90];
export const GO_HEALTH_BONUS = 5;
/** Health lost for each turn spent sitting in jail, so jail costs more than
 *  tempo. Capped in practice by MAX_JAIL_TURNS — 9 health over a full stay,
 *  under half an illness, so it only tips a player into the sick zone if they
 *  were already close to it. */
export const JAIL_HEALTH_DRAIN = 3;
export const PHARMACY_RESET_HEALTH = 50;

export const ALLIANCE_DURATION_TURNS = 3;
/** Rent paid between two allied players is cut to this fraction. */
export const ALLIANCE_RENT_MULTIPLIER = 0.5;

/** Rainy day triggers at a random turn number in this inclusive window,
 *  chosen once at game creation, then lasts a random 1-2 turns. */
export const RAINY_DAY_TRIGGER_MIN = 3;
export const RAINY_DAY_TRIGGER_MAX = 10;

/** Landing on the 'sunny' tile while it's raining cuts the rain short and
 *  starts a random 1-2 turns of halved rent instead. */
export const SUNNY_DAY_DURATION_MIN = 1;
export const SUNNY_DAY_DURATION_MAX = 2;
export const SUNNY_DAY_RENT_MULTIPLIER = 0.5;

/** Landing on the 'emergency' tile below this health fines the player —
 *  above it, nothing happens. Only meaningful in health-mode games. */
export const EMERGENCY_HEALTH_THRESHOLD = 30;
export const EMERGENCY_FINE = 150;

export const AIRPORT_RENT_BY_COUNT = [25, 50, 100, 200];
export const UTILITY_RENT_MULTIPLIER_ONE = 4;
export const UTILITY_RENT_MULTIPLIER_BOTH = 10;

export function ownsFullGroup(state: GameState, ownerId: PlayerId, tileIndex: number): boolean {
  const tile = getTile(state.board, tileIndex);
  if (tile.kind !== 'property') return false;
  const siblings = groupTiles(state.board, tile.group);
  return siblings.every((sibling) => state.ownership[sibling.index]?.ownerId === ownerId);
}

function countOwned(state: GameState, ownerId: PlayerId, tiles: { index: number }[]): number {
  return tiles.filter((tile) => state.ownership[tile.index]?.ownerId === ownerId).length;
}

/** Rent owed on `tileIndex` right now, or 0 if unowned, self-owned, or mortgaged.
 *  Does not account for the alliance rent discount — that's applied by the
 *  caller in applyAction.ts, since it depends on who's paying, not just the
 *  tile/owner (see isAllied below). */
export function computeRent(state: GameState, tileIndex: number, diceSum: number): number {
  const tile = getOwnableTile(state.board, tileIndex);
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.mortgaged) return 0;

  const owner = state.players[ownership.ownerId];
  if (!owner) return 0;
  if (state.config.noRentInPrison && owner.inJail) return 0;
  if (state.hostage && state.hostage.tileIndex === tileIndex && state.hostage.ownerId === ownership.ownerId) return 0;

  let rent: number;
  if (tile.kind === 'property') {
    rent = tile.rentLadder[ownership.houses] ?? tile.rentLadder[0];
    if (ownership.houses === 0 && state.config.doubleRentOnFullSet && ownsFullGroup(state, owner.id, tileIndex)) {
      rent *= 2;
    }
  } else if (tile.kind === 'airport') {
    const count = countOwned(state, owner.id, airportTiles(state.board));
    rent = AIRPORT_RENT_BY_COUNT[Math.min(count, 4) - 1] ?? 0;
  } else if (tile.kind === 'hospital') {
    // Hospitals never charge rent for landing on them — their only income is
    // the illness payout (see triggerIllness in applyAction.ts).
    return 0;
  } else {
    // utility
    const count = countOwned(state, owner.id, utilityTiles(state.board));
    const multiplier = count >= 2 ? UTILITY_RENT_MULTIPLIER_BOTH : UTILITY_RENT_MULTIPLIER_ONE;
    rent = diceSum * multiplier;
  }

  if (state.config.rainyDay && state.rainyDay.turnsRemaining > 0) {
    rent *= 2;
  } else if (state.config.rainyDay && state.sunnyDay.turnsRemaining > 0) {
    rent = Math.round(rent * SUNNY_DAY_RENT_MULTIPLIER);
  }
  return rent;
}

/** Whether two players currently share an active temporary alliance. */
export function isAllied(state: GameState, aId: PlayerId, bId: PlayerId): boolean {
  return state.alliances.some((a) => a.players.includes(aId) && a.players.includes(bId));
}

export function netWorth(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  if (!player) return 0;
  let total = player.cash;
  for (const [tileIndexStr, ownership] of Object.entries(state.ownership)) {
    if (ownership.ownerId !== playerId) continue;
    const tile = getOwnableTile(state.board, Number(tileIndexStr));
    total += ownership.mortgaged ? tile.mortgageValue : tile.price;
    if (tile.kind === 'property') {
      total += ownership.houses * tile.houseCost;
    }
  }
  return total;
}
