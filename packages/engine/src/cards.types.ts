export type CardDeckName = 'travel' | 'customs';

export type CardEffect =
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'move-to'; tileIndex: number }
  | { type: 'move-relative'; steps: number }
  | { type: 'go-to-jail' }
  | { type: 'get-out-of-jail-free' }
  | { type: 'pay-each-player'; amount: number }
  | { type: 'collect-from-each-player'; amount: number }
  | { type: 'form-alliance' }
  | { type: 'grant-squat' };

export interface Card {
  id: string;
  text: string;
  effect: CardEffect;
  /** Only dealt into the deck when this GameConfig flag is enabled. */
  requiresConfig?: 'allianceMode';
}

export interface DeckState {
  drawPile: Card[];
  discardPile: Card[];
}
