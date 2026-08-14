import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { IllegalActionError } from './errors.js';
import { freshState, P1, P2, scriptedRng } from './testUtils.js';

// Tile 1 = Sintra (P1's), tile 8 = Poros (P2's).

function tradeReadyState() {
  const state = freshState();
  state.ownership[1] = { ownerId: P1, houses: 0, mortgaged: false };
  state.ownership[8] = { ownerId: P2, houses: 0, mortgaged: false };
  return state;
}

describe('trade', () => {
  it('a multi-item trade (property + property + cash) executes on acceptance', () => {
    const state = tradeReadyState();
    const { state: proposed, events } = applyAction(
      state,
      {
        type: 'propose-trade',
        playerId: P1,
        toId: P2,
        fromCash: 50,
        toCash: 0,
        fromProperties: [1],
        toProperties: [8],
        fromJailCards: 0,
        toJailCards: 0,
      },
      scriptedRng([]),
    );
    const tradeId = (events.find((e) => e.type === 'trade-proposed') as { tradeId: number }).tradeId;

    const { state: after } = applyAction(proposed, { type: 'respond-trade', playerId: P2, tradeId, accept: true }, scriptedRng([]));

    expect(after.ownership[1]).toEqual({ ownerId: P2, houses: 0, mortgaged: false });
    expect(after.ownership[8]).toEqual({ ownerId: P1, houses: 0, mortgaged: false });
    expect(after.players[P1]!.cash).toBe(1500 - 50);
    expect(after.players[P2]!.cash).toBe(1500 + 50);
  });

  it('a declined trade changes nothing', () => {
    const state = tradeReadyState();
    const { state: proposed, events } = applyAction(
      state,
      { type: 'propose-trade', playerId: P1, toId: P2, fromCash: 0, toCash: 0, fromProperties: [1], toProperties: [], fromJailCards: 0, toJailCards: 0 },
      scriptedRng([]),
    );
    const tradeId = (events.find((e) => e.type === 'trade-proposed') as { tradeId: number }).tradeId;

    const { state: after } = applyAction(proposed, { type: 'respond-trade', playerId: P2, tradeId, accept: false }, scriptedRng([]));

    expect(after.ownership[1]).toEqual({ ownerId: P1, houses: 0, mortgaged: false });
    expect(after.pendingTrades).toHaveLength(0);
  });

  it('rejects proposing a property the proposer does not own', () => {
    const state = tradeReadyState();
    expect(() =>
      applyAction(
        state,
        { type: 'propose-trade', playerId: P1, toId: P2, fromCash: 0, toCash: 0, fromProperties: [8], toProperties: [], fromJailCards: 0, toJailCards: 0 },
        scriptedRng([]),
      ),
    ).toThrow(IllegalActionError);
  });

  it('only the proposer can cancel, only the recipient can respond', () => {
    const state = tradeReadyState();
    const { state: proposed, events } = applyAction(
      state,
      { type: 'propose-trade', playerId: P1, toId: P2, fromCash: 0, toCash: 0, fromProperties: [], toProperties: [], fromJailCards: 0, toJailCards: 0 },
      scriptedRng([]),
    );
    const tradeId = (events.find((e) => e.type === 'trade-proposed') as { tradeId: number }).tradeId;

    expect(() => applyAction(proposed, { type: 'cancel-trade', playerId: P2, tradeId }, scriptedRng([]))).toThrow(IllegalActionError);
    expect(() => applyAction(proposed, { type: 'respond-trade', playerId: P1, tradeId, accept: true }, scriptedRng([]))).toThrow(IllegalActionError);
  });
});
