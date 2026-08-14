import { getOwnableTile } from './board.js';
import { IllegalActionError } from './errors.js';
import type { GameState, PlayerId } from './types.js';

const UNMORTGAGE_INTEREST = 1.1;

export function mortgageProperty(state: GameState, playerId: PlayerId, tileIndex: number): number {
  if (!state.config.mortgage) throw new IllegalActionError('Mortgaging is disabled in this game');
  const tile = getOwnableTile(state.board, tileIndex);
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.ownerId !== playerId) throw new IllegalActionError('You do not own this property');
  if (ownership.mortgaged) throw new IllegalActionError('Already mortgaged');
  if (ownership.houses > 0) throw new IllegalActionError('Sell the houses on this property first');

  ownership.mortgaged = true;
  const player = state.players[playerId]!;
  player.cash += tile.mortgageValue;
  return tile.mortgageValue;
}

export function unmortgageProperty(state: GameState, playerId: PlayerId, tileIndex: number): number {
  const tile = getOwnableTile(state.board, tileIndex);
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.ownerId !== playerId) throw new IllegalActionError('You do not own this property');
  if (!ownership.mortgaged) throw new IllegalActionError('This property is not mortgaged');

  const cost = Math.round(tile.mortgageValue * UNMORTGAGE_INTEREST);
  const player = state.players[playerId]!;
  if (player.cash < cost) throw new IllegalActionError('Not enough cash to lift the mortgage');

  player.cash -= cost;
  ownership.mortgaged = false;
  return cost;
}
