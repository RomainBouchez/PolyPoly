import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { bankrupt } from './debt.js';
import { computeMatchStats } from './matchStats.js';
import { DEFAULT_PLAYERS, freshState, P1, P2, P3, scriptedRng } from './testUtils.js';
import type { GameEvent, GameState, LoggedEvent } from './types.js';

const rng = scriptedRng([]);

/** Mirrors Room.runAction: tags each event with the round/turn number of the
 *  state it produced, in order. */
function log(state: GameState, events: GameEvent[]): LoggedEvent[] {
  return events.map((event) => ({ event, roundNumber: state.roundNumber, turnNumber: state.turnNumber }));
}

const PORTO = 1; // portugal, price 60
const LISBON = 3; // portugal, price 80

describe('computeMatchStats', () => {
  it('handles an empty log without throwing, deriving standings from state alone', () => {
    const state = freshState();
    const stats = computeMatchStats([], state, true);

    expect(stats.winnerId).toBeUndefined();
    expect(stats.standings).toHaveLength(DEFAULT_PLAYERS.length);
    expect(stats.standings.every((s) => s.netWorth === 1500)).toBe(true);
    expect(stats.moneyFlow.every((f) => f.rentPaid === 0 && f.rentReceived === 0)).toBe(true);
    expect(stats.tileVisits).toEqual([]);
    expect(stats.bankruptcies).toEqual([]);
    expect(stats.trades.every((t) => t.asInitiator.proposed === 0)).toBe(true);
  });

  it('sums rent paid/received, per-opponent, and finds the biggest single rent', () => {
    const state = freshState();
    state.ownership[LISBON] = { ownerId: P2, houses: 0, mortgaged: false };
    const tile = state.board.tiles[LISBON]!;
    if (tile.kind !== 'property') throw new Error('expected property');

    // P1 lands on Lisbon (owned by P2), pays base rent.
    const r1 = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));
    const entries = log(r1.state, r1.events);

    const stats = computeMatchStats(entries, r1.state, true);
    const p1Flow = stats.moneyFlow.find((f) => f.playerId === P1)!;
    const p2Flow = stats.moneyFlow.find((f) => f.playerId === P2)!;

    expect(p1Flow.rentPaid).toBe(tile.rentLadder[0]);
    expect(p1Flow.rentPaidTo[P2]).toBe(tile.rentLadder[0]);
    expect(p2Flow.rentReceived).toBe(tile.rentLadder[0]);
    expect(p2Flow.rentReceivedFrom[P1]).toBe(tile.rentLadder[0]);
    expect(stats.biggestRent).toEqual({ from: P1, to: P2, tileIndex: LISBON, amount: tile.rentLadder[0] });
    expect(stats.tileVisits).toContainEqual({ tileIndex: LISBON, count: 1 });
  });

  it('counts tile visits across multiple landings, sorted by frequency', () => {
    const state = freshState({ auction: false });
    let s = state;
    const entries: LoggedEvent[] = [];

    // Two different rolls landing on two different tiles; land on the same
    // tile (Lisbon, index 3) twice by re-using the same roll from Go.
    for (const dice of [[1, 2] as [number, number], [1, 2] as [number, number]]) {
      s.players[P1]!.position = 0;
      s.phase = { type: 'awaiting-roll', playerId: P1 };
      const r = applyAction(s, { type: 'roll', playerId: P1 }, scriptedRng(dice));
      entries.push(...log(r.state, r.events));
      s = r.state;
      if (s.phase.type === 'awaiting-purchase') {
        const d = applyAction(s, { type: 'decline-purchase', playerId: P1 }, rng);
        entries.push(...log(d.state, d.events));
        s = d.state;
      }
    }

    const stats = computeMatchStats(entries, s, true);
    expect(stats.tileVisits[0]).toEqual({ tileIndex: LISBON, count: 2 });
    // Same landings, attributed to the player who made them.
    const p1Board = stats.board.find((b) => b.playerId === P1)!;
    expect(p1Board.tileVisits[0]).toEqual({ tileIndex: LISBON, count: 2 });
  });

  it('keeps per-player tile visits separate, not pooled across players', () => {
    const state = freshState({ auction: false });
    const r1 = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2])); // P1 -> Lisbon (3)
    const s2 = r1.state.phase.type === 'awaiting-purchase' ? applyAction(r1.state, { type: 'decline-purchase', playerId: P1 }, rng).state : r1.state;
    const r2 = applyAction(s2, { type: 'roll', playerId: P2 }, scriptedRng([1, 2])); // P2 -> Lisbon (3) too
    const entries = [...log(r1.state, r1.events), ...log(s2, []), ...log(r2.state, r2.events)];

    const stats = computeMatchStats(entries, r2.state, true);
    const p1Board = stats.board.find((b) => b.playerId === P1)!;
    const p2Board = stats.board.find((b) => b.playerId === P2)!;
    expect(p1Board.tileVisits).toEqual([{ tileIndex: LISBON, count: 1 }]);
    expect(p2Board.tileVisits).toEqual([{ tileIndex: LISBON, count: 1 }]);
    // Pooled across both players, unlike the per-player breakdown above.
    expect(stats.tileVisits[0]).toEqual({ tileIndex: LISBON, count: 2 });
  });

  it('records a bankruptcy in elimination order and excludes the loser from being ranked winner', () => {
    const state = freshState();
    state.phase = { type: 'awaiting-debt-settlement', playerId: P1, creditorId: P2, amount: 500 };
    const events: GameEvent[] = [];
    bankrupt(state, P1, events);
    // richestPlayer would need a real game-over to set winnerId; here we only
    // check that the loser is marked bankrupt and excluded from the winner slot.
    const entries = log(state, events);

    const stats = computeMatchStats(entries, state, true);
    expect(stats.bankruptcies).toEqual([{ order: 1, playerId: P1, creditorId: P2 }]);
    const p1Standing = stats.standings.find((s) => s.playerId === P1)!;
    expect(p1Standing.status).toBe('bankrupt');
    expect(p1Standing.isWinner).toBe(false);
  });

  it('counts trades by outcome for both sides, and totals value from an accepted trade', () => {
    let s = freshState();
    s.ownership[PORTO] = { ownerId: P1, houses: 0, mortgaged: false };
    s.ownership[LISBON] = { ownerId: P2, houses: 0, mortgaged: false };
    const entries: LoggedEvent[] = [];

    const propose = (fromId: string, toId: string, fromCash: number, fromProperties: number[], toProperties: number[]) => {
      const r = applyAction(
        s,
        { type: 'propose-trade', playerId: fromId, toId, fromCash, toCash: 0, fromProperties, toProperties, fromJailCards: 0, toJailCards: 0 },
        rng,
      );
      entries.push(...log(r.state, r.events));
      s = r.state;
      return s.pendingTrades[s.pendingTrades.length - 1]!.id;
    };

    // Accepted: P1 -> P2, $50 + Porto for Lisbon.
    const acceptedId = propose(P1, P2, 50, [PORTO], [LISBON]);
    const accepted = applyAction(s, { type: 'respond-trade', playerId: P2, tradeId: acceptedId, accept: true }, rng);
    entries.push(...log(accepted.state, accepted.events));
    s = accepted.state;

    // Declined: P2 -> P3.
    const declinedId = propose(P2, P3, 0, [], []);
    const declined = applyAction(s, { type: 'respond-trade', playerId: P3, tradeId: declinedId, accept: false }, rng);
    entries.push(...log(declined.state, declined.events));
    s = declined.state;

    // Cancelled: P1 -> P3.
    const cancelledId = propose(P1, P3, 0, [], []);
    const cancelled = applyAction(s, { type: 'cancel-trade', playerId: P1, tradeId: cancelledId }, rng);
    entries.push(...log(cancelled.state, cancelled.events));
    s = cancelled.state;

    const stats = computeMatchStats(entries, s, true);
    const p1 = stats.trades.find((t) => t.playerId === P1)!;
    const p2 = stats.trades.find((t) => t.playerId === P2)!;
    const p3 = stats.trades.find((t) => t.playerId === P3)!;

    expect(p1.asInitiator).toEqual({ proposed: 2, accepted: 1, declined: 0, cancelled: 1, countered: 0 });
    expect(p2.asRecipient.accepted).toBe(1);
    expect(p2.asInitiator.proposed).toBe(1); // the P2 -> P3 declined offer
    expect(p3.asRecipient).toEqual({ proposed: 2, accepted: 0, declined: 1, cancelled: 1, countered: 0 });

    expect(p1.cashSent).toBe(50);
    expect(p1.propertiesSent).toBe(1);
    expect(p1.propertiesReceived).toBe(1);
    expect(p2.cashReceived).toBe(50);
  });

  it('sums stayed-in-jail across separate jail stints for the same player', () => {
    const state = freshState();
    const entries: LoggedEvent[] = [
      ...log(state, [{ type: 'stayed-in-jail', playerId: P1 }]),
      ...log(state, [{ type: 'released-from-jail', playerId: P1, method: 'paid-fine' }]),
      ...log(state, [{ type: 'sent-to-jail', playerId: P1, reason: 'tile' }]),
      ...log(state, [{ type: 'stayed-in-jail', playerId: P1 }]),
      ...log(state, [{ type: 'stayed-in-jail', playerId: P1 }]),
      ...log(state, [{ type: 'released-from-jail', playerId: P1, method: 'rolled-doubles' }]),
    ];

    const stats = computeMatchStats(entries, state, true);
    const p1Jail = stats.jail.find((j) => j.playerId === P1)!;
    expect(p1Jail.turnsServed).toBe(3);
    expect(p1Jail.timesSent.tile).toBe(1);
    expect(p1Jail.releasedBy['paid-fine']).toBe(1);
    expect(p1Jail.releasedBy['rolled-doubles']).toBe(1);
  });

  it('populates optional sections only when the matching config was on', () => {
    const state = freshState({ allianceMode: true, rainyDay: true, squatCards: true });
    const entries = log(state, [
      { type: 'alliance-formed', players: [P1, P2] },
      { type: 'rainy-day-started', turns: 2 },
      { type: 'squatted', playerId: P1, targetId: P2, tileIndex: LISBON },
      { type: 'emergency-fine', playerId: P1, amount: 150 },
    ]);

    const stats = computeMatchStats(entries, state, true);
    expect(stats.alliances).toEqual([{ players: [P1, P2] }]);
    expect(stats.rainyDayOccurrences).toBe(1);
    expect(stats.squatsUsed).toEqual([{ playerId: P1, targetId: P2, tileIndex: LISBON }]);
    expect(stats.emergencyFines).toEqual([{ playerId: P1, amount: 150 }]);
  });

  it('echoes the logComplete flag supplied by the caller', () => {
    const state = freshState();
    expect(computeMatchStats([], state, false).logComplete).toBe(false);
    expect(computeMatchStats([], state, true).logComplete).toBe(true);
  });

  it('tags each entry with the round/turn number of the state that produced it', () => {
    const state = freshState({ auction: false });
    const r1 = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));
    const entries = log(r1.state, r1.events);

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.roundNumber).toBe(r1.state.roundNumber);
      expect(entry.turnNumber).toBe(r1.state.turnNumber);
    }
  });
});
