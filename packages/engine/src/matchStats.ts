import { netWorth } from './rules.js';
import type { GameEvent, GameState, LoggedEvent, PlayerId } from './types.js';

export interface StandingsEntry {
  playerId: PlayerId;
  netWorth: number;
  cash: number;
  status: 'active' | 'bankrupt';
  isWinner: boolean;
}

export interface PlayerMoneyFlow {
  playerId: PlayerId;
  rentPaid: number;
  rentReceived: number;
  /** Per-opponent breakdown, not just the total — answers "how much rent did
   *  I pay Jibou specifically", not just "how much rent did I pay overall". */
  rentPaidTo: Record<PlayerId, number>;
  rentReceivedFrom: Record<PlayerId, number>;
  taxPaid: number;
  wealthTaxPaid: number;
  wealthTaxReceived: number;
  cardCashDelta: number;
}

export interface BiggestRent {
  from: PlayerId;
  to: PlayerId;
  tileIndex: number;
  amount: number;
}

export interface TileVisit {
  tileIndex: number;
  count: number;
}

export interface PlayerBoardActivity {
  playerId: PlayerId;
  /** This player's own landings, sorted by count descending — "your
   *  most-visited tile", distinct from the game-wide tileVisits above. */
  tileVisits: TileVisit[];
}

export interface PlayerPropertyActivity {
  playerId: PlayerId;
  propertiesBought: number;
  totalSpentBuying: number;
  auctionsWon: number;
  housesBuilt: number;
  hotelsBuilt: number;
  housesSold: number;
  mortgagesTaken: number;
  mortgagesLifted: number;
}

export interface PlayerJailActivity {
  playerId: PlayerId;
  timesSent: Record<'tile' | 'three-doubles' | 'card', number>;
  releasedBy: Record<'paid-fine' | 'rolled-doubles' | 'max-turns' | 'jail-card', number>;
  /** Sum of 'stayed-in-jail' events for this player — Player.jailTurns resets
   *  to 0 on release, so the running total only survives in the event log. */
  turnsServed: number;
}

export interface TradeCounts {
  proposed: number;
  accepted: number;
  declined: number;
  cancelled: number;
  countered: number;
}

export interface PlayerTradeActivity {
  playerId: PlayerId;
  asInitiator: TradeCounts;
  asRecipient: TradeCounts;
  /** From accepted trades only. */
  cashSent: number;
  cashReceived: number;
  propertiesSent: number;
  propertiesReceived: number;
}

export interface BankruptcyEvent {
  order: number;
  playerId: PlayerId;
  creditorId: PlayerId | 'bank';
}

export interface AllianceRecord {
  players: [PlayerId, PlayerId];
}

export interface SquatUse {
  playerId: PlayerId;
  targetId: PlayerId;
  tileIndex: number;
}

export interface EmergencyFine {
  playerId: PlayerId;
  amount: number;
}

export interface MatchStats {
  /** Echoes the caller-supplied flag. False means the log may be missing
   *  earlier history (e.g. the safety-valve cap was hit) — the UI should
   *  caveat log-dependent figures (jail.turnsServed above all) rather than
   *  presenting them as exact. */
  logComplete: boolean;
  roundsPlayed: number;
  turnsPlayed: number;
  winnerId: PlayerId | undefined;
  /** Sorted by net worth, descending. Derived from finalState alone, so this
   *  is populated even with an empty or incomplete log. */
  standings: StandingsEntry[];
  moneyFlow: PlayerMoneyFlow[];
  biggestRent: BiggestRent | null;
  /** Every tile any player ever landed on, sorted by visit count descending. */
  tileVisits: TileVisit[];
  board: PlayerBoardActivity[];
  property: PlayerPropertyActivity[];
  jail: PlayerJailActivity[];
  trades: PlayerTradeActivity[];
  bankruptcies: BankruptcyEvent[];
  // Populated only when the matching config flag was on this game — empty
  // arrays/zero otherwise, so the UI can gate a section on "any data" rather
  // than re-reading config itself.
  alliances: AllianceRecord[];
  rainyDayOccurrences: number;
  squatsUsed: SquatUse[];
  emergencyFines: EmergencyFine[];
}

function emptyTradeCounts(): TradeCounts {
  return { proposed: 0, accepted: 0, declined: 0, cancelled: 0, countered: 0 };
}

/**
 * Derives a full-match summary from the server's recorded event log plus the
 * final game state. Pure and single-pass: every figure other than `standings`
 * folds over `log` once, in event order, into per-player accumulators keyed
 * by `finalState.turnOrder`.
 *
 * `entry.roundNumber`/`entry.turnNumber` aren't consumed by any stat below —
 * they're tagged at recording time (see Room.matchLog) so a future time-based
 * question (wealth over time, fastest bankruptcy by round) is answerable as a
 * pure addition here later, without ever touching the server/socket layer.
 */
