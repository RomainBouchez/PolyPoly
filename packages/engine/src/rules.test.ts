import { describe, expect, it } from 'vitest';
import { computeRent } from './rules.js';
import { freshState, P2 } from './testUtils.js';

// Board indices used below (see data/board.europe.ts):
//  8,9,10  = Greece group (Poros 100, Naxos 100, Athens 120)
//  16      = Ferry Company (utility)
//  5,17    = airports (Lisbon, Oslo)

describe('computeRent', () => {
  it('is 0 for an unowned tile', () => {
    const state = freshState();
    expect(computeRent(state, 10, 6)).toBe(0);
  });

  it('charges base rent for a single owned property with no houses', () => {
    const state = freshState();
    state.ownership[10] = { ownerId: P2, houses: 0, mortgaged: false };
    const tile = state.board.tiles[10]!;
    if (tile.kind !== 'property') throw new Error('expected property tile');
    expect(computeRent(state, 10, 6)).toBe(tile.rentLadder[0]);
  });

  it('doubles base rent when the owner has the full colour set and the toggle is on', () => {
    const state = freshState({ doubleRentOnFullSet: true });
    state.ownership[8] = { ownerId: P2, houses: 0, mortgaged: false };
    state.ownership[9] = { ownerId: P2, houses: 0, mortgaged: false };
    state.ownership[10] = { ownerId: P2, houses: 0, mortgaged: false };
    const tile = state.board.tiles[10]!;
    if (tile.kind !== 'property') throw new Error('expected property tile');
    expect(computeRent(state, 10, 6)).toBe(tile.rentLadder[0] * 2);
  });

  it('does not double rent when the toggle is off, even with a full set', () => {
    const state = freshState({ doubleRentOnFullSet: false });
    state.ownership[8] = { ownerId: P2, houses: 0, mortgaged: false };
    state.ownership[9] = { ownerId: P2, houses: 0, mortgaged: false };
    state.ownership[10] = { ownerId: P2, houses: 0, mortgaged: false };
    const tile = state.board.tiles[10]!;
    if (tile.kind !== 'property') throw new Error('expected property tile');
    expect(computeRent(state, 10, 6)).toBe(tile.rentLadder[0]);
  });

  it('is 0 for a mortgaged property', () => {
    const state = freshState();
    state.ownership[10] = { ownerId: P2, houses: 0, mortgaged: true };
    expect(computeRent(state, 10, 6)).toBe(0);
  });

  it('is 0 when noRentInPrison is on and the owner is in jail', () => {
    const state = freshState({ noRentInPrison: true });
    state.ownership[10] = { ownerId: P2, houses: 0, mortgaged: false };
    state.players[P2]!.inJail = true;
    expect(computeRent(state, 10, 6)).toBe(0);
  });

  it('charges 25/50/100/200 for airports based on how many the owner holds', () => {
    const state = freshState();
    state.ownership[5] = { ownerId: P2, houses: 0, mortgaged: false };
    expect(computeRent(state, 5, 6)).toBe(25);
    state.ownership[17] = { ownerId: P2, houses: 0, mortgaged: false };
    expect(computeRent(state, 5, 6)).toBe(50);
  });

  it('charges dice x4 for one utility and dice x10 for both', () => {
    const state = freshState();
    state.ownership[16] = { ownerId: P2, houses: 0, mortgaged: false };
    expect(computeRent(state, 16, 6)).toBe(24);
    state.ownership[27] = { ownerId: P2, houses: 0, mortgaged: false };
    expect(computeRent(state, 16, 6)).toBe(60);
  });

  it('is 0 for a hospital, regardless of ownership', () => {
    const state = freshState();
    expect(computeRent(state, 6, 6)).toBe(0); // Central Hospital, unowned
    state.ownership[6] = { ownerId: P2, houses: 0, mortgaged: false };
    expect(computeRent(state, 6, 6)).toBe(0); // owned — still no landing rent
  });
});
