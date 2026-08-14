import { describe, expect, it } from 'vitest';
import { boardEurope } from './board.js';
import { computeBoardLayout } from './boardLayout.js';
import type { Board } from './board.types.js';

describe('computeBoardLayout', () => {
  it('places all 43 tiles with no collisions and no overflow past the grid', () => {
    const layout = computeBoardLayout(boardEurope);
    expect(Object.keys(layout.positions)).toHaveLength(boardEurope.tiles.length);

    const seen = new Set<string>();
    for (const tile of boardEurope.tiles) {
      const pos = layout.positions[tile.index]!;
      expect(pos.row).toBeGreaterThanOrEqual(1);
      expect(pos.row).toBeLessThanOrEqual(layout.gridSize);
      expect(pos.col).toBeGreaterThanOrEqual(1);
      expect(pos.col).toBeLessThanOrEqual(layout.gridSize);
      const key = `${pos.row},${pos.col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('sizes the grid to fit the longest side, tolerating an uneven one (10/10/10/9)', () => {
    const layout = computeBoardLayout(boardEurope);
    // 4 corners + longest side (10) + 2 = 12x12
    expect(layout.gridSize).toBe(12);
  });

  it('reproduces the original 11x11 layout for a classic 40-tile board (regression guard)', () => {
    const classicBoard: Board = {
      tiles: boardEurope.tiles
        .filter((t) => !(t.kind === 'hospital'))
        .map((t, i) => ({ ...t, index: i })) as Board['tiles'],
    };
    const layout = computeBoardLayout(classicBoard);
    expect(layout.gridSize).toBe(11);
    expect(layout.positions[0]).toEqual({ row: 11, col: 11 }); // Go
    expect(layout.positions[10]).toEqual({ row: 11, col: 1 }); // Jail
    expect(layout.positions[20]).toEqual({ row: 1, col: 1 }); // Vacation
    expect(layout.positions[30]).toEqual({ row: 1, col: 11 }); // Go To Jail
    expect(layout.sides[1]).toBe('bottom');
    expect(layout.sides[11]).toBe('left');
    expect(layout.sides[21]).toBe('top');
    expect(layout.sides[31]).toBe('right');
  });
});
