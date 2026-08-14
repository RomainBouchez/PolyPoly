import type { GameState, Tile } from '@polypoly/engine';
import type { CSSProperties } from 'react';
import { GROUP_COLORS, GROUP_FLAGS, type TileSide } from './tileLayout.js';

interface BoardTileProps {
  tile: Tile;
  state: GameState;
  position: { row: number; col: number };
  /** Undefined for corner tiles — they don't face a printed edge. */
  side?: TileSide;
  onSelect?: (tileIndex: number) => void;
}

const BAND_THICKNESS = 5;
const OWNABLE_KINDS = new Set<Tile['kind']>(['property', 'airport', 'utility', 'hospital']);

export function BoardTile({ tile, state, position, side, onSelect }: BoardTileProps) {
  const ownership = state.ownership[tile.index];
  const owner = ownership ? state.players[ownership.ownerId] : null;
  const playersHere = Object.values(state.players).filter((p) => p.position === tile.index);
  const isOwnable = OWNABLE_KINDS.has(tile.kind);
  const groupColor = tile.kind === 'property' ? GROUP_COLORS[tile.group] : undefined;

  const bandStyle: CSSProperties =
    owner && side
      ? side === 'top' || side === 'bottom'
        ? { [side]: 0, left: 0, right: 0, height: BAND_THICKNESS, backgroundColor: owner.color }
        : { [side]: 0, top: 0, bottom: 0, width: BAND_THICKNESS, backgroundColor: owner.color }
      : {};

  // The country colour lives on the tile's inner edge — the opposite side
  // from the owner band, same as a physical board's printed colour strip.
  const innerSide = side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left';
  const groupBandStyle: CSSProperties =
    groupColor && side
      ? innerSide === 'top' || innerSide === 'bottom'
        ? { [innerSide]: 0, left: 0, right: 0, height: '30%', backgroundColor: groupColor }
        : { [innerSide]: 0, top: 0, bottom: 0, width: '30%', backgroundColor: groupColor }
      : {};

  // Side columns get their label rotated so it reads along the board's edge,
  // same convention as a physical Monopoly board.
  const labelStyle: CSSProperties =
    side === 'left'
      ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)' }
      : side === 'right'
        ? { writingMode: 'vertical-rl' }
        : {};

  return (
    <button
      type="button"
      onClick={() => isOwnable && onSelect?.(tile.index)}
      style={{ gridRow: position.row, gridColumn: position.col }}
      className={`relative flex flex-col items-center justify-between overflow-hidden rounded-md bg-slate-950 p-1 text-center text-[10px] leading-tight ${
        isOwnable ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
      }`}
    >
      {groupColor && <div className="absolute z-0" style={groupBandStyle} />}
      {owner && <div className="absolute z-10" style={bandStyle} />}

      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-0.5">
        {tile.kind === 'property' && ownership && ownership.houses > 0 && (
          <span className="flex items-center gap-0.5 text-amber-300">
            {ownership.houses === 5 ? '🏨' : <>🏠×{ownership.houses}</>}
          </span>
        )}
        <span
          className="line-clamp-2 w-full min-h-0 flex-1 break-words font-medium text-slate-100"
          style={labelStyle}
        >
          {tileLabel(tile)}
        </span>
        {(tile.kind === 'property' || tile.kind === 'airport' || tile.kind === 'utility' || tile.kind === 'hospital') && (
          <span className="text-slate-500">${tile.price}</span>
        )}
        {ownership?.mortgaged && <span className="text-amber-500">mortgaged</span>}
      </div>

      {playersHere.length > 0 && (
        <div className="relative z-10 mt-0.5 flex flex-wrap justify-center gap-0.5">
          {playersHere.map((p) => (
            <span
              key={p.id}
              title={p.name}
              className="h-2.5 w-2.5 rounded-full border border-slate-950"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
      )}
    </button>
  );
}

function tileLabel(tile: Tile): string {
  switch (tile.kind) {
    case 'property':
      return `${GROUP_FLAGS[tile.group]} ${tile.name}`;
    case 'airport':
      return `✈️ ${tile.name}`;
    case 'utility':
      return `⚡ ${tile.name}`;
    case 'hospital':
      return `🏥 ${tile.name}`;
    case 'tax':
      return `💸 ${tile.name}`;
    case 'card':
      return tile.deck === 'travel' ? '🧳 Travel' : '🛃 Customs';
    case 'go':
      return '➡️ GO';
    case 'jail':
      return '🚔 Jail';
    case 'vacation':
      return '🏖️ Vacation';
    case 'go-to-jail':
      return '👮 Go to Jail';
  }
}
