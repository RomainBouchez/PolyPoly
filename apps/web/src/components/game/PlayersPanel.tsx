import type { GameState } from '@polypoly/engine';

export function PlayersPanel({ state }: { state: GameState }) {
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const healthMode = state.config.healthMode;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Players</h2>
      <ul className="space-y-1.5">
        {state.turnOrder.map((id) => {
          const p = state.players[id]!;
          const isTurn = id === currentPlayerId && state.phase.type !== 'game-over';
          return (
            <li
              key={id}
              className={`rounded-md px-2 py-1 text-sm ${isTurn ? 'bg-slate-800' : ''} ${
                p.status === 'bankrupt' ? 'opacity-40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                  {isTurn && <span className="text-emerald-400">●</span>}
                  {p.inJail && <span title="In jail">🔒</span>}
                  {p.status === 'bankrupt' && <span className="text-xs text-red-400">bankrupt</span>}
                </span>
                <span className="tabular-nums text-slate-300">${p.cash}</span>
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
    <div className="mt-1 flex items-center gap-1.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${health}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">❤️ {health}</span>
    </div>
  );
}
