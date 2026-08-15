import { describe, expect, it } from 'vitest';
import { getLegalActions } from './legalActions.js';
import { freshState, P1, P2 } from './testUtils.js';

describe('getLegalActions', () => {
  it('offers only roll to the active player in awaiting-roll', () => {
    const state = freshState();
    expect(getLegalActions(state, P1)).toEqual([{ type: 'roll', playerId: P1 }]);
  });

  it('offers nothing to a player whose turn it is not', () => {
    const state = freshState();
    expect(getLegalActions(state, P2)).toEqual([]);
  });

  it('offers buy + decline when cash covers the price, decline only when it does not', () => {
    const state = freshState();
    state.phase = { type: 'awaiting-purchase', playerId: P1, tileIndex: 3 }; // Lisbon, 80
    expect(getLegalActions(state, P1)).toEqual([
      { type: 'buy', playerId: P1 },
      { type: 'decline-purchase', playerId: P1 },
    ]);

    state.players[P1]!.cash = 10;
    expect(getLegalActions(state, P1)).toEqual([{ type: 'decline-purchase', playerId: P1 }]);
  });

  it('offers pay-jail-fine + roll-for-jail when cash covers the fine, roll-for-jail only otherwise', () => {
    const state = freshState();
    state.phase = { type: 'awaiting-jail-decision', playerId: P1 };
    expect(getLegalActions(state, P1)).toEqual([
      { type: 'roll-for-jail', playerId: P1 },
      { type: 'pay-jail-fine', playerId: P1 },
    ]);

    state.players[P1]!.cash = 10;
    expect(getLegalActions(state, P1)).toEqual([{ type: 'roll-for-jail', playerId: P1 }]);
  });
});
