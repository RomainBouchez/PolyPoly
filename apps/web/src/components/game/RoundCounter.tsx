import { motion } from 'motion/react';
import type { GameState } from '@polypoly/engine';

/** Rounds still to play, counting the one in progress. The game ends once the
 *  round number passes the limit, so the current round is itself still live. */
export function roundsLeft(state: GameState): number | null {
  const condition = state.config.endCondition;
  if (condition.type !== 'round-limit') return null;
  return Math.max(0, condition.rounds - state.roundNumber + 1);
}

/** Whoever acts last in a round — the game ends the moment play would pass
 *  back past them. Bankrupt seats stay in turnOrder, so pick the last one
 *  still in the game rather than the last index. */
function lastToPlay(state: GameState): string | null {
  for (let i = state.turnOrder.length - 1; i >= 0; i--) {
    const player = state.players[state.turnOrder[i]!];
    if (player?.status === 'active') return player.name;
  }
  return null;
}

/**
 * How long the game has left, when it is playing to a round limit. Without it
 * a timed game gives no sense of pacing — you cannot tell whether to keep
 * buying or start hoarding cash for the final count.
 */
export function RoundCounter({ state, className = '' }: { state: GameState; className?: string }) {
  const left = roundsLeft(state);
  if (left === null) return null;
  const condition = state.config.endCondition;
  const total = condition.type === 'round-limit' ? condition.rounds : 0;
  const urgent = left <= 3;
  const finalName = left <= 1 ? lastToPlay(state) : null;

  return (
    <motion.span
      // Keyed on the count so the number itself animates when a round turns
      // over, rather than silently swapping.
      key={left}
      initial={{ opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, visualDuration: 0.3 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ${
        urgent ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30' : 'bg-white/5 text-slate-300 ring-white/10'
      } ${className}`}
    >
      <span>⏳</span>
      {/* On the closing round, naming who ends it is more use than a count of
          one — it tells everyone exactly how much play is left. */}
      {finalName ? `Last turn — ends after ${finalName}` : `${left} round${left === 1 ? '' : 's'} left`}
      <span className="font-normal text-slate-500">
        · {Math.min(state.roundNumber, total)}/{total}
      </span>
    </motion.span>
  );
}
