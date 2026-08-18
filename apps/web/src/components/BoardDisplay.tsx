import { useEffect, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { computeMatchStats, type GameState, type LoggedEvent, type MatchStats } from '@polypoly/engine';
import { BoardGrid } from './board/BoardGrid.js';
import { ActivityFeed } from './game/ActivityFeed.js';
import { PlayerName } from './game/GameLabels.js';
import { PendingActionBanner } from './game/PendingActionBanner.js';
import { RoundCounter } from './game/RoundCounter.js';
import { PlayersPanel } from './game/PlayersPanel.js';
import { useSpectator } from '../hooks/useSpectator.js';

const NOOP_ACTION = async () => ({ ok: false, reason: 'This is the shared display — play from your phone' });

/**
 * Condensed, always-visible standings once the game ends — no modal, nothing
 * to dismiss, since this is the one screen nobody may be sitting in front of
 * to close a dialog. The full breakdown (rent flow, jail time, trades, ...)
 * lives in each player's own MatchStatsModal on their phone; this is just the
 * podium.
 */
function GameOverSummary({
  state,
  fetchMatchLog,
}: {
  state: GameState;
  fetchMatchLog: () => Promise<{ log: LoggedEvent[]; logComplete: boolean }>;
}) {
  const [stats, setStats] = useState<MatchStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMatchLog()
      .then(({ log, logComplete }) => {
        if (!cancelled) setStats(computeMatchStats(log, state, logComplete));
      })
      .catch(() => {
        // Standings alone (no rent/jail detail) still render from `state`
        // once the request settles, so a failed fetch just means a shorter
        // wait for the fallback rather than a broken screen.
      });
    return () => {
      cancelled = true;
    };
    // Runs once — the match is over and state is frozen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const winner = stats?.winnerId ? state.players[stats.winnerId] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0.15, visualDuration: 0.4 }}
      className="flex w-full max-w-xs flex-col items-center gap-2.5"
    >
      {winner ? (
        <p className="text-xl font-bold" style={{ color: winner.color }}>
          🏆 {winner.name} wins!
        </p>
      ) : (
        <p className="text-lg font-semibold text-emerald-400">Game over</p>
      )}
      {stats && (
        <div className="w-full space-y-1">
          {stats.standings.map((s, i) => (
            <div
              key={s.playerId}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-sm ring-1 ring-inset ring-white/10"
            >
              <span className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-center text-xs text-slate-500">{i + 1}</span>
                <PlayerName state={state} playerId={s.playerId} />
              </span>
              <span className="shrink-0 tabular-nums text-slate-300">${s.netWorth.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/** The shared PC screen in home mode: shows the board only, no controls.
 *  Doesn't join as a player — it just watches the room's broadcasts. */
export function BoardDisplay() {
  const { gameState, events, fetchMatchLog } = useSpectator();

  if (!gameState) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Waiting for the game to start…</p>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.turnOrder[gameState.currentPlayerIndex]!];

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-dvh overflow-hidden bg-slate-950 p-2 text-slate-100">
        <div className="mx-auto flex h-full max-w-[110rem] gap-4">
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <BoardGrid state={gameState} events={events} myPlayerId="" onAction={NOOP_ACTION}>
              {gameState.phase.type === 'game-over' ? (
                <GameOverSummary state={gameState} fetchMatchLog={fetchMatchLog} />
              ) : (
                currentPlayer && (
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="text-lg font-semibold" style={{ color: currentPlayer.color }}>
                      {currentPlayer.name}'s turn
                    </p>
                    <RoundCounter state={gameState} />
                  </div>
                )
              )}
              <PendingActionBanner state={gameState} />
              <div className="min-h-0 w-full flex-1 overflow-hidden">
                <ActivityFeed events={events} state={gameState} />
              </div>
            </BoardGrid>
          </div>

          <div className="w-56 shrink-0 overflow-y-auto">
            <PlayersPanel state={gameState} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
