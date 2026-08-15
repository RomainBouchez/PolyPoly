import { describe, expect, it } from 'vitest';
import { IllegalActionError } from './errors.js';
import { mortgageProperty, unmortgageProperty } from './mortgage.js';
import { freshState, P1, P2 } from './testUtils.js';

// Tile 3 = Lisbon, price 80, mortgageValue 40.

describe('mortgage / unmortgage', () => {
  it('mortgaging pays the mortgage value and marks the tile', () => {
    const state = freshState();
    state.ownership[3] = { ownerId: P1, houses: 0, mortgaged: false };

    const amount = mortgageProperty(state, P1, 3);
    expect(amount).toBe(40);
    expect(state.players[P1]!.cash).toBe(1500 + 40);
    expect(state.ownership[3]!.mortgaged).toBe(true);
  });

  it('unmortgaging charges 10% interest on top of the mortgage value', () => {
    const state = freshState();
    state.ownership[3] = { ownerId: P1, houses: 0, mortgaged: true };
    state.players[P1]!.cash = 1000;

    const cost = unmortgageProperty(state, P1, 3);
    expect(cost).toBe(44); // 40 * 1.1
    expect(state.players[P1]!.cash).toBe(1000 - 44);
    expect(state.ownership[3]!.mortgaged).toBe(false);
  });

  it('rejects unmortgaging without enough cash', () => {
    const state = freshState();
    state.ownership[3] = { ownerId: P1, houses: 0, mortgaged: true };
    state.players[P1]!.cash = 10;
    expect(() => unmortgageProperty(state, P1, 3)).toThrow(IllegalActionError);
  });

  it('rejects mortgaging a property that still has houses', () => {
    const state = freshState();
    state.ownership[3] = { ownerId: P1, houses: 1, mortgaged: false };
    expect(() => mortgageProperty(state, P1, 3)).toThrow(IllegalActionError);
  });

  it('rejects mortgaging when the toggle is off', () => {
    const state = freshState({ mortgage: false });
    state.ownership[3] = { ownerId: P1, houses: 0, mortgaged: false };
    expect(() => mortgageProperty(state, P1, 3)).toThrow(IllegalActionError);
  });

  it('rejects mortgaging when it is not the owner\'s turn', () => {
    const state = freshState(); // turn order p1,p2,p3 — it's P1's turn
    state.ownership[3] = { ownerId: P2, houses: 0, mortgaged: false };
    expect(() => mortgageProperty(state, P2, 3)).toThrow(IllegalActionError);
  });

  it('rejects unmortgaging when it is not the owner\'s turn', () => {
    const state = freshState();
    state.ownership[3] = { ownerId: P2, houses: 0, mortgaged: true };
    expect(() => unmortgageProperty(state, P2, 3)).toThrow(IllegalActionError);
  });
});
