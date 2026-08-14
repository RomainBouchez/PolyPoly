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

const BAND_THICKNESS = 6;
const OWNABLE_KINDS = new Set<Tile['kind']>(['property', 'airport', 'utility', 'hospital']);
const PANEL = '#0f1420';
const PANEL_CORNER = '#141b2b';

export function BoardTile({ tile, state, position, side, onSelect }: BoardTileProps) {
  const ownership = state.ownership[tile.index];
  const owner = ownership ? state.players[ownership.ownerId] : null;
  const playersHere = Object.values(state.players).filter((p) => p.position === tile.index);
  const isOwnable = OWNABLE_KINDS.has(tile.kind);
  const isCorner = !side;
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
  // `top/left/right/bottom: 0` pins the badge's edge to the tile's edge, then
  // the transform shifts it by half of the BADGE's own size (not the tile's
  // — percentages on top/left are relative to the containing tile, but
  // transform % is relative to the element itself) so it straddles the line
  // evenly regardless of tile size.
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
      style={{ gridRow: position.row, gridColumn: position.col, backgroundColor: isCorner ? PANEL_CORNER : PANEL }}
      className={`relative flex flex-col overflow-visible rounded-md p-1 text-center text-[10px] leading-tight ${
        isOwnable ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
      }`}
    >
      {/* Everything that must stay inside the tile's rounded corners (owner
          band, mortgage stripe) is clipped to the tile's own border-radius —
          the flag badge and player tokens are siblings so they can render
          past the tile edge. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-md">
        {owner && <div className="absolute" style={bandStyle} />}
        {ownership?.mortgaged && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(0,0,0,0.55) 0 6px, rgba(0,0,0,0.35) 6px 12px)',
            }}
          />
        )}
      </div>

      {ownership && tile.kind === 'property' && ownership.houses > 0 && owner && (
        <div
          className="absolute left-[3px] top-[3px] z-10 whitespace-nowrap rounded-full border border-white/35 px-1 py-px text-[clamp(8px,1.1vw,12px)] font-extrabold text-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          style={{ backgroundColor: owner.color, textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
        >
          {ownership.houses === 5 ? '🏨' : ownership.houses > 1 ? `🏠×${ownership.houses}` : '🏠'}
        </div>
      )}

      <div className="relative z-[2] flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center">
        <span
          className={`leading-none ${isCorner ? 'text-[clamp(16px,2.4vw,28px)]' : 'text-[clamp(11px,1.6vw,18px)]'}`}
          style={iconStyle}
        >
          {tileIcon(tile)}
        </span>
        <span
          className={`line-clamp-2 w-full min-h-0 flex-1 break-words font-bold text-slate-100 ${
            isCorner ? 'text-[clamp(9px,1.2vw,13px)] tracking-[0.02em]' : 'text-[clamp(8px,1.05vw,12px)]'
          }`}
          style={{ ...labelStyle, lineHeight: 1.05, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {tileName(tile)}
        </span>
        {(tile.kind === 'property' || tile.kind === 'airport' || tile.kind === 'utility' || tile.kind === 'hospital') && (
          <span className="text-[clamp(7px,0.9vw,10px)] font-semibold text-[#8993ac]">${tile.price}</span>
        )}
      </div>

      {/* Player tokens overlay the whole tile, centered — not a flow item
          pushed to one edge, so they stay visible regardless of how much
          text the tile has. */}
      {playersHere.length > 0 && (
        <div
          className={`pointer-events-none absolute inset-0 z-[3] flex flex-wrap items-center justify-center gap-0.5 p-[10%] ${
            side === 'left' || side === 'right' ? 'flex-col' : ''
          }`}
        >
          {playersHere.map((p) => {
            const isTurn = p.id === currentTurnPlayerId;
            return (
              <span
                key={p.id}
                title={p.name}
                className="relative flex aspect-square w-[clamp(14px,2vw,22px)] items-center justify-center rounded-full border-2 text-[clamp(7px,1vw,10px)] font-extrabold"
                style={{
                  backgroundColor: p.color,
                  borderColor: 'rgba(5,7,13,0.9)',
                  color: '#061018',
                  boxShadow: isTurn
                    ? `0 1px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.35), 0 0 0 3px ${p.color}, 0 0 10px 3px ${p.color}`
                    : '0 1px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.25)',
                  animation: isTurn ? 'token-pulse 1.4s ease-in-out infinite' : undefined,
                  ['--glow-color' as string]: p.color,
                }}
              >
                {initials(p.name)}
              </span>
            );
          })}
        </div>
      )}

      {flagSvg && (
        <div
          className="absolute z-[2] h-[clamp(15px,2.1vw,24px)] w-[clamp(15px,2.1vw,24px)] overflow-hidden rounded-full border-[1.5px] border-white/35 shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          style={flagStyle}
          dangerouslySetInnerHTML={{ __html: flagSvg }}
        />
      )}
    </button>
  );
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
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
