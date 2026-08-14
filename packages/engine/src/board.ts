import type { Board, OwnableTile, PropertyGroup, PropertyTile, Tile } from './board.types.js';
import { isOwnable } from './board.types.js';
import { boardEurope } from './data/board.europe.js';

export function boardSize(board: Board): number {
  return board.tiles.length;
}

export function hospitalTiles(board: Board): OwnableTile[] {
  return board.tiles.filter((tile) => tile.kind === 'hospital');
}

export function jailTileIndex(board: Board): number {
  const tile = board.tiles.find((t) => t.kind === 'jail');
  if (!tile) throw new Error('Board has no jail tile');
  return tile.index;
}

export function getTile(board: Board, index: number): Tile {
  const tile = board.tiles[index];
  if (!tile) throw new Error(`No tile at index ${index}`);
  return tile;
}

export function getOwnableTile(board: Board, index: number): OwnableTile {
  const tile = getTile(board, index);
  if (!isOwnable(tile)) throw new Error(`Tile ${index} is not ownable`);
  return tile;
}

export function groupTiles(board: Board, group: PropertyGroup): PropertyTile[] {
  return board.tiles.filter(
    (tile): tile is PropertyTile => tile.kind === 'property' && tile.group === group,
  );
}

export function airportTiles(board: Board): OwnableTile[] {
  return board.tiles.filter((tile) => tile.kind === 'airport');
}

export function utilityTiles(board: Board): OwnableTile[] {
  return board.tiles.filter((tile) => tile.kind === 'utility');
}

export { boardEurope, isOwnable };
