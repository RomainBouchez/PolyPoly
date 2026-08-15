import type { GameConfig } from '@polypoly/shared';
import type { Card, CardDeckName, DeckState } from './cards.types.js';
import { customsDeck, travelDeck } from './data/cards.js';

export { SQUAT_CARD_ID } from './data/cards.js';
import type { Rng } from './rng.js';

const CARD_BY_ID: Record<string, Card> = Object.fromEntries(
  [...travelDeck, ...customsDeck].map((card) => [card.id, card]),
);

export function findCardById(id: string): Card {
  const card = CARD_BY_ID[id];
  if (!card) throw new Error(`Unknown card id ${id}`);
  return card;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1) - 1; // nextInt is 1..max inclusive
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Cards tagged `requiresConfig` are only dealt into the deck when that
 *  config flag is on — otherwise drawing them would fizzle with no effect. */
function eligibleCards(deck: Card[], config: GameConfig): Card[] {
  return deck.filter((card) => !card.requiresConfig || config[card.requiresConfig]);
}

export function createInitialDecks(rng: Rng, config: GameConfig): Record<CardDeckName, DeckState> {
  return {
    travel: { drawPile: shuffle(eligibleCards(travelDeck, config), rng), discardPile: [] },
    customs: { drawPile: shuffle(eligibleCards(customsDeck, config), rng), discardPile: [] },
  };
}

/** Draws the top card, reshuffling the discard pile back in if the deck is empty. */
export function drawCard(deck: DeckState, rng: Rng): Card {
  if (deck.drawPile.length === 0) {
    deck.drawPile = shuffle(deck.discardPile, rng);
    deck.discardPile = [];
  }
  const card = deck.drawPile.shift();
  if (!card) throw new Error('Deck is empty and has no discards to reshuffle');
  return card;
}
