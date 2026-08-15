import type { GameState, Player, PropertyGroup, Tile } from '@polypoly/engine';
import type { CSSProperties } from 'react';
import HEALTH_BONUS_SVG from '../../assets/icons/health-bonus.svg?raw';
import HEALTH_MALUS_SVG from '../../assets/icons/health-malus.svg?raw';
import { GROUP_FLAG_SVG } from './tileLayout.js';
import type { TileSide } from './tileLayout.js';

interface BoardTileProps {
  tile: Tile;
  state: GameState;
  position: { row: number; col: number };
  /** Undefined for corner tiles — they don't face a printed edge. */
  side?: TileSide;
  onSelect?: (tileIndex: number) => void;
}

const BAND_THICKNESS = 5;
const PANEL = '#0f1420';

export function BoardTile({ tile, state, position, side, onSelect }: BoardTileProps) {
  const ownership = state.ownership[tile.index];
  const owner = ownership ? state.players[ownership.ownerId] : null;
  const playersHere = Object.values(state.players).filter((p) => p.position === tile.index);
  const currentTurnPlayerId =
    state.phase.type !== 'game-over' ? state.turnOrder[state.currentPlayerIndex] : undefined;
  const hasPriceSlot = 'price' in tile;
  const price = !ownership && hasPriceSlot ? tile.price : undefined;
  const flagSvg = tile.kind === 'property' ? GROUP_FLAG_SVG[tile.group as PropertyGroup] : undefined;

  if (tile.kind === 'jail') {
    return (
      <JailTile
        tileIndex={tile.index}
        position={position}
        playersHere={playersHere}
        currentTurnPlayerId={currentTurnPlayerId}
        onSelect={onSelect}
      />
    );
  }

  // Owner band sits on the tile's OUTER edge (the one facing the board
  // boundary) so it never fights the houses indicator on the inner edge.
  const bandStyle: CSSProperties =
    owner && side
      ? side === 'top' || side === 'bottom'
        ? { [side]: 0, left: 0, right: 0, height: BAND_THICKNESS, backgroundColor: owner.color }
        : { [side]: 0, top: 0, bottom: 0, width: BAND_THICKNESS, backgroundColor: owner.color }
      : {};

  return (
    <button
      type="button"
      onClick={() => onSelect?.(tile.index)}
      style={{
        gridRow: position.row,
        gridColumn: position.col,
        backgroundColor: PANEL,
        // Descendant text sizes itself off THIS tile's own box via cqmin
        // (whichever of width/height is tighter). Tiles aren't square —
        // top/bottom tiles are tall-narrow, left/right are short-wide — so
        // containment must cover BOTH axes ('size', not 'inline-size'),
        // otherwise cqh/cqmin fall back to the ancestor's size on the
        // uncontained axis and blow up text on the short-wide tiles.
        containerType: 'size',
      }}
      className="relative flex cursor-pointer overflow-hidden rounded-md hover:brightness-125"
    >
      {owner && <div className="pointer-events-none absolute z-0" style={bandStyle} />}
      {ownership?.mortgaged && (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, rgba(0,0,0,0.55) 0 6px, rgba(0,0,0,0.35) 6px 12px)',
          }}
        />
      )}

      {/* Content column: flag/houses strip, icon, name, price — sized off
          cqmin so nothing ever overflows or gets clipped regardless of
          how small the board renders. */}
      <div className="relative z-[2] flex w-full flex-col items-center justify-between gap-[2cqmin] overflow-hidden p-[6cqmin]">
        <div className={`flex w-full items-center justify-between ${side === 'left' ? 'flex-row-reverse' : ''}`}>
          <span className="flex shrink-0 items-center gap-[2cqmin]">
            {flagSvg && (
              <span
                className="block h-[11cqmin] w-[16cqmin] shrink-0 overflow-hidden rounded-[1.5cqmin] shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
                dangerouslySetInnerHTML={{ __html: flagSvg }}
              />
            )}
            {tile.kind === 'property' && tile.healthEffect && <HealthBadge effect={tile.healthEffect} />}
          </span>
          {ownership && tile.kind === 'property' && ownership.houses > 0 && owner && (
            <span className="flex shrink-0 gap-[1.5cqmin]">
              {ownership.houses === 5 ? (
                <span
                  className="block h-[8cqmin] w-[8cqmin] rounded-[1.5cqmin]"
                  style={{ backgroundColor: owner.color, boxShadow: '0 0 0 1px rgba(255,255,255,0.35)' }}
                />
              ) : (
                Array.from({ length: ownership.houses }).map((_, i) => (
                  <span
                    key={i}
                    className="block h-[6cqmin] w-[6cqmin] rounded-full"
                    style={{ backgroundColor: owner.color, boxShadow: '0 0 0 1px rgba(255,255,255,0.35)' }}
                  />
                ))
              )}
            </span>
          )}
        </div>

        <span className="shrink-0 text-[clamp(12px,24cqmin,26px)] leading-none">{tileIcon(tile)}</span>

        <span
          className="line-clamp-2 min-h-0 w-full max-w-full shrink-0 overflow-hidden text-center font-bold text-slate-100 [hyphens:auto] [overflow-wrap:anywhere]"
          style={{ fontSize: 'clamp(7px, 13cqmin, 12px)', lineHeight: 1.1, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {tileName(tile)}
        </span>

        {/* Rendered (even with no price to show) for any tile that HAS a
            price slot, just hidden via visibility — keeps the row in the
            layout so the icon/name above don't shift once a tile is bought
            and its price disappears. Tiles with no price slot at all (Go,
            tax, cards, ...) skip the row entirely, same as before. */}
        {hasPriceSlot && (
          <span
            className="shrink-0 font-semibold text-[#8993ac]"
            style={{ fontSize: 'clamp(6px, 10cqmin, 10px)', visibility: price !== undefined ? 'visible' : 'hidden' }}
          >
            ${price ?? 0}
          </span>
        )}
      </div>

      {/* Player tokens overlay the whole tile, centered — not a flow item
          pushed to one edge, so they stay visible regardless of tile content. */}
      {playersHere.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-[3] flex flex-wrap items-center justify-center gap-[1.5cqmin] p-[10%]">
          {playersHere.map((p) => (
            <PlayerToken key={p.id} player={p} isTurn={p.id === currentTurnPlayerId} />
          ))}
        </div>
      )}
    </button>
  );
}

