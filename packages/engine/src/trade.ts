import { IllegalActionError } from './errors.js';
import type { GameState, TradeOffer } from './types.js';

export function validateTrade(state: GameState, trade: Omit<TradeOffer, 'id'>): void {
  const from = state.players[trade.fromId];
  const to = state.players[trade.toId];
  if (!from || !to) throw new IllegalActionError('Unknown player in trade');
  if (trade.fromId === trade.toId) throw new IllegalActionError('Cannot trade with yourself');
  if (from.cash < trade.fromCash) throw new IllegalActionError('Proposer cannot cover the offered cash');
  if (to.cash < trade.toCash) throw new IllegalActionError('Recipient cannot cover the requested cash');
  if (from.getOutOfJailFreeCards < trade.fromJailCards) throw new IllegalActionError('Proposer does not have that many jail cards');
  if (to.getOutOfJailFreeCards < trade.toJailCards) throw new IllegalActionError('Recipient does not have that many jail cards');
  for (const tileIndex of trade.fromProperties) {
    if (state.ownership[tileIndex]?.ownerId !== trade.fromId) throw new IllegalActionError(`Proposer does not own tile ${tileIndex}`);
    if ((state.ownership[tileIndex]?.houses ?? 0) > 0) throw new IllegalActionError('Sell houses before trading a property');
  }
  for (const tileIndex of trade.toProperties) {
    if (state.ownership[tileIndex]?.ownerId !== trade.toId) throw new IllegalActionError(`Recipient does not own tile ${tileIndex}`);
    if ((state.ownership[tileIndex]?.houses ?? 0) > 0) throw new IllegalActionError('Sell houses before trading a property');
  }
}

/** Mutates the draft to execute an already-accepted trade. Call validateTrade first. */
export function executeTrade(draft: GameState, trade: TradeOffer): void {
  const from = draft.players[trade.fromId]!;
  const to = draft.players[trade.toId]!;

  from.cash += trade.toCash - trade.fromCash;
  to.cash += trade.fromCash - trade.toCash;

  for (const tileIndex of trade.fromProperties) draft.ownership[tileIndex]!.ownerId = trade.toId;
  for (const tileIndex of trade.toProperties) draft.ownership[tileIndex]!.ownerId = trade.fromId;

  from.getOutOfJailFreeCards += trade.toJailCards - trade.fromJailCards;
  to.getOutOfJailFreeCards += trade.fromJailCards - trade.toJailCards;

  for (const held of draft.heldJailCards) {
    if (held.playerId === trade.fromId && trade.fromJailCards > 0) {
      held.playerId = trade.toId;
      trade.fromJailCards -= 1;
    } else if (held.playerId === trade.toId && trade.toJailCards > 0) {
      held.playerId = trade.fromId;
      trade.toJailCards -= 1;
    }
  }
}

export function findTrade(state: GameState, tradeId: number): TradeOffer {
  const trade = state.pendingTrades.find((t) => t.id === tradeId);
  if (!trade) throw new IllegalActionError('Trade not found');
  return trade;
}
