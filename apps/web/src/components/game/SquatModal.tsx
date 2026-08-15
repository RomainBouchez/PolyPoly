import { motion } from 'motion/react';
import type { GameAction, GameState, PlayerId } from '@polypoly/engine';
import { GROUP_COLORS } from '../board/tileLayout.js';

interface SquatModalProps {
  state: GameState;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}

function squatLevelLabel(level: number): string {
  return level === 5 ? 'a hotel' : `${level} house${level > 1 ? 's' : ''}`;
}

/** Pops the moment a player holds an undecided Squat pass — they must either
 *  pick a target property right now or explicitly skip it; there's no
 *  backdrop-tap or drag dismissal, since sitting on it isn't an option. */
export function SquatModal({ state, myPlayerId, onAction }: SquatModalProps) {
  const held = state.heldSquatCards.find((h) => h.playerId === myPlayerId && h.targetTileIndex === undefined);
  if (!held) return null;

  const me = state.players[myPlayerId]!;
  const sick = state.config.healthMode && me.health <= 20;

  const eligible = Object.entries(state.ownership)
    .filter(
      ([, o]) =>
        o.ownerId !== myPlayerId && !o.mortgaged && o.houses === held.buildingLevel && !me.squattedPlayerIds.includes(o.ownerId),
    )
    .map(([tileIndexStr]) => Number(tileIndexStr))
    .sort((a, b) => a - b);

  async function pick(tileIndex: number) {
    await onAction({ type: 'use-squat-on', playerId: myPlayerId, tileIndex });
  }

  async function skip() {
    await onAction({ type: 'skip-squat', playerId: myPlayerId });
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0.15, visualDuration: 0.4 }}
        className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-violet-500/30 bg-slate-900 text-slate-100 shadow-2xl sm:rounded-3xl"
      >
        <div className="bg-violet-600/20 px-4 py-3 text-center">
          <h2 className="text-lg font-bold tracking-tight">🏚️ Squat pass!</h2>
          <p className="mt-0.5 text-sm text-violet-200">You can stay free at a property with {squatLevelLabel(held.buildingLevel)}</p>
        </div>

        <div className="max-h-[55dvh] overflow-y-auto overscroll-contain px-4 py-3">
          {sick ? (
            <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
              Too sick to squat right now (health ≤ 20) — you'll have to skip it.
            </p>
          ) : eligible.length === 0 ? (
            <p className="rounded-xl bg-white/5 px-3 py-2.5 text-center text-sm text-slate-400 ring-1 ring-inset ring-white/10">
              No opponent property matches this level right now.
            </p>
          ) : (
            <div className="space-y-1.5">
              {eligible.map((tileIndex) => {
                const tile = state.board.tiles[tileIndex];
                const owner = state.players[state.ownership[tileIndex]!.ownerId];
                const dot = tile?.kind === 'property' ? GROUP_COLORS[tile.group] : undefined;
                const label = tile && 'name' in tile ? tile.name : `Tile ${tileIndex}`;
                return (
                  <motion.button
                    key={tileIndex}
                    onClick={() => pick(tileIndex)}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                    className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-left text-sm ring-1 ring-inset ring-white/10 active:bg-white/10"
                  >
                    {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
                    <span className="min-w-0 truncate">
                      {label} <span className="text-slate-500">— {owner?.name}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <motion.button
            onClick={skip}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-inset ring-white/10 active:bg-white/10"
          >
            Skip
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