/**
 * The jail corner is split into two clearly separate zones, like a real
 * board: a barred "IN JAIL" cell (bottom-right) for players actually
 * imprisoned, and the rest of the tile as "JUST VISITING" for anyone merely
 * passing through. Kept as its own component since jail's dual-zone layout
 * shares nothing with a regular tile's single content column.
 */
function JailTile({
  tileIndex,
  position,
  playersHere,
  currentTurnPlayerId,
  onSelect,
}: {
  tileIndex: number;
  position: { row: number; col: number };
  playersHere: Player[];
  currentTurnPlayerId: string | undefined;
  onSelect?: (tileIndex: number) => void;
}) {
  const inmates = playersHere.filter((p) => p.inJail);
  const visitors = playersHere.filter((p) => !p.inJail);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(tileIndex)}
      style={{
        gridRow: position.row,
        gridColumn: position.col,
        backgroundColor: PANEL,
        containerType: 'size',
      }}
      className="relative cursor-pointer overflow-hidden rounded-md hover:brightness-125"
    >
      {/* Just-visiting zone is the L-shaped remainder once the jail cell is
          carved out of the top-right corner — so the label follows that
          same L: "JUST" running down the left edge, "VISITING" running
          along the bottom edge, meeting at the open bottom-left corner
          where visitor tokens sit. */}
      {/* Centered within its own strip of the L (the left column excluding
          the bottom-left corner shared with "Visiting"), so it sits evenly
          between the tile's outer border and the jail cell's border. */}
      <span
        className="absolute font-bold uppercase tracking-wide text-slate-300"
        style={{
          left: '19%',
          top: '31%',
          transform: 'translate(-50%, -50%) rotate(180deg)',
          fontSize: 'clamp(6px, 9cqmin, 10px)',
          writingMode: 'vertical-rl',
        }}
      >
        Just
      </span>
      <span
        className="absolute font-bold uppercase tracking-wide text-slate-300"
        style={{
          left: '69%',
          top: '81%',
          transform: 'translate(-50%, -50%)',
          fontSize: 'clamp(6px, 9cqmin, 10px)',
        }}
      >
        Visiting
      </span>
      {visitors.length > 0 && (
        <div className="absolute bottom-[16cqmin] left-[16cqmin] flex max-w-[30%] flex-wrap items-center justify-center gap-[2cqmin]">
          {visitors.map((p) => (
            <PlayerToken key={p.id} player={p} isTurn={p.id === currentTurnPlayerId} />
          ))}
        </div>
      )}

      {/* In-jail cell — visually walled off with a border + bar stripes so
          it reads as a separate holding area, not just a corner icon. Jail
          is always the board's bottom-left corner, so its inner corner
          (the one facing the center panel) is top-right. */}
      <div
        className="absolute right-0 top-0 flex flex-col items-center justify-start gap-[2cqmin] overflow-hidden border-b-2 border-l-2 p-[5cqmin]"
        style={{
          width: '62%',
          height: '62%',
          borderColor: '#7c1d1d',
          backgroundColor: '#1c0f10',
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 14%)',
        }}
      >
        <span
          className="font-extrabold uppercase tracking-wide text-red-300"
          style={{ fontSize: 'clamp(6px, 9cqmin, 10px)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
        >
          🚔 In jail
        </span>
        {inmates.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-[2cqmin]">
            {inmates.map((p) => (
              <PlayerToken key={p.id} player={p} isTurn={p.id === currentTurnPlayerId} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

/** Sign is which way the tile moves health on landing — a flat cash-only
 *  effect (healthDelta 0, no pharmacy) has nothing to show. */
function HealthBadge({ effect }: { effect: { healthDelta: number; pharmacy?: boolean } }) {
  if (effect.healthDelta === 0 && !effect.pharmacy) return null;
  const positive = effect.pharmacy || effect.healthDelta > 0;
  return (
    <span
      className="block h-[14cqmin] w-[14cqmin] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
      style={{ color: positive ? '#4ade80' : '#f87171' }}
      dangerouslySetInnerHTML={{ __html: positive ? HEALTH_BONUS_SVG : HEALTH_MALUS_SVG }}
    />
  );
}

function PlayerToken({ player, isTurn }: { player: Player; isTurn: boolean }) {
  return (
    <span
      title={player.name}
      className="relative block aspect-square w-[clamp(10px,14cqmin,20px)] shrink-0 rounded-full border-2"
      style={{
        backgroundColor: player.color,
        borderColor: 'rgba(5,7,13,0.9)',
        boxShadow: isTurn
          ? `0 1px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.35), 0 0 0 3px ${player.color}, 0 0 10px 3px ${player.color}`
          : '0 1px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.25)',
        animation: isTurn ? 'token-pulse 1.4s ease-in-out infinite' : undefined,
        ['--glow-color' as string]: player.color,
      }}
    />
  );
}

function tileName(tile: Tile): string {
  return tile.kind === 'card' ? (tile.deck === 'travel' ? 'Travel' : 'Customs') : tile.name;
}

export function tileIcon(tile: Tile): string {
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
    case 'emergency':
      return '🚑';
    case 'sunny':
      return '☀️';
  }
}
