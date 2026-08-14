import { DEFAULT_GAME_CONFIG } from '@polypoly/shared';
import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { getLegalActions } from './legalActions.js';
import { createRng } from './rng.js';
import { createInitialState } from './state.js';
import { DEFAULT_PLAYERS } from './testUtils.js';
import type { GameState, PlayerId } from './types.js';

function actingPlayerId(state: GameState): PlayerId {
  const phase = state.phase;
  if (phase.type === 'auction') return phase.turnPlayerId;
  if ('playerId' in phase) return phase.playerId;
  return state.turnOrder[state.currentPlayerIndex]!;
}

/** Always takes the first legal action for whoever's turn it is. Deterministic
 *  given a seed, so it's a stand-in for "a real game's worth of actions". */
function autoplay(seed: number, steps: number): GameState {
  let state = createInitialState(DEFAULT_GAME_CONFIG, DEFAULT_PLAYERS, createRng(seed));
  const rng = createRng(seed + 1);
  for (let i = 0; i < steps; i++) {
    if (state.phase.type === 'game-over') break;
    const legal = getLegalActions(state, actingPlayerId(state));
    if (legal.length === 0) break;
    state = applyAction(state, legal[0]!, rng).state;
  }
  return state;
}

describe('replay determinism', () => {
  it('produces an identical final state when replayed from the same seed', () => {
    const first = autoplay(7, 40);
    const second = autoplay(7, 40);
    expect(second).toEqual(first);
  });

  it('diverges when the seed changes', () => {
    const a = autoplay(1, 40);
    const b = autoplay(2, 40);
    expect(a).not.toEqual(b);
  });
});
