import { groupTiles } from './board.js';
import { IllegalActionError } from './errors.js';
import { ownsFullGroup } from './rules.js';
import type { GameState, PlayerId } from './types.js';

export const HOUSES_PER_HOTEL = 4;
export const HOTEL_LEVEL = 5;

function requireBuildablePropertyGroup(state: GameState, playerId: PlayerId, tileIndex: number) {
  const tile = state.board.tiles[tileIndex];
  if (!tile || tile.kind !== 'property') throw new IllegalActionError('Only properties can have houses');
  if (!ownsFullGroup(state, playerId, tileIndex)) {
    throw new IllegalActionError('You must own every property in the colour set to build');
  }
  const siblings = groupTiles(state.board, tile.group);
  if (siblings.some((sibling) => state.ownership[sibling.index]?.mortgaged)) {
    throw new IllegalActionError('Cannot build while a property in the set is mortgaged');
  }
  return { tile, siblings };
}

export function buildHouse(state: GameState, playerId: PlayerId, tileIndex: number): number {
  const { tile, siblings } = requireBuildablePropertyGroup(state, playerId, tileIndex);
  const ownership = state.ownership[tileIndex]!;
  if (ownership.houses >= HOTEL_LEVEL) throw new IllegalActionError('This property already has a hotel');

  if (state.config.evenBuild) {
    const minHouses = Math.min(...siblings.map((s) => state.ownership[s.index]!.houses));
    if (ownership.houses > minHouses) {
      throw new IllegalActionError('Even build: build on the lowest property in the set first');
    }
  }

  const player = state.players[playerId]!;
  if (player.cash < tile.houseCost) throw new IllegalActionError('Not enough cash to build');

  const becomingHotel = ownership.houses === HOUSES_PER_HOTEL;
  if (state.config.limitedHouseSupply) {
    if (becomingHotel && state.bank.hotelsRemaining <= 0) {
      throw new IllegalActionError('No hotels left in the bank');
    }
    if (!becomingHotel && state.bank.housesRemaining <= 0) {
      throw new IllegalActionError('No houses left in the bank');
    }
  }

  player.cash -= tile.houseCost;
  if (becomingHotel) {
    ownership.houses = HOTEL_LEVEL;
    state.bank.housesRemaining += HOUSES_PER_HOTEL;
    state.bank.hotelsRemaining -= 1;
  } else {
    ownership.houses += 1;
    state.bank.housesRemaining -= 1;
  }
  return ownership.houses;
}

export function sellHouse(state: GameState, playerId: PlayerId, tileIndex: number): number {
  const tile = state.board.tiles[tileIndex];
  if (!tile || tile.kind !== 'property') throw new IllegalActionError('Only properties can have houses');
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.ownerId !== playerId) throw new IllegalActionError('You do not own this property');
  if (ownership.houses <= 0) throw new IllegalActionError('This property has no houses to sell');

  if (state.config.evenBuild) {
    const siblings = groupTiles(state.board, tile.group);
    const maxHouses = Math.max(...siblings.map((s) => state.ownership[s.index]?.houses ?? 0));
    if (ownership.houses < maxHouses) {
      throw new IllegalActionError('Even build: sell from the highest property in the set first');
    }
  }

  const wasHotel = ownership.houses === HOTEL_LEVEL;
  if (state.config.limitedHouseSupply && wasHotel && state.bank.housesRemaining < HOUSES_PER_HOTEL) {
    throw new IllegalActionError('Not enough houses in the bank to break this hotel');
  }

  const player = state.players[playerId]!;
  player.cash += tile.houseCost / 2;
  if (wasHotel) {
    ownership.houses = HOUSES_PER_HOTEL;
    state.bank.housesRemaining -= HOUSES_PER_HOTEL;
    state.bank.hotelsRemaining += 1;
  } else {
    ownership.houses -= 1;
    state.bank.housesRemaining += 1;
  }
  return ownership.houses;
}
