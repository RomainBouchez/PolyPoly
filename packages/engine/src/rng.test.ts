import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const rollsA = Array.from({ length: 20 }, () => a.nextInt(6));
    const rollsB = Array.from({ length: 20 }, () => b.nextInt(6));
    expect(rollsA).toEqual(rollsB);
  });

  it('stays within [1, max]', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const roll = rng.nextInt(6);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    }
  });
});
