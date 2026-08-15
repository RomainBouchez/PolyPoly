import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { BoardLayout, GameState, Player } from '@polypoly/engine';
import { trackBoundaryPercent } from './tileLayout.js';

interface PlayerTokensLayerProps {
  state: GameState;
  layout: BoardLayout;
}

/**
 * Renders every player token as ONE flat overlay spanning the whole board
 * (not as a DOM child of each tile). Tokens used to live inside each tile's
 * own subtree, so moving a player meant unmounting the token from the old
 * tile and mounting a fresh one on the new tile — a teleport, no animation
 * possible in between.
 *
 * A shared `layoutId`-based "magic move" (unmount on old tile, remount on
 * new tile, let Motion project the delta) was the first approach tried, but
 * every tile is `overflow-hidden` (needed for rounded corners + the
 * mortgage stripe pattern) — Motion would clip the token the instant it
 * transformed outside its *new* parent's box, so anything but a short hop
 * to an adjacent tile got chopped off mid-flight. Rendering tokens in a
 * single non-clipped layer positioned by board-relative percentages (the
 * same trick `EventToast` already uses) sidesteps that entirely: the token
 * component never unmounts when a player moves, only its target `left`/`top`
 * change, so Motion just tweens between them with nothing to clip it.
 *
 * Movement walks the ring one tile at a time rather than tweening straight
 * from origin to destination — a direct tween cuts the diagonal across the
 * board's middle whenever a move rounds a corner, which reads as the token
 * skipping the corner entirely. Each intermediate tile centre becomes a
 * keyframe, so the token follows the actual path a physical piece would.
 */
