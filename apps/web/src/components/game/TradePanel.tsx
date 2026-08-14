import { useState } from 'react';
import type { GameAction, GameState, PlayerId } from '@polypoly/engine';

interface TradePanelProps {
  state: GameState;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}

function ownedTiles(state: GameState, playerId: PlayerId): number[] {
  return Object.entries(state.ownership)
    .filter(([, o]) => o.ownerId === playerId && o.houses === 0)
    .map(([tileIndexStr]) => Number(tileIndexStr))
    .sort((a, b) => a - b);
}

function tileName(state: GameState, tileIndex: number): string {
  const tile = state.board.tiles[tileIndex];
  return tile && tile.kind !== 'go' && tile.kind !== 'jail' && tile.kind !== 'vacation' && tile.kind !== 'go-to-jail' && tile.kind !== 'card'
    ? tile.name
    : `Tile ${tileIndex}`;
}

export function TradePanel({ state, myPlayerId, onAction }: TradePanelProps) {
  const others = state.turnOrder.filter((id) => id !== myPlayerId && state.players[id]?.status === 'active');
  const [toId, setToId] = useState<PlayerId>(others[0] ?? '');
  const [fromCash, setFromCash] = useState(0);
  const [toCash, setToCash] = useState(0);
  const [fromProperties, setFromProperties] = useState<number[]>([]);
  const [toProperties, setToProperties] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const myTiles = ownedTiles(state, myPlayerId);
  const theirTiles = toId ? ownedTiles(state, toId) : [];

  const incoming = state.pendingTrades.filter((t) => t.toId === myPlayerId);
  const outgoing = state.pendingTrades.filter((t) => t.fromId === myPlayerId);

  function toggle(list: number[], set: (v: number[]) => void, tileIndex: number) {
    set(list.includes(tileIndex) ? list.filter((i) => i !== tileIndex) : [...list, tileIndex]);
  }

  async function propose() {
    if (!toId) return;
    const result = await onAction({
      type: 'propose-trade',
      playerId: myPlayerId,
      toId,
      fromCash,
      toCash,
      fromProperties,
      toProperties,
      fromJailCards: 0,
      toJailCards: 0,
    });
    if (!result.ok) setError(result.reason ?? 'Trade failed');
    else {
      setError(null);
      setFromCash(0);
      setToCash(0);
      setFromProperties([]);
      setToProperties([]);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Trades</h2>

      {incoming.map((t) => (
        <div key={t.id} className="mb-2 rounded-md bg-slate-800 p-2 text-sm">
          <p className="text-slate-200">
            {state.players[t.fromId]?.name} offers {t.fromProperties.map((i) => tileName(state, i)).join(', ') || 'nothing'}
            {t.fromCash > 0 && ` + $${t.fromCash}`} for {t.toProperties.map((i) => tileName(state, i)).join(', ') || 'nothing'}
            {t.toCash > 0 && ` + $${t.toCash}`}
          </p>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => onAction({ type: 'respond-trade', playerId: myPlayerId, tradeId: t.id, accept: true })}
              className="rounded-md bg-emerald-500 px-2 py-1 text-xs text-slate-950"
            >
              Accept
            </button>
            <button
              onClick={() => onAction({ type: 'respond-trade', playerId: myPlayerId, tradeId: t.id, accept: false })}
              className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200"
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {outgoing.map((t) => (
        <div key={t.id} className="mb-2 rounded-md bg-slate-800 p-2 text-sm">
          <p className="text-slate-200">Offer sent to {state.players[t.toId]?.name}, waiting for response…</p>
          <button
            onClick={() => onAction({ type: 'cancel-trade', playerId: myPlayerId, tradeId: t.id })}
            className="mt-1 rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200"
          >
            Cancel
          </button>
        </div>
      ))}

      {others.length === 0 ? (
        <p className="text-sm text-slate-500">No one to trade with</p>
      ) : (
        <div className="space-y-2 text-sm">
          <select
            value={toId}
            onChange={(e) => {
              setToId(e.target.value);
              setToProperties([]);
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
          >
            {others.map((id) => (
              <option key={id} value={id}>
                {state.players[id]?.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-slate-400">You give</p>
              <PropertyChecklist state={state} tiles={myTiles} selected={fromProperties} onToggle={(i) => toggle(fromProperties, setFromProperties, i)} />
              <CashInput label="Cash" value={fromCash} onChange={setFromCash} />
            </div>
            <div>
              <p className="text-xs text-slate-400">You get</p>
              <PropertyChecklist state={state} tiles={theirTiles} selected={toProperties} onToggle={(i) => toggle(toProperties, setToProperties, i)} />
              <CashInput label="Cash" value={toCash} onChange={setToCash} />
            </div>
          </div>

          <button onClick={propose} className="w-full rounded-md bg-emerald-500 px-2 py-1.5 text-slate-950">
            Propose trade
          </button>
          {error && <p className="text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function PropertyChecklist({
  state,
  tiles,
  selected,
  onToggle,
}: {
  state: GameState;
  tiles: number[];
  selected: number[];
  onToggle: (tileIndex: number) => void;
}) {
  if (tiles.length === 0) return <p className="text-xs text-slate-600">No properties</p>;
  return (
    <ul className="max-h-24 space-y-0.5 overflow-y-auto">
      {tiles.map((i) => (
        <li key={i}>
          <label className="flex items-center gap-1 text-xs text-slate-300">
            <input type="checkbox" checked={selected.includes(i)} onChange={() => onToggle(i)} />
            {tileName(state, i)}
          </label>
        </li>
      ))}
    </ul>
  );
}

function CashInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mt-1 flex items-center gap-1 text-xs text-slate-400">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded-md border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-100"
      />
    </label>
  );
}
