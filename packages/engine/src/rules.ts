import { airportTiles, getOwnableTile, getTile, groupTiles, utilityTiles } from './board.js';
import type { GameState, PlayerId } from './types.js';

export const JAIL_FINE = 50;
export const MAX_JAIL_TURNS = 3;
export const GO_SALARY = 200;

export const HEALTH_START = 50;
export const HEALTH_MAX = 100;
export const HEALTH_SICK_THRESHOLD = 20;
export const ILLNESS_PENALTY = 20;
export const ILLNESS_PENALTY_DOUBLE = 30;
export const HOSPITAL_PAYOUT = [25, 60, 150];
export const GO_HEALTH_BONUS = 5;
export const PHARMACY_RESET_HEALTH = 50;

const AIRPORT_RENT_BY_COUNT = [25, 50, 100, 200];

export function ownsFullGroup(state: GameState, ownerId: PlayerId, tileIndex: number): boolean {
  const tile = getTile(state.board, tileIndex);
  if (tile.kind !== 'property') return false;
  const siblings = groupTiles(state.board, tile.group);
  return siblings.every((sibling) => state.ownership[sibling.index]?.ownerId === ownerId);
}

function countOwned(state: GameState, ownerId: PlayerId, tiles: { index: number }[]): number {
  return tiles.filter((tile) => state.ownership[tile.index]?.ownerId === ownerId).length;
}

/** Rent owed on `tileIndex` right now, or 0 if unowned, self-owned, or mortgaged. */
export function computeRent(state: GameState, tileIndex: number, diceSum: number): number {
  const tile = getOwnableTile(state.board, tileIndex);
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.mortgaged) return 0;

  const owner = state.players[ownership.ownerId];
  if (!owner) return 0;
  if (state.config.noRentInPrison && owner.inJail) return 0;

  if (tile.kind === 'property') {
    let rent = tile.rentLadder[ownership.houses] ?? tile.rentLadder[0];
    if (ownership.houses === 0 && state.config.doubleRentOnFullSet && ownsFullGroup(state, owner.id, tileIndex)) {
      rent *= 2;
    }
    return rent;
  }

  if (tile.kind === 'airport') {
    const count = countOwned(state, owner.id, airportTiles(state.board));
    return AIRPORT_RENT_BY_COUNT[Math.min(count, 4) - 1] ?? 0;
  }

  // Hospitals never charge rent for landing on them — their only income is
  // the illness payout (see triggerIllness in applyAction.ts).
  if (tile.kind === 'hospital') return 0;

  // utility
  const count = countOwned(state, owner.id, utilityTiles(state.board));
  const multiplier = count >= 2 ? 10 : 4;
  return diceSum * multiplier;
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
