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
  /** Opponents this player has already used a Squat charge against — a
   *  given opponent can only ever be squatted once, even across multiple
   *  Squat cards drawn over the game. */
  squattedPlayerIds: PlayerId[];
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

/** A temporary alliance between two players — see rules.ts's isAllied and
 *  ALLIANCE_DURATION_ROUNDS/ALLIANCE_RENT_MULTIPLIER. Counted in full trips
 *  around the table, so a three-round pact lasts three of everyone's turns. */
export interface Alliance {
  players: [PlayerId, PlayerId];
  roundsRemaining: number;
}

/** Scheduled once at game creation (config.rainyDay) via the game's own
 *  seeded Rng, so replays stay deterministic. `triggerRound`/`durationRounds`
 *  are null/0 when the config toggle is off. */
export interface RainyDayState {
  triggerRound: number | null;
  durationRounds: number;
  roundsRemaining: number;
  triggered: boolean;
}

/** Started by landing on the 'sunny' tile while it's raining — see the
 *  'sunny' case in applyAction.ts's resolveTile and rules.ts's computeRent. */
export interface SunnyDayState {
  roundsRemaining: number;
}

/** At most one property held hostage at a time (config.hostageMode) — see
 *  the 'take-hostage' action and rules.ts's computeRent. */
export interface HostageState {
  tileIndex: number;
  kidnapperId: PlayerId;
  ownerId: PlayerId;
}

/** A held Squat pass, tracked the same way as a jail card so it can be
 *  returned to its exact deck's discard pile when resolved. `buildingLevel`
 *  is rolled once at draw time: 1, 2, 3 houses, or 5 (hotel). The holder must
 *  pick a `targetTileIndex` (via `use-squat-on`) or skip it (`skip-squat`) —
 *  undefined means the pass is still awaiting that choice. Once targeted,
 *  landing there waives rent automatically; no further decision is needed. */
export interface HeldSquatCard {
  cardId: string;
  deck: CardDeckName;
  playerId: PlayerId;
  buildingLevel: number;
  targetTileIndex?: number;
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
  /** Individual player turns taken. Drives rainy day's schedule. */
  turnNumber: number;
  /** Complete trips around the table. A "20 turn" limit meant 20 individual
   *  turns — four rounds at five players — which is not what anyone reads it
   *  as, so the end condition counts these instead. */
  roundNumber: number;
  bank: BankState;
  decks: Record<CardDeckName, DeckState>;
  heldJailCards: HeldJailCard[];
  heldSquatCards: HeldSquatCard[];
  pendingTrades: TradeOffer[];
  nextTradeId: number;
  alliances: Alliance[];
  rainyDay: RainyDayState;
  sunnyDay: SunnyDayState;
  hostage: HostageState | null;
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
      /** Set when this offer answers one made to you: the original is dropped
       *  as this one is created, so exactly one live trade ever exists between
       *  two players and there is no ambiguity about which you just accepted. */
      countersTradeId?: number;
    }
  | { type: 'respond-trade'; playerId: PlayerId; tradeId: number; accept: boolean }
  | { type: 'cancel-trade'; playerId: PlayerId; tradeId: number }
  | { type: 'pay-debt'; playerId: PlayerId }
  | { type: 'declare-bankruptcy'; playerId: PlayerId }
  | { type: 'transfer-health'; playerId: PlayerId; toId: PlayerId; amount: number }
  | { type: 'take-hostage'; playerId: PlayerId; tileIndex: number }
  | { type: 'use-squat-on'; playerId: PlayerId; tileIndex: number }
  | { type: 'skip-squat'; playerId: PlayerId }
  | { type: 'check-time-limit'; elapsedMinutes: number };

