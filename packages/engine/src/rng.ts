export interface Rng {
  /** Integer in [1, max], inclusive. */
  nextInt(max: number): number;
}

/** Mulberry32 — small, fast, deterministic from a 32-bit seed. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    nextInt(max: number): number {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const float = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(float * max) + 1;
    },
  };
}
