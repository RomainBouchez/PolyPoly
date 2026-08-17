import { BID_INCREMENT } from './auction.js';
import { getOwnableTile, groupTiles } from './board.js';
import { HOTEL_LEVEL, HOUSES_PER_HOTEL } from './houses.js';
import { UNMORTGAGE_INTEREST } from './mortgage.js';
import { HEALTH_SICK_THRESHOLD, JAIL_FINE, ownsFullGroup } from './rules.js';
import type { GameAction, GameState, PlayerId } from './types.js';

// These predicates decide which actions the UI offers, so each one has to
// mirror every guard its executor enforces. Anything checked there but not
// here surfaces as a button that visibly does nothing when tapped — the
// affordability and bank-supply checks below were exactly that.

function canBuildHouse(state: GameState, playerId: PlayerId, tileIndex: number): boolean {
  const tile = state.board.tiles[tileIndex];
  if (!tile || tile.kind !== 'property') return false;
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.houses >= HOTEL_LEVEL) return false;
  if (!ownsFullGroup(state, playerId, tileIndex)) return false;
  const siblings = groupTiles(state.board, tile.group);
  if (siblings.some((s) => state.ownership[s.index]?.mortgaged)) return false;
  if (state.config.evenBuild) {
    const minHouses = Math.min(...siblings.map((s) => state.ownership[s.index]?.houses ?? 0));
    if (ownership.houses > minHouses) return false;
  }
  if ((state.players[playerId]?.cash ?? 0) < tile.houseCost) return false;
  if (state.config.limitedHouseSupply) {
    const becomingHotel = ownership.houses === HOUSES_PER_HOTEL;
    if (becomingHotel ? state.bank.hotelsRemaining <= 0 : state.bank.housesRemaining <= 0) return false;
  }
  return true;
}

function canAffordUnmortgage(state: GameState, playerId: PlayerId, tileIndex: number): boolean {
  const tile = state.board.tiles[tileIndex];
  if (!tile || !('mortgageValue' in tile)) return false;
  return (state.players[playerId]?.cash ?? 0) >= Math.round(tile.mortgageValue * UNMORTGAGE_INTEREST);
}

function canSellHouse(state: GameState, tileIndex: number): boolean {
  const tile = state.board.tiles[tileIndex];
  if (!tile || tile.kind !== 'property') return false;
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.houses <= 0) return false;
  if (state.config.evenBuild) {
    const siblings = groupTiles(state.board, tile.group);
    const maxHouses = Math.max(...siblings.map((s) => state.ownership[s.index]?.houses ?? 0));
    if (ownership.houses < maxHouses) return false;
  }
  // Breaking a hotel hands back 4 houses, which the bank has to have in stock.
  if (state.config.limitedHouseSupply && ownership.houses === HOTEL_LEVEL) {
    if (state.bank.housesRemaining < HOUSES_PER_HOTEL) return false;
  }
  return true;
}

/** Derives which actions `playerId` may legally submit right now. The UI
 *  should render its buttons from this list, never decide legality itself. */
export function getLegalActions(state: GameState, playerId: PlayerId): GameAction[] {
  const player = state.players[playerId];
  if (!player || player.status !== 'active') return [];

  const actions: GameAction[] = [];
  const phase = state.phase;

  if (phase.type === 'awaiting-roll' && phase.playerId === playerId) {
    actions.push({ type: 'roll', playerId });
  }

  if (phase.type === 'awaiting-jail-decision' && phase.playerId === playerId) {
    actions.push({ type: 'roll-for-jail', playerId });
    if (player.cash >= JAIL_FINE) actions.push({ type: 'pay-jail-fine', playerId });
    if (player.getOutOfJailFreeCards > 0) actions.push({ type: 'use-jail-card', playerId });

    // Taking a hostage doesn't release you from jail — it's an extra option
    // available alongside paying/rolling, one hostage at a time board-wide.
    if (state.config.hostageMode && !state.hostage) {
      for (const [key, ownership] of Object.entries(state.ownership)) {
        if (ownership.ownerId === playerId || ownership.mortgaged) continue;
        const owner = state.players[ownership.ownerId];
        if (!owner || owner.status !== 'active') continue;
        // Hospitals never charge rent — their income is the illness payout,
        // which a hostage does not touch. Holding one costs its owner nothing,
        // so offering it is just a way to waste your one hostage.
        if (state.board.tiles[Number(key)]?.kind === 'hospital') continue;
        actions.push({ type: 'take-hostage', playerId, tileIndex: Number(key) });
      }
    }
  }

  if (phase.type === 'awaiting-purchase' && phase.playerId === playerId) {
    const tile = getOwnableTile(state.board, phase.tileIndex);
    if (player.cash >= tile.price) actions.push({ type: 'buy', playerId });
    actions.push({ type: 'decline-purchase', playerId });
  }

  if (phase.type === 'auction' && phase.turnPlayerId === playerId) {
    const minBid = phase.highBid + BID_INCREMENT;
    if (player.cash >= minBid) actions.push({ type: 'auction-bid', playerId, amount: minBid });
    actions.push({ type: 'auction-pass', playerId });
  }

  if (phase.type === 'awaiting-debt-settlement' && phase.playerId === playerId) {
    if (player.cash >= phase.amount) actions.push({ type: 'pay-debt', playerId });
    actions.push({ type: 'declare-bankruptcy', playerId });
  }

  // Property management and trades are available any time, not just on your
  // turn — except mortgaging, which is restricted to the current player's turn.
  const isCurrentPlayersTurn = state.turnOrder[state.currentPlayerIndex] === playerId;
  for (const [key, ownership] of Object.entries(state.ownership)) {
    if (ownership.ownerId !== playerId) continue;
    const tileIndex = Number(key);
    if (state.config.mortgage && isCurrentPlayersTurn) {
      if (!ownership.mortgaged && ownership.houses === 0) actions.push({ type: 'mortgage', playerId, tileIndex });
      if (ownership.mortgaged && canAffordUnmortgage(state, playerId, tileIndex)) {
        actions.push({ type: 'unmortgage', playerId, tileIndex });
      }
    }
    if (canBuildHouse(state, playerId, tileIndex)) actions.push({ type: 'build-house', playerId, tileIndex });
    if (canSellHouse(state, tileIndex)) actions.push({ type: 'sell-house', playerId, tileIndex });
  }

  // A drawn Squat pass demands an immediate target-or-skip decision — also
  // available any time, not gated to whoever's turn it is right now.
  const undecided = state.heldSquatCards.filter((h) => h.playerId === playerId && h.targetTileIndex === undefined);
  if (undecided.length > 0) {
    actions.push({ type: 'skip-squat', playerId });
    const canPickTarget = state.config.squatCards && !(state.config.healthMode && player.health <= HEALTH_SICK_THRESHOLD);
    if (canPickTarget) {
      // Dedupe by tile — multiple undecided charges at the same level
      // shouldn't produce repeated identical actions for the same target.
      const levels = new Set(undecided.map((h) => h.buildingLevel));
      const seenTiles = new Set<number>();
      for (const level of levels) {
        for (const [key, ownership] of Object.entries(state.ownership)) {
          const tileIndex = Number(key);
          if (seenTiles.has(tileIndex) || ownership.ownerId === playerId || ownership.mortgaged) continue;
          if (ownership.houses !== level) continue;
          if (player.squattedPlayerIds.includes(ownership.ownerId)) continue;
          seenTiles.add(tileIndex);
          actions.push({ type: 'use-squat-on', playerId, tileIndex });
        }
      }
    }
  }

  return actions;
}