export function computeMatchStats(log: LoggedEvent[], finalState: GameState, logComplete: boolean): MatchStats {
  const playerIds = finalState.turnOrder;

  const standings: StandingsEntry[] = playerIds
    .map((playerId) => {
      const player = finalState.players[playerId]!;
      return {
        playerId,
        netWorth: netWorth(finalState, playerId),
        cash: player.cash,
        status: player.status,
        isWinner: finalState.phase.type === 'game-over' && finalState.phase.winnerId === playerId,
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth);

  const moneyFlow = new Map<PlayerId, PlayerMoneyFlow>(
    playerIds.map((playerId) => [
      playerId,
      { playerId, rentPaid: 0, rentReceived: 0, rentPaidTo: {}, rentReceivedFrom: {}, taxPaid: 0, wealthTaxPaid: 0, wealthTaxReceived: 0, cardCashDelta: 0 },
    ]),
  );
  const property = new Map<PlayerId, PlayerPropertyActivity>(
    playerIds.map((playerId) => [
      playerId,
      { playerId, propertiesBought: 0, totalSpentBuying: 0, auctionsWon: 0, housesBuilt: 0, hotelsBuilt: 0, housesSold: 0, mortgagesTaken: 0, mortgagesLifted: 0 },
    ]),
  );
  const jail = new Map<PlayerId, PlayerJailActivity>(
    playerIds.map((playerId) => [
      playerId,
      {
        playerId,
        timesSent: { tile: 0, 'three-doubles': 0, card: 0 },
        releasedBy: { 'paid-fine': 0, 'rolled-doubles': 0, 'max-turns': 0, 'jail-card': 0 },
        turnsServed: 0,
      },
    ]),
  );
  const trades = new Map<PlayerId, PlayerTradeActivity>(
    playerIds.map((playerId) => [playerId, { playerId, asInitiator: emptyTradeCounts(), asRecipient: emptyTradeCounts(), cashSent: 0, cashReceived: 0, propertiesSent: 0, propertiesReceived: 0 }]),
  );
  const tileVisitCounts = new Map<number, number>();
  const perPlayerTileVisitCounts = new Map<PlayerId, Map<number, number>>(playerIds.map((playerId) => [playerId, new Map()]));
  const bankruptcies: BankruptcyEvent[] = [];
  const alliances: AllianceRecord[] = [];
  const squatsUsed: SquatUse[] = [];
  const emergencyFines: EmergencyFine[] = [];
  let biggestRent: BiggestRent | null = null;
  let rainyDayOccurrences = 0;

  // Trade contents only ever appear on 'trade-proposed' — later outcome events
  // ('trade-accepted' etc.) carry only the tradeId, so this map is how the
  // value moved in an accepted trade gets recovered when that event arrives.
  const proposals = new Map<number, Extract<GameEvent, { type: 'trade-proposed' }>>();

  for (const { event } of log) {
    switch (event.type) {
      case 'rent-paid': {
        const payer = moneyFlow.get(event.from);
        const receiver = moneyFlow.get(event.to);
        if (payer) {
          payer.rentPaid += event.amount;
          payer.rentPaidTo[event.to] = (payer.rentPaidTo[event.to] ?? 0) + event.amount;
        }
        if (receiver) {
          receiver.rentReceived += event.amount;
          receiver.rentReceivedFrom[event.from] = (receiver.rentReceivedFrom[event.from] ?? 0) + event.amount;
        }
        if (!biggestRent || event.amount > biggestRent.amount) {
          biggestRent = { from: event.from, to: event.to, tileIndex: event.tileIndex, amount: event.amount };
        }
        break;
      }
      case 'tax-paid': {
        const flow = moneyFlow.get(event.playerId);
        if (flow) flow.taxPaid += event.amount;
        break;
      }
      case 'wealth-tax-paid': {
        const payer = moneyFlow.get(event.playerId);
        const receiver = moneyFlow.get(event.toId);
        if (payer) payer.wealthTaxPaid += event.amount;
        if (receiver) receiver.wealthTaxReceived += event.amount;
        break;
      }
      case 'card-effect': {
        const flow = moneyFlow.get(event.playerId);
        if (flow) flow.cardCashDelta += event.cashDelta;
        break;
      }
      case 'moved': {
        tileVisitCounts.set(event.to, (tileVisitCounts.get(event.to) ?? 0) + 1);
        const mine = perPlayerTileVisitCounts.get(event.playerId);
        if (mine) mine.set(event.to, (mine.get(event.to) ?? 0) + 1);
        break;
      }
      case 'purchased': {
        const activity = property.get(event.playerId);
        if (activity) {
          activity.propertiesBought += 1;
          activity.totalSpentBuying += event.price;
        }
        break;
      }
      case 'auction-won': {
        const activity = property.get(event.playerId);
        if (activity) activity.auctionsWon += 1;
        break;
      }
      case 'house-built': {
        const activity = property.get(event.playerId);
        if (activity) {
          if (event.houses === 5) activity.hotelsBuilt += 1;
          else activity.housesBuilt += 1;
        }
        break;
      }
      case 'house-sold': {
        const activity = property.get(event.playerId);
        if (activity) activity.housesSold += 1;
        break;
      }
      case 'mortgaged': {
        const activity = property.get(event.playerId);
        if (activity) activity.mortgagesTaken += 1;
        break;
      }
      case 'unmortgaged': {
        const activity = property.get(event.playerId);
        if (activity) activity.mortgagesLifted += 1;
        break;
      }
      case 'sent-to-jail': {
        const activity = jail.get(event.playerId);
        if (activity) activity.timesSent[event.reason] += 1;
        break;
      }
      case 'released-from-jail': {
        const activity = jail.get(event.playerId);
        if (activity) activity.releasedBy[event.method] += 1;
        break;
      }
      case 'stayed-in-jail': {
        const activity = jail.get(event.playerId);
        if (activity) activity.turnsServed += 1;
        break;
      }
      case 'trade-proposed': {
        proposals.set(event.tradeId, event);
        const initiator = trades.get(event.fromId);
        const recipient = trades.get(event.toId);
        if (initiator) initiator.asInitiator.proposed += 1;
        if (recipient) recipient.asRecipient.proposed += 1;
        break;
      }
      case 'trade-accepted': {
        const offer = proposals.get(event.tradeId);
        const initiator = offer ? trades.get(offer.fromId) : undefined;
        const recipient = offer ? trades.get(offer.toId) : undefined;
        if (initiator) initiator.asInitiator.accepted += 1;
        if (recipient) recipient.asRecipient.accepted += 1;
        if (offer && initiator) {
          initiator.cashSent += offer.fromCash;
          initiator.cashReceived += offer.toCash;
          initiator.propertiesSent += offer.fromProperties.length;
          initiator.propertiesReceived += offer.toProperties.length;
        }
        if (offer && recipient) {
          recipient.cashSent += offer.toCash;
          recipient.cashReceived += offer.fromCash;
          recipient.propertiesSent += offer.toProperties.length;
          recipient.propertiesReceived += offer.fromProperties.length;
        }
        break;
      }
      case 'trade-declined': {
        const offer = proposals.get(event.tradeId);
        if (offer) {
          trades.get(offer.fromId)!.asInitiator.declined += 1;
          trades.get(offer.toId)!.asRecipient.declined += 1;
        }
        break;
      }
      case 'trade-cancelled': {
        const offer = proposals.get(event.tradeId);
        if (offer) {
          trades.get(offer.fromId)!.asInitiator.cancelled += 1;
          trades.get(offer.toId)!.asRecipient.cancelled += 1;
        }
        break;
      }
      case 'trade-countered': {
        const offer = proposals.get(event.tradeId);
        if (offer) {
          trades.get(offer.fromId)!.asInitiator.countered += 1;
          trades.get(offer.toId)!.asRecipient.countered += 1;
        }
        break;
      }
      case 'bankrupt': {
        bankruptcies.push({ order: bankruptcies.length + 1, playerId: event.playerId, creditorId: event.creditorId });
        break;
      }
      case 'alliance-formed': {
        alliances.push({ players: event.players });
        break;
      }
      case 'rainy-day-started': {
        rainyDayOccurrences += 1;
        break;
      }
      case 'squatted': {
        squatsUsed.push({ playerId: event.playerId, targetId: event.targetId, tileIndex: event.tileIndex });
        break;
      }
      case 'emergency-fine': {
        emergencyFines.push({ playerId: event.playerId, amount: event.amount });
        break;
      }
      default:
        break;
    }
  }

  const tileVisits: TileVisit[] = [...tileVisitCounts.entries()]
    .map(([tileIndex, count]) => ({ tileIndex, count }))
    .sort((a, b) => b.count - a.count);
  const board: PlayerBoardActivity[] = playerIds.map((playerId) => ({
    playerId,
    tileVisits: [...(perPlayerTileVisitCounts.get(playerId) ?? new Map()).entries()]
      .map(([tileIndex, count]) => ({ tileIndex, count }))
      .sort((a, b) => b.count - a.count),
  }));

  return {
    logComplete,
    roundsPlayed: finalState.roundNumber,
    turnsPlayed: finalState.turnNumber,
    winnerId: finalState.phase.type === 'game-over' ? finalState.phase.winnerId : undefined,
    standings,
    moneyFlow: [...moneyFlow.values()],
    biggestRent,
    tileVisits,
    board,
    property: [...property.values()],
    jail: [...jail.values()],
    trades: [...trades.values()],
    bankruptcies,
    alliances,
    rainyDayOccurrences,
    squatsUsed,
    emergencyFines,
  };
}
