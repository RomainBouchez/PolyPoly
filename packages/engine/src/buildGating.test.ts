import { describe, expect, it } from 'vitest';
import { buildHouse } from './houses.js';
import { getLegalActions } from './legalActions.js';
import { freshState, P1, P2 } from './testUtils.js';

// Porto (1) + Lisbon (3) are the whole portugal group. Porto's houseCost is
// 30, Lisbon's 40 — see rentLadder/houseCost in data/board.europe.ts.
const PORTO = 1;
const LISBON = 3;

function ownWholeSet(cash: number) {
  const state = freshState();
  state.ownership[PORTO] = { ownerId: P1, houses: 0, mortgaged: false };
  state.ownership[LISBON] = { ownerId: P1, houses: 0, mortgaged: false };
  state.players[P1]!.cash = cash;
  return state;
}

const buildsFor = (state: ReturnType<typeof ownWholeSet>, playerId: string) =>
  getLegalActions(state, playerId).filter((a) => a.type === 'build-house');

describe('build-house is only offered when it would actually succeed', () => {
  it('is offered when the set is complete and the player can pay', () => {
    expect(buildsFor(ownWholeSet(500), P1)).toHaveLength(2);
  });

  // The regression: the offer used to ignore cash entirely, so the button
  // appeared and the action was then refused — with nothing shown to explain.
  it('is withheld when the player cannot afford the cheapest house', () => {
    expect(buildsFor(ownWholeSet(10), P1)).toEqual([]);
  });

  it('offers only the properties the player can actually afford', () => {
    // $35 covers Porto's $30 house but not Lisbon's $40.
    const offered = buildsFor(ownWholeSet(35), P1).map((a) => (a as { tileIndex: number }).tileIndex);
    expect(offered).toEqual([PORTO]);
  });

  it('never offers a build the executor would reject', () => {
    for (const cash of [0, 25, 30, 39, 40, 200]) {
      const state = ownWholeSet(cash);
      for (const action of buildsFor(state, P1)) {
        const tileIndex = (action as { tileIndex: number }).tileIndex;
        expect(() => buildHouse(structuredClone(state), P1, tileIndex)).not.toThrow();
      }
    }
  });

  it('is withheld while a property in the set is mortgaged', () => {
    const state = ownWholeSet(500);
    state.ownership[PORTO]!.mortgaged = true;
    expect(buildsFor(state, P1)).toEqual([]);
  });

  it('is withheld when the set is incomplete', () => {
    const state = ownWholeSet(500);
    state.ownership[LISBON] = { ownerId: P2, houses: 0, mortgaged: false };
    expect(buildsFor(state, P1)).toEqual([]);
  });
});

describe('unmortgage is only offered when affordable', () => {
  it('is withheld when the player cannot cover the interest', () => {
    const state = ownWholeSet(5);
    state.ownership[PORTO]!.mortgaged = true;
    expect(getLegalActions(state, P1).filter((a) => a.type === 'unmortgage')).toEqual([]);
  });

  it('is offered once the player can pay', () => {
    const state = ownWholeSet(500);
    state.ownership[PORTO]!.mortgaged = true;
    expect(getLegalActions(state, P1).filter((a) => a.type === 'unmortgage')).toHaveLength(1);
  });
});
