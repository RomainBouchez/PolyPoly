import { DEFAULT_GAME_CONFIG, type GameConfig } from '@polypoly/shared';
import { createRng } from './rng.js';
import { createInitialState, type NewPlayerInfo } from './state.js';
import type { GameState } from './types.js';

export const P1 = 'p1';
export const P2 = 'p2';
export const P3 = 'p3';

export const DEFAULT_PLAYERS: NewPlayerInfo[] = [
  { id: P1, name: 'Alice', color: 'red' },
  { id: P2, name: 'Bob', color: 'blue' },
  { id: P3, name: 'Cleo', color: 'green' },
];

export function freshState(config: Partial<GameConfig> = {}, players = DEFAULT_PLAYERS): GameState {
  return createInitialState({ ...DEFAULT_GAME_CONFIG, ...config }, players, createRng(1));
}

/** A fake Rng that returns a fixed queue of pip values, in order. */
export function scriptedRng(pips: number[]) {
  let i = 0;
  return {
    nextInt(_max: number): number {
      const value = pips[i];
      if (value === undefined) throw new Error(`scriptedRng exhausted at call ${i}`);
      i += 1;
      return value;
    },
  };
}
