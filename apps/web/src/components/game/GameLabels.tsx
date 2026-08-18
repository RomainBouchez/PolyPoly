import type { GameState } from '@polypoly/engine';
import { tileIcon } from '../board/BoardTile.js';

/** Player name in their token color, matching the dot convention in
 *  PlayersPanel. Shared by ActivityFeed and MatchStatsModal — lifted out once
 *  a third consumer needed it, rather than duplicating the lookup again. */
export function PlayerName({ state, playerId }: { state: GameState; playerId: string }) {
  const p = state.players[playerId];
  if (!p) return <span>{playerId}</span>;
  return (
    <span className="font-semibold" style={{ color: p.color }}>
      {p.name}
    </span>
  );
}

/** Tile name with its board emoji, so a city reads the same as it does on the board. */
export function TileLabel({ state, tileIndex }: { state: GameState; tileIndex: number }) {
  const tile = state.board.tiles[tileIndex];
  if (!tile) return <span>tile {tileIndex}</span>;
  const label =
    tile.kind === 'go' || tile.kind === 'jail' || tile.kind === 'vacation' || tile.kind === 'go-to-jail' || tile.kind === 'card'
      ? tile.kind === 'card'
        ? tile.deck === 'travel'
          ? 'Travel'
          : 'Customs'
        : tile.kind
      : tile.name;
  return (
    <span className="inline-flex items-center gap-1">
      <span>{tileIcon(tile)}</span>
      <span>{label}</span>
    </span>
  );
}
