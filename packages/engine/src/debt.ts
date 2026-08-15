import { findCardById } from './deck.js';
import { IllegalActionError } from './errors.js';
import type { GameEvent, GameState, PlayerId } from './types.js';

/**
 * Deducts `amount` from `playerId`, paying `creditorId` (or the bank).
 * If the player can't cover it, parks the game in `awaiting-debt-settlement`
 * instead of going negative, and returns false so the caller stops rather
 * than resolving the rest of the move.
 */
export function chargePlayer(
  draft: GameState,
  playerId: PlayerId,
  amount: number,
  creditorId: PlayerId | 'bank',
  events: GameEvent[],
): boolean {
  if (amount <= 0) return true;
  const player = draft.players[playerId]!;
  if (player.cash >= amount) {
    player.cash -= amount;
    if (creditorId !== 'bank') draft.players[creditorId]!.cash += amount;
    return true;
  }
  draft.phase = { type: 'awaiting-debt-settlement', playerId, creditorId, amount };
  events.push({ type: 'debt-pending', playerId, creditorId, amount });
  return false;
}

export function settleDebt(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const phase = draft.phase;
  if (phase.type !== 'awaiting-debt-settlement' || phase.playerId !== playerId) {
    throw new IllegalActionError('No debt is pending for this player');
  }
  const player = draft.players[playerId]!;
  if (player.cash < phase.amount) {
    throw new IllegalActionError('Still not enough cash — mortgage properties or sell houses first');
  }
  player.cash -= phase.amount;
  if (phase.creditorId !== 'bank') draft.players[phase.creditorId]!.cash += phase.amount;
  events.push({ type: 'debt-settled', playerId });
}

export function bankrupt(draft: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const phase = draft.phase;
  if (phase.type !== 'awaiting-debt-settlement' || phase.playerId !== playerId) {
    throw new IllegalActionError('No debt is pending for this player');
  }
  const creditorId = phase.creditorId;
  const player = draft.players[playerId]!;

  for (const [key, ownership] of Object.entries(draft.ownership)) {
    if (ownership.ownerId !== playerId) continue;
    const tileIndex = Number(key);
    if (creditorId === 'bank') {
      if (ownership.houses === 5) draft.bank.hotelsRemaining += 1;
      else draft.bank.housesRemaining += ownership.houses;
      delete draft.ownership[tileIndex];
    } else {
      ownership.ownerId = creditorId;
    }
  }

  if (creditorId !== 'bank') draft.players[creditorId]!.cash += player.cash;
  player.cash = 0;
  player.status = 'bankrupt';

  for (const held of draft.heldJailCards.filter((h) => h.playerId === playerId)) {
    draft.decks[held.deck].discardPile.push(findCardById(held.cardId));
  }
  draft.heldJailCards = draft.heldJailCards.filter((h) => h.playerId !== playerId);
  player.getOutOfJailFreeCards = 0;

  for (const held of draft.heldSquatCards.filter((h) => h.playerId === playerId)) {
    draft.decks[held.deck].discardPile.push(findCardById(held.cardId));
  }
  draft.heldSquatCards = draft.heldSquatCards.filter((h) => h.playerId !== playerId);

  events.push({ type: 'bankrupt', playerId, creditorId });
}
