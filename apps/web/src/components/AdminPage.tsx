import { useState } from 'react';
import { useAdmin } from '../hooks/useAdmin.js';

const SQUAT_LEVELS = [
  { value: 1, label: '1 house' },
  { value: 2, label: '2 houses' },
  { value: 3, label: '3 houses' },
  { value: 5, label: 'Hotel' },
];

export function AdminPage() {
  const { connected, room, config, resetGame, kickPlayer, grantSquat, sendToJail } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [squatPlayerId, setSquatPlayerId] = useState('');
  const [jailPlayerId, setJailPlayerId] = useState('');
  const [squatLevel, setSquatLevel] = useState(SQUAT_LEVELS[0]!.value);

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

  async function handleGrantSquat() {
    if (!squatPlayerId) return;
    setBusy(true);
    const result = await grantSquat(squatPlayerId, squatLevel);
    setBusy(false);
    const levelLabel = SQUAT_LEVELS.find((l) => l.value === squatLevel)?.label;
    setMessage(result.ok ? `Squat pass (${levelLabel}) granted.` : (result.reason ?? 'Grant failed'));
  }

  async function handleSendToJail() {
    if (!jailPlayerId) return;
    setBusy(true);
    const result = await sendToJail(jailPlayerId);
    setBusy(false);
    const name = room?.players.find((p) => p.id === jailPlayerId)?.name ?? 'Player';
    setMessage(result.ok ? `${name} sent to jail.` : (result.reason ?? 'Failed'));
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

        {room?.phase === 'playing' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Send to jail <span className="normal-case text-slate-500">— testing shortcut</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={jailPlayerId}
                onChange={(e) => setJailPlayerId(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="">Player…</option>
                {room.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !jailPlayerId}
                onClick={handleSendToJail}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Jail
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Jail is the only place the hostage action appears, so this is the way to try that mode without waiting to land on Go
              To Jail. Needs hostages switched on in the rules to be useful.
            </p>
          </div>
        )}

        {room?.phase === 'playing' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Grant Squat pass <span className="normal-case text-slate-500">— testing shortcut</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={squatPlayerId}
                onChange={(e) => setSquatPlayerId(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="">Player…</option>
                {room.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={squatLevel}
                onChange={(e) => setSquatLevel(Number(e.target.value))}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              >
                {SQUAT_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !squatPlayerId}
                onClick={handleGrantSquat}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Grant
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Skips "land on Chance, draw the card" — the player can then squat any opponent property matching this
              level.
            </p>
          </div>
        )}

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