export type GameEvent =
  | { type: 'rolled'; playerId: PlayerId; dice: [number, number] }
  | { type: 'moved'; playerId: PlayerId; from: number; to: number; passedGo: boolean }
  | { type: 'collected-go'; playerId: PlayerId; amount: number }
  | { type: 'rent-paid'; from: PlayerId; to: PlayerId; amount: number; tileIndex: number }
  | { type: 'tax-paid'; playerId: PlayerId; amount: number; toVacationPot: boolean }
  // Distinct from 'tax-paid': this money goes to a player, never the bank or
  // the vacation pot, and it is skipped entirely (no event) when the payer
  // is already the poorest, or nobody else is left to receive it.
  | { type: 'wealth-tax-paid'; playerId: PlayerId; toId: PlayerId; amount: number }
  | { type: 'purchased'; playerId: PlayerId; tileIndex: number; price: number }
  | { type: 'declined-purchase'; playerId: PlayerId; tileIndex: number }
  | { type: 'sent-to-jail'; playerId: PlayerId; reason: 'tile' | 'three-doubles' | 'card' }
  | { type: 'released-from-jail'; playerId: PlayerId; method: 'paid-fine' | 'rolled-doubles' | 'max-turns' | 'jail-card' }
  | { type: 'stayed-in-jail'; playerId: PlayerId }
  | { type: 'card-drawn'; playerId: PlayerId; deck: CardDeckName; cardId: string; text: string }
  | { type: 'card-effect'; playerId: PlayerId; description: string; cashDelta: number }
  | { type: 'landed-on-vacation'; playerId: PlayerId; amount: number }
  | { type: 'health-effect'; playerId: PlayerId; tileIndex: number; cashDelta: number; healthDelta: number }
  // `cashPaid` is the total actually taken (capped at what the player had), so
  // the feed can say where the money went — it used to move with no event
  // mentioning it at all, which read as cash vanishing for no reason.
  | { type: 'illness'; playerId: PlayerId; healthLoss: number; doublePeine: boolean; cashPaid: number }
  | { type: 'jail-health-lost'; playerId: PlayerId; amount: number }
  | { type: 'house-built'; playerId: PlayerId; tileIndex: number; houses: number }
  | { type: 'house-sold'; playerId: PlayerId; tileIndex: number; houses: number }
  | { type: 'mortgaged'; playerId: PlayerId; tileIndex: number; amount: number }
  | { type: 'unmortgaged'; playerId: PlayerId; tileIndex: number; amount: number }
  | { type: 'auction-started'; tileIndex: number }
  | { type: 'auction-bid'; playerId: PlayerId; amount: number }
  | { type: 'auction-passed'; playerId: PlayerId }
  | { type: 'auction-won'; playerId: PlayerId; tileIndex: number; amount: number }
  | { type: 'auction-no-sale'; tileIndex: number }
  // Carries the full offer, not just who/whom: match-stats needs to know what
  // was actually exchanged once the trade is later accepted, and this is the
  // only event that ever holds the offer's contents — TradeOffer objects
  // vanish from state the moment a trade resolves.
  | {
      type: 'trade-proposed';
      tradeId: number;
      fromId: PlayerId;
      toId: PlayerId;
      fromCash: number;
      toCash: number;
      fromProperties: number[];
      toProperties: number[];
      fromJailCards: number;
      toJailCards: number;
    }
  | { type: 'trade-accepted'; tradeId: number }
  | { type: 'trade-declined'; tradeId: number }
  | { type: 'trade-cancelled'; tradeId: number }
  | { type: 'trade-countered'; tradeId: number; newTradeId: number; fromId: PlayerId; toId: PlayerId }
  | { type: 'debt-pending'; playerId: PlayerId; creditorId: PlayerId | 'bank'; amount: number }
  | { type: 'debt-settled'; playerId: PlayerId }
  | { type: 'squat-granted'; playerId: PlayerId; buildingLevel: number }
  | { type: 'squat-target-chosen'; playerId: PlayerId; targetId: PlayerId; tileIndex: number }
  | { type: 'squat-skipped'; playerId: PlayerId }
  | { type: 'squatted'; playerId: PlayerId; targetId: PlayerId; tileIndex: number }
  | { type: 'bankrupt'; playerId: PlayerId; creditorId: PlayerId | 'bank' }
  | { type: 'turn-ended'; playerId: PlayerId; nextPlayerId: PlayerId }
  | { type: 'game-over'; winnerId: PlayerId }
  | { type: 'alliance-formed'; players: [PlayerId, PlayerId] }
  | { type: 'alliance-ended'; players: [PlayerId, PlayerId] }
  | { type: 'health-transferred'; fromId: PlayerId; toId: PlayerId; amount: number }
  | { type: 'rainy-day-started'; turns: number }
  | { type: 'rainy-day-ended' }
  | { type: 'sunny-day-started'; turns: number }
  | { type: 'sunny-day-ended' }
  | { type: 'emergency-fine'; playerId: PlayerId; amount: number }
  | { type: 'hostage-taken'; playerId: PlayerId; tileIndex: number; ownerId: PlayerId }
  | { type: 'hostage-released'; playerId: PlayerId; tileIndex: number };

/** A GameEvent tagged with when it happened in game-time. An event on its own
 *  preserves relative order but not *which* round/turn produced it — tagging
 *  at the point of recording (see Room.matchLog on the server) keeps every
 *  future time-based question (wealth over time, fastest bankruptcy by round)
 *  answerable later as a pure computation, without ever touching the
 *  server/socket layer again. */
export interface LoggedEvent {
  event: GameEvent;
  roundNumber: number;
  turnNumber: number;
}

export type PropertyGroupTotals = Partial<Record<PropertyGroup, number>>;

export type { Card, CardDeckName, DeckState };
