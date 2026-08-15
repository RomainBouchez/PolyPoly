import { describe, expect, it } from 'vitest';
import { IllegalActionError } from './errors.js';
import { buildHouse, sellHouse } from './houses.js';
import { freshState, P1 } from './testUtils.js';

// Portugal group: tiles 1 (Porto,60), 3 (Lisbon,80). houseCost 30/40.

function ownFullPortugal(state: ReturnType<typeof freshState>) {
  state.ownership[1] = { ownerId: P1, houses: 0, mortgaged: false };
  state.ownership[3] = { ownerId: P1, houses: 0, mortgaged: false };
  state.players[P1]!.cash = 2000;
}

describe('buildHouse — even build', () => {
  it('rejects building a second house on one tile while siblings are still at zero', () => {
    const state = freshState({ evenBuild: true });
    ownFullPortugal(state);

    buildHouse(state, P1, 1);
    expect(() => buildHouse(state, P1, 1)).toThrow(IllegalActionError);
  });

  it('allows catching the other tiles up, then building further', () => {
    const state = freshState({ evenBuild: true });
    ownFullPortugal(state);

    buildHouse(state, P1, 1);
    buildHouse(state, P1, 3);
    expect(() => buildHouse(state, P1, 1)).not.toThrow();
    expect(state.ownership[1]!.houses).toBe(2);
  });

  it('does not enforce even build when the toggle is off', () => {
    const state = freshState({ evenBuild: false });
    ownFullPortugal(state);

    buildHouse(state, P1, 1);
    buildHouse(state, P1, 1);
    expect(state.ownership[1]!.houses).toBe(2);
  });
});

describe('buildHouse — bank supply', () => {
  it('rejects building a house when the bank has none left', () => {
    const state = freshState({ evenBuild: false, limitedHouseSupply: true });
    ownFullPortugal(state);
    state.bank.housesRemaining = 0;

    expect(() => buildHouse(state, P1, 1)).toThrow(IllegalActionError);
  });

  it('upgrading to a hotel returns 4 houses to the bank and consumes a hotel', () => {
    const state = freshState({ evenBuild: false, limitedHouseSupply: true });
    ownFullPortugal(state);
    state.ownership[1]!.houses = 4;
    state.bank.housesRemaining = 0;
    state.bank.hotelsRemaining = 1;

    const houses = buildHouse(state, P1, 1);
    expect(houses).toBe(5);
    expect(state.bank.housesRemaining).toBe(4);
    expect(state.bank.hotelsRemaining).toBe(0);
  });

  it('rejects the hotel upgrade when the bank has no hotels left', () => {
    const state = freshState({ evenBuild: false, limitedHouseSupply: true });
    ownFullPortugal(state);
    state.ownership[1]!.houses = 4;
    state.bank.hotelsRemaining = 0;

    expect(() => buildHouse(state, P1, 1)).toThrow(IllegalActionError);
  });
});

describe('buildHouse — ownership requirements', () => {
  it('rejects building without owning the full colour set', () => {
    const state = freshState();
    state.ownership[1] = { ownerId: P1, houses: 0, mortgaged: false };
    state.players[P1]!.cash = 2000;
    expect(() => buildHouse(state, P1, 1)).toThrow(IllegalActionError);
  });

  it('rejects building while a property in the set is mortgaged', () => {
    const state = freshState({ evenBuild: false });
    ownFullPortugal(state);
    state.ownership[3]!.mortgaged = true;
    expect(() => buildHouse(state, P1, 1)).toThrow(IllegalActionError);
  });
});

describe('sellHouse', () => {
  it('refunds half the house cost and returns it to the bank', () => {
    const state = freshState({ evenBuild: false });
    ownFullPortugal(state);
    buildHouse(state, P1, 1);
    const cashAfterBuild = state.players[P1]!.cash;

    const houses = sellHouse(state, P1, 1);
    expect(houses).toBe(0);
    expect(state.players[P1]!.cash).toBe(cashAfterBuild + 15); // half of houseCost 30
  });

  it('enforces even build when selling', () => {
    const state = freshState({ evenBuild: true });
    ownFullPortugal(state);
    buildHouse(state, P1, 1);
    // tile 1 at 1 house, tile 3 at 0 (the min) — selling from tile 3 is illegal
    expect(() => sellHouse(state, P1, 3)).toThrow(IllegalActionError);
    expect(() => sellHouse(state, P1, 1)).not.toThrow();
  });
});
