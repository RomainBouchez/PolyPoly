import { useState } from 'react';
import { motion } from 'motion/react';
import type { GameAction, GameState, PlayerId } from '@polypoly/engine';

interface AlliancePanelProps {
  state: GameState;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}

/** Shows the player's active alliance (if any) and, when healthMode is also
 *  on, a small slider to send health to the ally. Alliances form on their
 *  own from a card draw — this panel is read-only about *forming* one. */
export function AlliancePanel({ state, myPlayerId, onAction }: AlliancePanelProps) {
  const alliance = state.alliances.find((a) => a.players.includes(myPlayerId));
  if (!alliance || !state.config.allianceMode) return null;

  const allyId = alliance.players.find((id) => id !== myPlayerId)!;
  const ally = state.players[allyId];
  const me = state.players[myPlayerId]!;
  if (!ally) return null;

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3 shadow-lg shadow-black/20">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-300">Alliance</h2>
        <span className="text-[11px] font-medium text-violet-300/80">
          {alliance.turnsRemaining} turn{alliance.turnsRemaining === 1 ? '' : 's'} left
        </span>
      </div>
      <p className="text-sm text-slate-200">
        Allied with <span className="font-semibold" style={{ color: ally.color }}>{ally.name}</span> — rent between you
        is halved.
      </p>

      {state.config.healthMode && <HealthTransfer myPlayerId={myPlayerId} myHealth={me.health} allyId={allyId} onAction={onAction} />}
    </div>
  );
}

function HealthTransfer({
  myPlayerId,
  myHealth,
  allyId,
  onAction,
}: {
  myPlayerId: PlayerId;
  myHealth: number;
  allyId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = Math.max(0, myHealth);

  async function send() {
    setBusy(true);
    const result = await onAction({ type: 'transfer-health', playerId: myPlayerId, toId: allyId, amount });
    setBusy(false);
    setError(result.ok ? null : (result.reason ?? 'Transfer failed'));
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={max}
        value={Math.min(amount, max)}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500"
      />
      <span className="w-10 shrink-0 text-center text-xs font-semibold tabular-nums text-violet-200">{Math.min(amount, max)}</span>
      <motion.button
        type="button"
        onClick={send}
        disabled={busy || amount <= 0}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
        className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        Send health
      </motion.button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
