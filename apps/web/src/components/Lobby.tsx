import { QRCodeSVG } from 'qrcode.react';
import type { GameConfig, PlayerId, RoomInfo } from '@polypoly/shared';
import { RulesPanel } from './RulesPanel.js';

interface LobbyProps {
  room: RoomInfo;
  config: GameConfig;
  myPlayerId: PlayerId;
  error: string | null;
  onUpdateConfig: (patch: Partial<GameConfig>) => void;
  onStart: () => void;
}

export function Lobby({ room, config, myPlayerId, error, onUpdateConfig, onStart }: LobbyProps) {
  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const canStart = isHost && room.players.length >= 2;
  const joinUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[280px_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-center">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Scan to join</h2>
            <div className="mx-auto w-fit rounded-lg bg-white p-2">
              <QRCodeSVG value={joinUrl} size={180} />
            </div>
            <p className="mt-3 break-all text-xs text-slate-500">{joinUrl}</p>
          </div>

          {isHost && (
            <>
              <a
                href="/board"
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-slate-700 px-3 py-2 text-center text-sm text-slate-300 hover:bg-slate-800"
              >
                Open shared board (this PC)
              </a>
              <a
                href="/admin"
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-slate-700 px-3 py-2 text-center text-sm text-slate-300 hover:bg-slate-800"
              >
                Open admin panel
              </a>
            </>
          )}

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Players ({room.players.length}/{config.maxPlayers})
            </h2>
            <ul className="space-y-2">
              {room.players.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className={p.connected ? 'text-slate-100' : 'text-slate-500 line-through'}>{p.name}</span>
                  {p.isHost && <span className="text-xs text-amber-400">host</span>}
                  {p.id === myPlayerId && <span className="text-xs text-emerald-400">you</span>}
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <button
              onClick={onStart}
              disabled={!canStart}
              className="w-full rounded-lg bg-emerald-500 px-3 py-3 font-medium text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {room.players.length < 2 ? 'Waiting for more players…' : 'Start game'}
            </button>
          ) : (
            <p className="text-center text-sm text-slate-400">Waiting for the host to start the game…</p>
          )}

          {error && <p className="text-center text-sm text-red-400">{error}</p>}
        </div>

        {/* Host only. Everyone else could see the full toggle list but change
            nothing, which mostly invited questions about switches they had no
            say over — the rules modal is where a player looks up what is
            actually in play. */}
        {isHost && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <RulesPanel config={config} editable onChange={onUpdateConfig} />
          </div>
        )}
      </div>
    </div>
  );
}
