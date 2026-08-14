import { useState } from 'react';
import { useAdmin } from '../hooks/useAdmin.js';

export function AdminPage() {
  const { connected, room, config, resetGame, kickPlayer } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReset() {
    if (!confirm('Reset the game and send everyone back to the lobby?')) return;
    setBusy(true);
    const result = await resetGame();
    setBusy(false);
    setMessage(result.ok ? 'Game reset.' : (result.reason ?? 'Reset failed'));
  }

  async function handleKick(playerId: string, name: string) {
    if (!confirm(`Kick ${name}?`)) return;
    setBusy(true);
    const result = await kickPlayer(playerId);
    setBusy(false);
    setMessage(result.ok ? `${name} kicked.` : (result.reason ?? 'Kick failed'));
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold">PolyPoly Admin</h1>
          <p className="mt-1 text-sm text-slate-400">
            {connected ? 'Connected' : 'Connecting…'} · Room phase: {room?.phase ?? '—'}
            {config?.healthMode && ' · Health mode on'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Players</h2>
          {!room || room.players.length === 0 ? (
            <p className="text-sm text-slate-500">No one has joined yet</p>
          ) : (
            <ul className="space-y-2">
              {room.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md bg-slate-800/60 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className={p.connected ? '' : 'text-slate-500 line-through'}>{p.name}</span>
                    {p.isHost && <span className="text-xs text-amber-400">host</span>}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => handleKick(p.id, p.name)}
                    className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Kick
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          disabled={busy || !room}
          onClick={handleReset}
          className="w-full rounded-lg bg-amber-500 px-3 py-3 font-medium text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset game (back to lobby)
        </button>

        {message && <p className="text-center text-sm text-slate-400">{message}</p>}

        <p className="text-center text-xs text-slate-600">
          Kicking only works while the room is in the lobby — reset first if a game is in progress.
        </p>
      </div>
    </div>
  );
}
