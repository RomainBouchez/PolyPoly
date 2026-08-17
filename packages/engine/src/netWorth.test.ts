import { describe, expect, it } from 'vitest';
import { FULL_SET_VALUE_MULTIPLIER, netWorth } from './rules.js';
import { freshState, P1, P2 } from './testUtils.js';

// Porto (60) + Lisbon (80) are the whole portugal group; Porto's house costs
// $30. Poros (100) belongs to greece, which P1 never completes here.
const PORTO = 1;
const LISBON = 3;
const POROS = 8;
const START = 1500;

const own = (state: ReturnType<typeof freshState>, tile: number, extra: Partial<{ houses: number; mortgaged: boolean }> = {}) => {
  state.ownership[tile] = { ownerId: P1, houses: 0, mortgaged: false, ...extra };
};

describe('net worth', () => {
  it('is just cash when nothing is owned', () => {
    expect(netWorth(freshState(), P1)).toBe(START);
  });

  it('counts a lone property at its price', () => {
    const state = freshState();
    own(state, POROS);
    expect(netWorth(state, P1)).toBe(START + 100);
  });

  // The premium is the point of the change: a country you can build on is
  // worth far more than the sum of its printed prices.
  it('doubles properties that complete a country', () => {
    const state = freshState();
    own(state, PORTO);
    own(state, LISBON);
    expect(netWorth(state, P1)).toBe(START + (60 + 80) * FULL_SET_VALUE_MULTIPLIER);
  });

  it('drops the premium the moment the set is broken', () => {
    const state = freshState();
    own(state, PORTO);
    own(state, LISBON);
    state.ownership[LISBON] = { ownerId: P2, houses: 0, mortgaged: false };
    expect(netWorth(state, P1)).toBe(START + 60);
  });

  it('counts houses at what they cost to build', () => {
    const state = freshState();
    own(state, PORTO, { houses: 3 });
    own(state, LISBON);
    expect(netWorth(state, P1)).toBe(START + (60 + 80) * FULL_SET_VALUE_MULTIPLIER + 3 * 30);
  });

  // Mortgaging hands over cash and drops the asset by the same amount, so it
  // should not move the total — otherwise raising cash would look like a gain.
  it('leaves the total unchanged when a property is mortgaged', () => {
    const before = freshState();
    own(before, POROS);
    const after = freshState();
    own(after, POROS, { mortgaged: true });
    after.players[P1]!.cash += 50; // the mortgage payout, price / 2

    expect(netWorth(after, P1)).toBe(netWorth(before, P1));
  });

  it('a mortgaged property gets no set premium', () => {
    const state = freshState();
    own(state, PORTO, { mortgaged: true });
    own(state, LISBON);
    expect(netWorth(state, P1)).toBe(START + 30 + 80 * FULL_SET_VALUE_MULTIPLIER);
  });

  it('subtracts a debt the player is currently settling', () => {
    const state = freshState();
    own(state, POROS);
    state.phase = { type: 'awaiting-debt-settlement', playerId: P1, creditorId: P2, amount: 400 };
    expect(netWorth(state, P1)).toBe(START + 100 - 400);
  });

  it('only subtracts the debt from whoever owes it', () => {
    const state = freshState();
    state.phase = { type: 'awaiting-debt-settlement', playerId: P1, creditorId: P2, amount: 400 };
    expect(netWorth(state, P2)).toBe(START);
  });
});
