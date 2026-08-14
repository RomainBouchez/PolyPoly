import { describe, expect, it } from 'vitest';
import { bankrupt, chargePlayer, settleDebt } from './debt.js';
import { IllegalActionError } from './errors.js';
import { freshState, P1, P2 } from './testUtils.js';

describe('chargePlayer', () => {
  it('deducts and pays the creditor when the player can afford it', () => {
    const state = freshState();
    const paid = chargePlayer(state, P1, 50, P2, []);
    expect(paid).toBe(true);
    expect(state.players[P1]!.cash).toBe(1450);
    expect(state.players[P2]!.cash).toBe(1550);
  });

  it('parks the game in awaiting-debt-settlement when the player cannot afford it', () => {
    const state = freshState();
    state.players[P1]!.cash = 10;
    const evts: import('./types.js').GameEvent[] = [];
    const paid = chargePlayer(state, P1, 50, P2, evts);

    expect(paid).toBe(false);
    expect(state.players[P1]!.cash).toBe(10); // untouched, not partially deducted
    expect(state.phase).toEqual({ type: 'awaiting-debt-settlement', playerId: P1, creditorId: P2, amount: 50 });
    expect(evts.some((e) => e.type === 'debt-pending')).toBe(true);
  });
});

describe('settleDebt', () => {
  it('pays off the debt once the player can afford it', () => {
    const state = freshState();
    state.players[P1]!.cash = 100;
    state.phase = { type: 'awaiting-debt-settlement', playerId: P1, creditorId: P2, amount: 50 };

    settleDebt(state, P1, []);
    expect(state.players[P1]!.cash).toBe(50);
    expect(state.players[P2]!.cash).toBe(1550);
  });

  it('rejects settling if still short', () => {
    const state = freshState();
    state.players[P1]!.cash = 10;
    state.phase = { type: 'awaiting-debt-settlement', playerId: P1, creditorId: P2, amount: 50 };
    expect(() => settleDebt(state, P1, [])).toThrow(IllegalActionError);
  });
});

describe('bankrupt', () => {
  it('transfers properties and remaining cash to a player creditor', () => {
    const state = freshState();
    state.players[P1]!.cash = 30;
    state.ownership[1] = { ownerId: P1, houses: 0, mortgaged: false };
    state.phase = { type: 'awaiting-debt-settlement', playerId: P1, creditorId: P2, amount: 200 };

    bankrupt(state, P1, []);

    expect(state.ownership[1]!.ownerId).toBe(P2);
    expect(state.players[P1]!.status).toBe('bankrupt');
    expect(state.players[P1]!.cash).toBe(0);
    expect(state.players[P2]!.cash).toBe(1500 + 30);
  });

  it('returns properties and houses to the bank when the creditor is the bank', () => {
    const state = freshState();
    state.ownership[1] = { ownerId: P1, houses: 2, mortgaged: false };
    state.bank.housesRemaining = 10;
    state.phase = { type: 'awaiting-debt-settlement', playerId: P1, creditorId: 'bank', amount: 200 };

    bankrupt(state, P1, []);

    expect(state.ownership[1]).toBeUndefined();
    expect(state.bank.housesRemaining).toBe(12);
    expect(state.players[P1]!.status).toBe('bankrupt');
  });
});