export function PlayerTokensLayer({ state, layout }: PlayerTokensLayerProps) {
  const reduceMotion = useReducedMotion();
  const currentTurnPlayerId =
    state.phase.type !== 'game-over' ? state.turnOrder[state.currentPlayerIndex] : undefined;
  const jailTile = state.board.tiles.find((t) => t.kind === 'jail');

  const groups = new Map<string, Player[]>();
  for (const p of Object.values(state.players)) {
    const inJailSplit = jailTile !== undefined && p.position === jailTile.index;
    const key = inJailSplit ? `${p.position}:${p.inJail ? 'in' : 'visit'}` : `${p.position}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }

  const tokens: { player: Player; tileIndex: number; left: number; top: number }[] = [];
  for (const [key, players] of groups) {
    const [posStr, zone] = key.split(':');
    const tileIndex = Number(posStr);
    const box = tileBoxPercent(layout, tileIndex);
    if (!box) continue;
    const anchor = anchorFraction(zone);
    const centerLeft = box.left + anchor.x * (box.right - box.left);
    const centerTop = box.top + anchor.y * (box.bottom - box.top);
    const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));
    const offsets = spreadOffsets(sorted.length);
    sorted.forEach((player, i) => {
      tokens.push({ player, tileIndex, left: centerLeft + offsets[i]!.dx, top: centerTop + offsets[i]!.dy });
    });
  }

  return (
    <div style={{ gridRow: '1 / -1', gridColumn: '1 / -1' }} className="pointer-events-none relative z-[15]">
      {tokens.map(({ player, tileIndex, left, top }) => (
        <PlayerToken
          key={player.id}
          player={player}
          tileIndex={tileIndex}
          left={left}
          top={top}
          layout={layout}
          boardSize={state.board.tiles.length}
          // Being jailed is a teleport, not a walk — a player sent to jail
          // must not be shown tracing the ring (and passing Go) to get there.
          jumps={player.inJail && jailTile !== undefined && player.position === jailTile.index}
          isTurn={player.id === currentTurnPlayerId}
          reduceMotion={!!reduceMotion}
        />
      ))}
    </div>
  );
}

/** ~85ms per tile reads as a brisk but followable hop; the cap keeps a
 *  cross-board "Advance to" card from turning into a slow crawl. */
const STEP_SECONDS = 0.085;
const MAX_WALK_SECONDS = 1.8;
/** Beyond this, a shorter backward path is treated as a genuine "go back N
 *  spaces" card rather than a long forward lap. */
const MAX_BACKWARD_STEPS = 4;

/**
 * The tile centres a token passes through between `from` and `to`, excluding
 * both endpoints. Direction is inferred from the two positions: forward is
 * the default (dice moves and "Advance to" cards both travel forward, wrapping
 * past Go), and only a short backward hop is read as a "go back N" card.
 */
function walkVia(
  layout: BoardLayout,
  from: number,
  to: number,
  boardSize: number,
): { left: number; top: number }[] {
  if (from === to || boardSize <= 0) return [];
  const forward = (to - from + boardSize) % boardSize;
  const backward = (from - to + boardSize) % boardSize;
  const goesBackward = backward <= MAX_BACKWARD_STEPS && backward < forward;
  const stepCount = goesBackward ? backward : forward;

  const via: { left: number; top: number }[] = [];
  for (let i = 1; i < stepCount; i++) {
    const index = goesBackward ? (from - i + boardSize) % boardSize : (from + i) % boardSize;
    const box = tileBoxPercent(layout, index);
    if (box) via.push({ left: (box.left + box.right) / 2, top: (box.top + box.bottom) / 2 });
  }
  return via;
}

const SPREAD = 1.7; // percent of board width/height between clustered tokens

function spreadOffsets(n: number): { dx: number; dy: number }[] {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return Array.from({ length: n }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      dx: (col - (cols - 1) / 2) * SPREAD,
      dy: (row - (rows - 1) / 2) * SPREAD,
    };
  });
}

/** A tile's bounding box, in 0-100 percent of the whole board — the same
 *  coordinate space `EventToast` positions itself in. */
function tileBoxPercent(layout: BoardLayout, tileIndex: number): { left: number; right: number; top: number; bottom: number } | null {
  const pos = layout.positions[tileIndex];
  if (!pos) return null;
  const g = layout.gridSize;
  return {
    left: trackBoundaryPercent(pos.col - 1, g, 'col'),
    right: trackBoundaryPercent(pos.col, g, 'col'),
    top: trackBoundaryPercent(pos.row - 1, g, 'row'),
    bottom: trackBoundaryPercent(pos.row, g, 'row'),
  };
}

/** Where within a tile's box a token cluster sits, as an x/y fraction (0-1).
 *  Regular tiles center the cluster; jail's two zones get their own spot,
 *  matching where the "In jail" cell / "Just visiting" label sit visually. */
function anchorFraction(zone: string | undefined): { x: number; y: number } {
  if (zone === 'in') return { x: 0.68, y: 0.32 }; // the barred cell (top-right of the jail tile)
  if (zone === 'visit') return { x: 0.24, y: 0.78 }; // the visiting corner (bottom-left)
  return { x: 0.5, y: 0.5 };
}

interface Movement {
  left: string | string[];
  top: string | string[];
  transition: Record<string, unknown>;
}

function PlayerToken({
  player,
  tileIndex,
  left,
  top,
  layout,
  boardSize,
  jumps,
  isTurn,
  reduceMotion,
}: {
  player: Player;
  tileIndex: number;
  left: number;
  top: number;
  layout: BoardLayout;
  boardSize: number;
  jumps: boolean;
  isTurn: boolean;
  reduceMotion: boolean;
}) {
  // Held in state rather than derived each render so an unrelated re-render
  // (the turn glow toggling, say) can't swap a running keyframe walk back to
  // a plain target mid-flight and snap the token to its destination.
  const [movement, setMovement] = useState<Movement>(() => ({
    left: `${left}%`,
    top: `${top}%`,
    transition: { duration: 0 },
  }));
  const previous = useRef({ tileIndex, left, top });

  useEffect(() => {
    const from = previous.current;
    if (from.tileIndex === tileIndex && from.left === left && from.top === top) return;
    previous.current = { tileIndex, left, top };

    const settled = { left: `${left}%`, top: `${top}%` };
    if (reduceMotion) {
      setMovement({ ...settled, transition: { duration: 0 } });
      return;
    }

    // Same tile (tokens re-spreading as someone joins or leaves) or a jail
    // teleport: no path to trace, just ease across.
    const via = jumps ? [] : walkVia(layout, from.tileIndex, tileIndex, boardSize);
    if (via.length === 0) {
      setMovement({ ...settled, transition: { type: 'spring', bounce: 0, visualDuration: 0.35 } });
      return;
    }

    const lefts = [`${from.left}%`, ...via.map((v) => `${v.left}%`), settled.left];
    const tops = [`${from.top}%`, ...via.map((v) => `${v.top}%`), settled.top];
    setMovement({
      left: lefts,
      top: tops,
      transition: {
        duration: Math.min(MAX_WALK_SECONDS, (lefts.length - 1) * STEP_SECONDS),
        ease: 'linear',
      },
    });
  }, [tileIndex, left, top, jumps, layout, boardSize, reduceMotion]);

  return (
    <motion.span
      title={player.name}
      className="absolute aspect-square w-[clamp(9px,1.7cqmin,20px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
      initial={false}
      animate={{ left: movement.left, top: movement.top }}
      transition={movement.transition}
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
