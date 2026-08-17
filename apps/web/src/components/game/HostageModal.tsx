import { useState } from 'react';
import { motion, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import type { GameAction, GameState, PlayerId } from '@polypoly/engine';
import { tileIcon } from '../board/BoardTile.js';
import { GROUP_FLAG_SVG } from '../board/tileLayout.js';

interface HostageModalProps {
  state: GameState;
  myPlayerId: PlayerId;
  /** Every take-hostage the engine currently allows. */
  targets: number[];
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
  onClose: () => void;
}

const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 800;

function tileName(state: GameState, tileIndex: number): string {
  const tile = state.board.tiles[tileIndex];
  return tile && 'name' in tile ? tile.name : `Tile ${tileIndex}`;
}

/**
 * Picking a hostage from a list, grouped by owner. The engine offers one
 * take-hostage action per eligible property, and the action panel rendered
 * every one as its own button — fifteen of them on a real board, buried among
 * the jail options. Same shape as the Squat sheet, and dismissible: taking a
 * hostage is optional and does not get you out of jail.
 */
export function HostageModal({ state, myPlayerId, targets, onAction, onClose }: HostageModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byOwner = new Map<PlayerId, number[]>();
  for (const tileIndex of targets) {
    const ownerId = state.ownership[tileIndex]?.ownerId;
    if (!ownerId) continue;
    const list = byOwner.get(ownerId);
    if (list) list.push(tileIndex);
    else byOwner.set(ownerId, [tileIndex]);
  }

  async function take(tileIndex: number) {
    setBusy(true);
    setError(null);
    const result = await onAction({ type: 'take-hostage', playerId: myPlayerId, tileIndex });
    setBusy(false);
    if (!result.ok) setError(result.reason ?? 'That did not go through');
    else onClose();
  }

  function handleDragEnd(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.55 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0.15, visualDuration: 0.4 }}
        className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-rose-500/30 bg-slate-900 text-slate-100 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex cursor-grab justify-center pt-2 active:cursor-grabbing sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-white/15" />
        </div>

        <div className="relative shrink-0 bg-rose-600/20 px-4 py-3 text-center">
          <h2 className="text-lg font-bold tracking-tight">🎭 Take a hostage</h2>
          <p className="mt-0.5 text-sm text-rose-200">It earns its owner nothing until you leave jail</p>
          <button
            onClick={onClose}
            className="absolute right-2.5 top-2 rounded-full p-1.5 text-slate-400 transition-colors active:bg-white/10 active:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {byOwner.size === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Nothing to take — every property is yours or mortgaged.</p>
          ) : (
            [...byOwner].map(([ownerId, tiles]) => {
              const owner = state.players[ownerId];
              return (
                <section key={ownerId} className="mb-3 last:mb-0">
                  <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: owner?.color }} />
                    <span style={{ color: owner?.color }}>{owner?.name ?? 'Player'}</span>
                  </h3>
                  <div className="space-y-1">
                    {tiles.map((tileIndex) => {
                      const tile = state.board.tiles[tileIndex];
                      const flagSvg = tile?.kind === 'property' ? GROUP_FLAG_SVG[tile.group] : undefined;
                      const houses = state.ownership[tileIndex]?.houses ?? 0;
                      return (
                        <motion.button
                          key={tileIndex}
                          onClick={() => take(tileIndex)}
                          disabled={busy}
                          whileTap={{ scale: 0.97 }}
                          transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                          className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-left text-sm ring-1 ring-inset ring-white/10 active:bg-white/10 disabled:opacity-50"
                        >
                          {flagSvg ? (
                            <span
                              className="block h-3 w-4 shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.25)] [&>svg]:h-full [&>svg]:w-full"
                              dangerouslySetInnerHTML={{ __html: flagSvg }}
                            />
                          ) : (
                            tile && <span className="w-4 shrink-0 text-center leading-none">{tileIcon(tile)}</span>
                          )}
                          <span className="min-w-0 flex-1 truncate">{tileName(state, tileIndex)}</span>
                          {houses > 0 && (
                            <span className="shrink-0 text-[11px] text-slate-400">{houses === 5 ? '🏨' : `${houses}×🏠`}</span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {error && <p className="shrink-0 px-4 pb-2 text-center text-xs text-red-300">{error}</p>}

        <div className="shrink-0 border-t border-white/10 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-inset ring-white/10 active:bg-white/10"
          >
            Not now
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
