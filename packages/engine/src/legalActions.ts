import { BID_INCREMENT } from './auction.js';
import { getOwnableTile, groupTiles } from './board.js';
import { JAIL_FINE, ownsFullGroup } from './rules.js';
import type { GameAction, GameState, PlayerId } from './types.js';

function canBuildHouse(state: GameState, playerId: PlayerId, tileIndex: number): boolean {
  const tile = state.board.tiles[tileIndex];
  if (!tile || tile.kind !== 'property') return false;
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.houses >= 5) return false;
  if (!ownsFullGroup(state, playerId, tileIndex)) return false;
  const siblings = groupTiles(state.board, tile.group);
  if (siblings.some((s) => state.ownership[s.index]?.mortgaged)) return false;
  if (state.config.evenBuild) {
    const minHouses = Math.min(...siblings.map((s) => state.ownership[s.index]?.houses ?? 0));
    if (ownership.houses > minHouses) return false;
  }
  return true;
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
      if (ownership.mortgaged) actions.push({ type: 'unmortgage', playerId, tileIndex });
    }
    if (canBuildHouse(state, playerId, tileIndex)) actions.push({ type: 'build-house', playerId, tileIndex });
    if (canSellHouse(state, tileIndex)) actions.push({ type: 'sell-house', playerId, tileIndex });
  }

  return actions;
}
