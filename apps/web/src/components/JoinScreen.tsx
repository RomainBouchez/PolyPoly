import { useState } from 'react';
import type { RoomInfo } from '@polypoly/shared';
import { ColorPicker } from './ColorPicker.js';

interface JoinScreenProps {
  connected: boolean;
  error: string | null;
  /** Already populated pre-join — the server broadcasts room state to every
   *  connected socket, seated or not — so taken colours can be shown here. */
  room: RoomInfo | null;
  onJoin: (name: string, color?: string) => void;
}

export function JoinScreen({ connected, error, room, onJoin }: JoinScreenProps) {
  const [name, setName] = useState('');
  // No colour picked is a valid choice — the server auto-assigns one, same
  // as before this feature existed.
  const [color, setColor] = useState<string | null>(null);
  const takenColors = new Set((room?.players ?? []).map((p) => p.color));

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onJoin(name.trim(), color ?? undefined);
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">PolyPoly</h1>
          <p className="mt-1 text-sm text-slate-400">Travel-themed Monopoly for your crew</p>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={20}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500"
        />

        <div>
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            Colour <span className="normal-case text-slate-600">(optional — you can also pick in the lobby)</span>
          </p>
          <ColorPicker takenColors={takenColors} selected={color} onSelect={(c) => setColor(c === color ? null : c)} />
        </div>

        <button
          type="submit"
          disabled={!connected || !name.trim()}
          className="w-full rounded-lg bg-emerald-500 px-3 py-2 font-medium text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {connected ? 'Join room' : 'Connecting…'}
        </button>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}
