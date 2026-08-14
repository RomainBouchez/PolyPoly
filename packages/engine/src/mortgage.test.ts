import { describe, expect, it } from 'vitest';
import { IllegalActionError } from './errors.js';
import { mortgageProperty, unmortgageProperty } from './mortgage.js';
import { freshState, P1 } from './testUtils.js';

// Tile 4 = Lisbon, price 80, mortgageValue 40.

describe('mortgage / unmortgage', () => {
  it('mortgaging pays the mortgage value and marks the tile', () => {
    const state = freshState();
    state.ownership[4] = { ownerId: P1, houses: 0, mortgaged: false };

    const amount = mortgageProperty(state, P1, 4);
    expect(amount).toBe(40);
    expect(state.players[P1]!.cash).toBe(1500 + 40);
    expect(state.ownership[4]!.mortgaged).toBe(true);
  });

  it('unmortgaging charges 10% interest on top of the mortgage value', () => {
    const state = freshState();
    state.ownership[4] = { ownerId: P1, houses: 0, mortgaged: true };
    state.players[P1]!.cash = 1000;

    const cost = unmortgageProperty(state, P1, 4);
    expect(cost).toBe(44); // 40 * 1.1
    expect(state.players[P1]!.cash).toBe(1000 - 44);
    expect(state.ownership[4]!.mortgaged).toBe(false);
  });

  it('rejects unmortgaging without enough cash', () => {
    const state = freshState();
    state.ownership[4] = { ownerId: P1, houses: 0, mortgaged: true };
    state.players[P1]!.cash = 10;
    expect(() => unmortgageProperty(state, P1, 4)).toThrow(IllegalActionError);
  });

  it('rejects mortgaging a property that still has houses', () => {
    const state = freshState();
    state.ownership[4] = { ownerId: P1, houses: 1, mortgaged: false };
    expect(() => mortgageProperty(state, P1, 4)).toThrow(IllegalActionError);
  });

  it('rejects mortgaging when the toggle is off', () => {
    const state = freshState({ mortgage: false });
    state.ownership[4] = { ownerId: P1, houses: 0, mortgaged: false };
    expect(() => mortgageProperty(state, P1, 4)).toThrow(IllegalActionError);
  });
});
