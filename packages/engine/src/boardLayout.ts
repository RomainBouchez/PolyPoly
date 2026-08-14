import type { Board, Tile } from './board.types.js';

export type TileSide = 'top' | 'bottom' | 'left' | 'right';

export interface BoardLayout {
  /** The grid is gridSize x gridSize. */
  gridSize: number;
  positions: Record<number, { row: number; col: number }>;
  /** Which edge of the board a tile faces — corners have none. */
  sides: Record<number, TileSide>;
}

const CORNER_KINDS = new Set<Tile['kind']>(['go', 'jail', 'vacation', 'go-to-jail']);

/**
 * Lays any ring-shaped board out on a square grid, deriving the grid size and
 * every tile's cell from where the 4 corner tiles actually sit — no
 * assumption about 40 tiles or equal side lengths. A side shorter than the
 * longest one just leaves an empty cell near its far corner.
 */
export function computeBoardLayout(board: Board): BoardLayout {
  const tiles = board.tiles;
  const N = tiles.length;
  const corners = tiles.filter((t) => CORNER_KINDS.has(t.kind)).sort((a, b) => a.index - b.index);
  if (corners.length !== 4) {
    throw new Error(`Board must have exactly 4 corner tiles, found ${corners.length}`);
  }

  const goIdx = corners.findIndex((c) => c.kind === 'go');
  const ordered = [...corners.slice(goIdx), ...corners.slice(0, goIdx)];
  const [c0, c1, c2, c3] = ordered as [Tile, Tile, Tile, Tile];

  const segLen = (fromIndex: number, toIndex: number) => (toIndex - fromIndex - 1 + N) % N;
  const tilesBetween = (fromIndex: number, len: number) =>
    Array.from({ length: len }, (_, i) => (fromIndex + i + 1) % N);

  const side1 = segLen(c0.index, c1.index); // go -> jail (bottom row)
  const side2 = segLen(c1.index, c2.index); // jail -> vacation (left column)
  const side3 = segLen(c2.index, c3.index); // vacation -> go-to-jail (top row)
  const side4 = segLen(c3.index, c0.index); // go-to-jail -> go (right column)
  const gridSize = Math.max(side1, side2, side3, side4) + 2;

  const positions: Record<number, { row: number; col: number }> = {
    [c0.index]: { row: gridSize, col: gridSize },
    [c1.index]: { row: gridSize, col: 1 },
    [c2.index]: { row: 1, col: 1 },
    [c3.index]: { row: 1, col: gridSize },
  };
  const sides: Record<number, TileSide> = {};

  tilesBetween(c0.index, side1).forEach((tileIndex, i) => {
    positions[tileIndex] = { row: gridSize, col: gridSize - (i + 1) };
    sides[tileIndex] = 'bottom';
  });
  tilesBetween(c1.index, side2).forEach((tileIndex, i) => {
    positions[tileIndex] = { row: gridSize - (i + 1), col: 1 };
    sides[tileIndex] = 'left';
  });
  tilesBetween(c2.index, side3).forEach((tileIndex, i) => {
    positions[tileIndex] = { row: 1, col: 1 + (i + 1) };
    sides[tileIndex] = 'top';
  });
  tilesBetween(c3.index, side4).forEach((tileIndex, i) => {
    positions[tileIndex] = { row: 1 + (i + 1), col: gridSize };
    sides[tileIndex] = 'right';
  });

  return { gridSize, positions, sides };
}
