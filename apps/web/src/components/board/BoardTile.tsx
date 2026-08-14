import type { GameState, Tile } from '@polypoly/engine';
import type { CSSProperties } from 'react';
import { GROUP_FLAG_SVG, type TileSide } from './tileLayout.js';

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
  const flagSvg = tile.kind === 'property' ? GROUP_FLAG_SVG[tile.group] : undefined;
  const currentTurnPlayerId =
    state.phase.type !== 'game-over' ? state.turnOrder[state.currentPlayerIndex] : undefined;

  const bandStyle: CSSProperties =
    owner && side
      ? side === 'top' || side === 'bottom'
        ? { [side]: 0, left: 0, right: 0, height: BAND_THICKNESS, backgroundColor: owner.color }
        : { [side]: 0, top: 0, bottom: 0, width: BAND_THICKNESS, backgroundColor: owner.color }
      : {};

  // The country flag badge sits on the tile's inner edge — the opposite side
  // from the owner band — with its center exactly on the boundary between
  // the tile and the board's center area, poking out past the tile itself.
  const innerSide = side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left';
  const flagStyle: CSSProperties =
    flagSvg && side
      ? innerSide === 'top' || innerSide === 'bottom'
        ? { [innerSide]: 0, left: '50%', transform: `translate(-50%, ${innerSide === 'top' ? '-50%' : '50%'})` }
        : { [innerSide]: 0, top: '50%', transform: `translate(${innerSide === 'left' ? '-50%' : '50%'}, -50%)` }
      : {};

  // Side columns get their label rotated so it reads along the board's edge,
  // same convention as a physical Monopoly board. The icon is counter-rotated
  // on the left side so it stays upright.
  const labelStyle: CSSProperties =
    side === 'left'
      ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)' }
      : side === 'right'
        ? { writingMode: 'vertical-rl' }
        : {};
  const iconStyle: CSSProperties = side === 'left' ? { transform: 'rotate(180deg)' } : {};

  return (
    <button
      type="button"
      onClick={() => isOwnable && onSelect?.(tile.index)}
      style={{ gridRow: position.row, gridColumn: position.col }}
      className={`relative flex flex-col items-center justify-between overflow-visible rounded-md bg-slate-950 p-1 text-center text-[10px] leading-tight ${
        isOwnable ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
      }`}
    >
      {owner && <div className="absolute z-10" style={bandStyle} />}

      {ownership && tile.kind === 'property' && ownership.houses > 0 && owner && (
        <div
          className="absolute left-0.5 top-0.5 z-10 whitespace-nowrap rounded-full border border-white/35 px-1 py-px text-[9px] font-extrabold text-white"
          style={{ backgroundColor: owner.color, textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
        >
          {ownership.houses === 5 ? '🏨' : ownership.houses > 1 ? `🏠×${ownership.houses}` : '🏠'}
        </div>
      )}

      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-0.5">
        <span className="text-sm leading-none" style={iconStyle}>
          {tileIcon(tile)}
        </span>
        <span
          className="line-clamp-2 w-full min-h-0 flex-1 break-words font-medium text-slate-100"
          style={labelStyle}
        >
          {tileName(tile)}
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
              className={`flex h-3 w-3 items-center justify-center rounded-full border border-slate-950 ${
                p.id === currentTurnPlayerId ? 'animate-pulse ring-2 ring-white' : ''
              }`}
              style={{
                backgroundColor: p.color,
                boxShadow: p.id === currentTurnPlayerId ? `0 0 6px 2px ${p.color}` : undefined,
              }}
            />
          ))}
        </div>
      )}

      {flagSvg && (
        <div
          className="absolute z-20 h-4 w-4 overflow-hidden rounded-full border border-white/35 shadow"
          style={flagStyle}
          dangerouslySetInnerHTML={{ __html: flagSvg }}
        />
      )}
    </button>
  );
}

function tileName(tile: Tile): string {
  return tile.kind === 'card' ? (tile.deck === 'travel' ? 'Travel' : 'Customs') : tile.name;
}

function tileIcon(tile: Tile): string {
  switch (tile.kind) {
    case 'property':
      return tile.emoji;
    case 'airport':
      return '✈️';
    case 'utility':
      return '⚡';
    case 'hospital':
      return '🏥';
    case 'tax':
      return '💸';
    case 'card':
      return tile.deck === 'travel' ? '🧳' : '🛃';
    case 'go':
      return '➡️';
    case 'jail':
      return '🚔';
    case 'vacation':
      return '🏖️';
    case 'go-to-jail':
      return '👮';
  }
}
