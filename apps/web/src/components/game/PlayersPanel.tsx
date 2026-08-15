import { motion } from 'motion/react';
import type { GameState } from '@polypoly/engine';
import { CashValue } from './CashValue.js';

export function PlayersPanel({ state }: { state: GameState }) {
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const healthMode = state.config.healthMode;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-lg shadow-black/20">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Players</h2>
      <ul className="space-y-1.5">
        {state.turnOrder.map((id) => {
          const p = state.players[id]!;
          const isTurn = id === currentPlayerId && state.phase.type !== 'game-over';
          return (
            <li
              key={id}
              className={`rounded-lg px-2 py-1.5 text-sm ring-1 ring-inset ${
                isTurn ? 'bg-emerald-500/10 ring-emerald-500/20' : 'ring-transparent'
              } ${p.status === 'bankrupt' ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                  {isTurn && <span className="text-emerald-400">●</span>}
                  {p.inJail && <span title="In jail">🔒</span>}
                  {p.status === 'bankrupt' && <span className="text-xs text-red-400">bankrupt</span>}
                </span>
                <CashValue cash={p.cash} baseColor="#cbd5e1" className="tabular-nums" />
              </div>
              {healthMode && <HealthBar health={p.health} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HealthBar({ health }: { health: number }) {
  const color = health <= 20 ? '#ef4444' : health >= 80 ? '#22c55e' : '#eab308';
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${health}%`, backgroundColor: color }}
          transition={{ type: 'spring', bounce: 0, visualDuration: 0.4 }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500">❤️ {health}</span>
    </div>
  );
}
