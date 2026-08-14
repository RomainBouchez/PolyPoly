import type { GameConfig } from '@polypoly/shared';
import type { Board, PropertyGroup } from './board.types.js';
import type { Card, CardDeckName, DeckState } from './cards.types.js';

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailFreeCards: number;
  status: 'active' | 'bankrupt';
  /** 0-100. Only meaningful when config.healthMode is on. */
  health: number;
  pharmacyUsed: boolean;
}

export interface Ownership {
  ownerId: PlayerId;
  /** 0-4 houses, 5 = hotel. Always 0 for airports/utilities. */
  houses: number;
  mortgaged: boolean;
}

export interface BankState {
  housesRemaining: number;
  hotelsRemaining: number;
}

/** A held Get Out of Jail Free card, tracked so it can be returned to its
 *  exact deck's discard pile when used. */
export interface HeldJailCard {
  cardId: string;
  deck: CardDeckName;
  playerId: PlayerId;
}

export interface TradeOffer {
  id: number;
  fromId: PlayerId;
  toId: PlayerId;
  fromCash: number;
  toCash: number;
  fromProperties: number[];
  toProperties: number[];
  fromJailCards: number;
  toJailCards: number;
}

export type Phase =
  | { type: 'awaiting-roll'; playerId: PlayerId }
  | { type: 'awaiting-jail-decision'; playerId: PlayerId }
  | { type: 'awaiting-purchase'; playerId: PlayerId; tileIndex: number }
  | {
      type: 'auction';
      tileIndex: number;
      order: PlayerId[];
      passed: PlayerId[];
      highBid: number;
      highBidderId: PlayerId | null;
      turnPlayerId: PlayerId;
      resumePlayerId: PlayerId;
    }
  | { type: 'awaiting-debt-settlement'; playerId: PlayerId; creditorId: PlayerId | 'bank'; amount: number }
  | { type: 'game-over'; winnerId: PlayerId };

export interface GameState {
  board: Board;
  config: GameConfig;
  players: Record<PlayerId, Player>;
  turnOrder: PlayerId[];
  currentPlayerIndex: number;
  ownership: Record<number, Ownership>;
  phase: Phase;
  doublesCount: number;
  vacationPot: number;
  turnNumber: number;
  bank: BankState;
  decks: Record<CardDeckName, DeckState>;
  heldJailCards: HeldJailCard[];
  pendingTrades: TradeOffer[];
  nextTradeId: number;
}

export type GameAction =
  | { type: 'roll'; playerId: PlayerId }
  | { type: 'buy'; playerId: PlayerId }
  | { type: 'decline-purchase'; playerId: PlayerId }
  | { type: 'pay-jail-fine'; playerId: PlayerId }
  | { type: 'roll-for-jail'; playerId: PlayerId }
  | { type: 'use-jail-card'; playerId: PlayerId }
  | { type: 'build-house'; playerId: PlayerId; tileIndex: number }
  | { type: 'sell-house'; playerId: PlayerId; tileIndex: number }
  | { type: 'mortgage'; playerId: PlayerId; tileIndex: number }
  | { type: 'unmortgage'; playerId: PlayerId; tileIndex: number }
  | { type: 'auction-bid'; playerId: PlayerId; amount: number }
  | { type: 'auction-pass'; playerId: PlayerId }
  | {
      type: 'propose-trade';
      playerId: PlayerId;
      toId: PlayerId;
      fromCash: number;
      toCash: number;
      fromProperties: number[];
      toProperties: number[];
      fromJailCards: number;
      toJailCards: number;
    }
  | { type: 'respond-trade'; playerId: PlayerId; tradeId: number; accept: boolean }
  | { type: 'cancel-trade'; playerId: PlayerId; tradeId: number }
  | { type: 'pay-debt'; playerId: PlayerId }
  | { type: 'declare-bankruptcy'; playerId: PlayerId }
  | { type: 'check-time-limit'; elapsedMinutes: number };

export type GameEvent =
  | { type: 'rolled'; playerId: PlayerId; dice: [number, number] }
  | { type: 'moved'; playerId: PlayerId; from: number; to: number; passedGo: boolean }
  | { type: 'collected-go'; playerId: PlayerId; amount: number }
  | { type: 'rent-paid'; from: PlayerId; to: PlayerId; amount: number; tileIndex: number }
  | { type: 'tax-paid'; playerId: PlayerId; amount: number; toVacationPot: boolean }
  | { type: 'purchased'; playerId: PlayerId; tileIndex: number; price: number }
  | { type: 'declined-purchase'; playerId: PlayerId; tileIndex: number }
  | { type: 'sent-to-jail'; playerId: PlayerId; reason: 'tile' | 'three-doubles' | 'card' }
  | { type: 'released-from-jail'; playerId: PlayerId; method: 'paid-fine' | 'rolled-doubles' | 'max-turns' | 'jail-card' }
  | { type: 'stayed-in-jail'; playerId: PlayerId }
  | { type: 'card-drawn'; playerId: PlayerId; deck: CardDeckName; cardId: string; text: string }
  | { type: 'card-effect'; playerId: PlayerId; description: string; cashDelta: number }
  | { type: 'landed-on-vacation'; playerId: PlayerId; amount: number }
  | { type: 'health-effect'; playerId: PlayerId; tileIndex: number; cashDelta: number; healthDelta: number }
  | { type: 'illness'; playerId: PlayerId; healthLoss: number; doublePeine: boolean }
  | { type: 'house-built'; playerId: PlayerId; tileIndex: number; houses: number }
  | { type: 'house-sold'; playerId: PlayerId; tileIndex: number; houses: number }
  | { type: 'mortgaged'; playerId: PlayerId; tileIndex: number; amount: number }
  | { type: 'unmortgaged'; playerId: PlayerId; tileIndex: number; amount: number }
  | { type: 'auction-started'; tileIndex: number }
  | { type: 'auction-bid'; playerId: PlayerId; amount: number }
  | { type: 'auction-passed'; playerId: PlayerId }
  | { type: 'auction-won'; playerId: PlayerId; tileIndex: number; amount: number }
  | { type: 'auction-no-sale'; tileIndex: number }
  | { type: 'trade-proposed'; tradeId: number; fromId: PlayerId; toId: PlayerId }
  | { type: 'trade-accepted'; tradeId: number }
  | { type: 'trade-declined'; tradeId: number }
  | { type: 'trade-cancelled'; tradeId: number }
  | { type: 'debt-pending'; playerId: PlayerId; creditorId: PlayerId | 'bank'; amount: number }
  | { type: 'debt-settled'; playerId: PlayerId }
  | { type: 'bankrupt'; playerId: PlayerId; creditorId: PlayerId | 'bank' }
  | { type: 'turn-ended'; playerId: PlayerId; nextPlayerId: PlayerId }
  | { type: 'game-over'; winnerId: PlayerId };

export type PropertyGroupTotals = Partial<Record<PropertyGroup, number>>;

export type { Card, CardDeckName, DeckState };
