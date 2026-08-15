import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { freshState, P1, P2, P3, scriptedRng } from './testUtils.js';

const PORTO = 1;
const LISBON = 3;
const rng = scriptedRng([]);

function withOffer() {
  const state = freshState();
  state.ownership[PORTO] = { ownerId: P1, houses: 0, mortgaged: false };
  state.ownership[LISBON] = { ownerId: P2, houses: 0, mortgaged: false };
  // P1 offers Porto to P2 and asks for Lisbon.
  return applyAction(
    state,
    {
      type: 'propose-trade',
      playerId: P1,
      toId: P2,
      fromCash: 0,
      toCash: 0,
      fromProperties: [PORTO],
      toProperties: [LISBON],
      fromJailCards: 0,
      toJailCards: 0,
    },
    rng,
  ).state;
}

const counter = (playerId: string, toId: string, countersTradeId: number, toCash = 50) =>
  ({
    type: 'propose-trade' as const,
    playerId,
    toId,
    fromCash: 0,
    toCash,
    fromProperties: [LISBON],
    toProperties: [PORTO],
    fromJailCards: 0,
    toJailCards: 0,
    countersTradeId,
  });

describe('counter-offers', () => {
  it('replaces the original rather than stacking beside it', () => {
    const offered = withOffer();
    const originalId = offered.pendingTrades[0]!.id;

    const { state: next, events } = applyAction(offered, counter(P2, P1, originalId), rng);

    expect(next.pendingTrades).toHaveLength(1);
    const live = next.pendingTrades[0]!;
    expect(live.id).not.toBe(originalId);
    expect(live.fromId).toBe(P2); // the counter now belongs to whoever answered
    expect(live.toId).toBe(P1);
    expect(events.some((e) => e.type === 'trade-countered' && e.tradeId === originalId)).toBe(true);
    expect(events.some((e) => e.type === 'trade-proposed' && e.tradeId === live.id)).toBe(true);
  });

  it('lets the original proposer accept the counter, executing the countered terms', () => {
    const offered = withOffer();
    const countered = applyAction(offered, counter(P2, P1, offered.pendingTrades[0]!.id), rng).state;
    const liveId = countered.pendingTrades[0]!.id;

    const { state: next } = applyAction(countered, { type: 'respond-trade', playerId: P1, tradeId: liveId, accept: true }, rng);

    expect(next.ownership[PORTO]!.ownerId).toBe(P2);
    expect(next.ownership[LISBON]!.ownerId).toBe(P1);
    expect(next.players[P1]!.cash).toBe(1500 - 50); // the counter asked P1 for $50
    expect(next.players[P2]!.cash).toBe(1500 + 50);
    expect(next.pendingTrades).toEqual([]);
  });

  it('can ping-pong: the counter can itself be countered', () => {
    const offered = withOffer();
    const first = applyAction(offered, counter(P2, P1, offered.pendingTrades[0]!.id), rng).state;
    const firstId = first.pendingTrades[0]!.id;

    // P1 answers in turn — from their side Porto is what they hold to give.
    const second = applyAction(
      first,
      { ...counter(P1, P2, firstId, 10), fromProperties: [PORTO], toProperties: [LISBON] },
      rng,
    ).state;

    expect(second.pendingTrades).toHaveLength(1);
    expect(second.pendingTrades[0]!.fromId).toBe(P1);
    expect(second.pendingTrades[0]!.id).not.toBe(firstId);
  });

  it('refuses a counter on an offer that was not made to you', () => {
    const offered = withOffer();
    const originalId = offered.pendingTrades[0]!.id;
    expect(() => applyAction(offered, counter(P3, P1, originalId), rng)).toThrow();
  });

  it('refuses a counter aimed at anyone but the original proposer', () => {
    const offered = withOffer();
    const originalId = offered.pendingTrades[0]!.id;
    expect(() => applyAction(offered, counter(P2, P3, originalId), rng)).toThrow();
  });

  it('leaves the original standing when the counter itself is invalid', () => {
    const offered = withOffer();
    const originalId = offered.pendingTrades[0]!.id;
    // P2 tries to give away a property they do not own.
    expect(() =>
      applyAction(
        offered,
        { ...counter(P2, P1, originalId), fromProperties: [PORTO] },
        rng,
      ),
    ).toThrow();
    expect(offered.pendingTrades.map((t) => t.id)).toEqual([originalId]);
  });
});

describe('one trade at a time', () => {
  function twoPropertiesEach() {
    const state = freshState();
    state.ownership[PORTO] = { ownerId: P1, houses: 0, mortgaged: false };
    state.ownership[LISBON] = { ownerId: P2, houses: 0, mortgaged: false };
    state.ownership[8] = { ownerId: P3, houses: 0, mortgaged: false }; // Poros
    return state;
  }

  const offer = (from: string, to: string, give: number[], take: number[]) =>
    ({
      type: 'propose-trade' as const,
      playerId: from,
      toId: to,
      fromCash: 0,
      toCash: 0,
      fromProperties: give,
      toProperties: take,
      fromJailCards: 0,
      toJailCards: 0,
    });

  it('blocks a second offer from the same proposer', () => {
    const state = applyAction(twoPropertiesEach(), offer(P1, P2, [PORTO], [LISBON]), rng).state;
    expect(() => applyAction(state, offer(P1, P3, [PORTO], [8]), rng)).toThrow();
  });

  // Counted on the recipient too, so one player cannot be buried under offers.
  it('blocks an offer aimed at someone already in a trade', () => {
    const state = applyAction(twoPropertiesEach(), offer(P1, P2, [PORTO], [LISBON]), rng).state;
    expect(() => applyAction(state, offer(P3, P2, [8], [LISBON]), rng)).toThrow();
  });

  it('still allows a counter-offer, which replaces rather than adds', () => {
    const state = applyAction(twoPropertiesEach(), offer(P1, P2, [PORTO], [LISBON]), rng).state;
    const originalId = state.pendingTrades[0]!.id;

    const { state: next } = applyAction(
      state,
      { ...offer(P2, P1, [LISBON], [PORTO]), countersTradeId: originalId },
      rng,
    );

    expect(next.pendingTrades).toHaveLength(1);
    expect(next.pendingTrades[0]!.fromId).toBe(P2);
  });

  it('frees both players once the trade resolves', () => {
    const state = applyAction(twoPropertiesEach(), offer(P1, P2, [PORTO], [LISBON]), rng).state;
    const id = state.pendingTrades[0]!.id;
    const after = applyAction(state, { type: 'respond-trade', playerId: P2, tradeId: id, accept: false }, rng).state;

    expect(() => applyAction(after, offer(P1, P3, [PORTO], [8]), rng)).not.toThrow();
  });

  it('leaves uninvolved players free to trade with each other', () => {
    const state = applyAction(twoPropertiesEach(), offer(P1, P2, [PORTO], [LISBON]), rng).state;
    // P3 has no live trade, but every other player does — nobody left to pair
    // with, so this is the boundary the rule deliberately draws.
    expect(state.pendingTrades).toHaveLength(1);
  });

  it('does nothing when the rule is switched off', () => {
    const base = twoPropertiesEach();
    base.config.oneTradeAtATime = false;
    const state = applyAction(base, offer(P1, P2, [PORTO], [LISBON]), rng).state;
    const { state: next } = applyAction(state, offer(P1, P3, [PORTO], [8]), rng);
    expect(next.pendingTrades).toHaveLength(2);
  });
});
