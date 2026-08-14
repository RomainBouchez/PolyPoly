import { useState } from 'react';
import { motion, useDragControls, type PanInfo } from 'motion/react';
import { ArrowLeftRight, ChevronLeft, Send, X } from 'lucide-react';
import type { GameAction, GameState, Player, PlayerId } from '@polypoly/engine';
import { GROUP_COLORS } from '../board/tileLayout.js';

interface TradeModalProps {
  state: GameState;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
  onClose: () => void;
}

const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 800;

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

/** Two-step "create a trade" flow: pick who to trade with, then compose the
 *  offer with a cash slider and property chips on each side. */
export function TradeModal({ state, myPlayerId, onAction, onClose }: TradeModalProps) {
  const me = state.players[myPlayerId]!;
  const others = state.turnOrder.filter((id) => id !== myPlayerId && state.players[id]?.status === 'active');

  const [toId, setToId] = useState<PlayerId | null>(others.length === 1 ? others[0]! : null);
  const [fromCash, setFromCash] = useState(0);
  const [toCash, setToCash] = useState(0);
  const [fromProperties, setFromProperties] = useState<number[]>([]);
  const [toProperties, setToProperties] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const them = toId ? state.players[toId]! : null;
  const myTiles = ownedTiles(state, myPlayerId);
  const theirTiles = toId ? ownedTiles(state, toId) : [];

  const dragControls = useDragControls();

  function toggle(list: number[], set: (v: number[]) => void, tileIndex: number) {
    set(list.includes(tileIndex) ? list.filter((i) => i !== tileIndex) : [...list, tileIndex]);
  }

  function handleDragEnd(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  }

  async function send() {
    if (!toId) return;
    setBusy(true);
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
    setBusy(false);
    if (!result.ok) setError(result.reason ?? 'Trade failed');
    else onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.55 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0.15, visualDuration: 0.4 }}
        className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl sm:rounded-3xl"
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex cursor-grab justify-center pt-2 active:cursor-grabbing sm:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-white/15" />
        </div>

        <div className="relative flex items-center justify-center bg-slate-800/60 px-4 py-3 text-center">
          {toId && others.length > 1 && (
            <button
              onClick={() => setToId(null)}
              className="absolute left-2.5 top-2 rounded-full p-1.5 text-slate-400 active:bg-white/10 active:text-slate-200"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="text-lg font-bold tracking-tight">Create a trade</h2>
          <button
            onClick={onClose}
            className="absolute right-2.5 top-2 rounded-full p-1.5 text-slate-400 active:bg-white/10 active:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {!toId ? (
          <div className="px-4 py-4">
            <p className="mb-3 text-sm text-slate-400">Select a player to trade with</p>
            {others.length === 0 ? (
              <p className="text-sm text-slate-500">No one to trade with</p>
            ) : (
              <div className="space-y-2">
                {others.map((id) => {
                  const p = state.players[id]!;
                  return (
                    <motion.button
                      key={id}
                      onClick={() => setToId(id)}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10 active:bg-white/10"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-slate-950 ring-2 ring-white/15"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium text-slate-100">{p.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="max-h-[60dvh] overflow-y-auto overscroll-contain px-4 py-4">
              <div className="relative grid grid-cols-2 gap-6">
                <div className="pointer-events-none absolute left-1/2 top-6 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg ring-4 ring-slate-900">
                  <ArrowLeftRight size={13} />
                </div>
                <TradeColumn
                  state={state}
                  side="left"
                  player={me}
                  cash={fromCash}
                  onCash={setFromCash}
                  tiles={myTiles}
                  selected={fromProperties}
                  onToggle={(i) => toggle(fromProperties, setFromProperties, i)}
                />
                <TradeColumn
                  state={state}
                  side="right"
                  player={them!}
                  cash={toCash}
                  onCash={setToCash}
                  tiles={theirTiles}
                  selected={toProperties}
                  onToggle={(i) => toggle(toProperties, setToProperties, i)}
                />
              </div>
              {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
            </div>

            <div className="border-t border-white/10 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <motion.button
                onClick={send}
                disabled={busy}
                whileTap={busy ? undefined : { scale: 0.97 }}
                transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-violet-500 disabled:opacity-50"
              >
                <Send size={16} />
                Send trade
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function TradeColumn({
  state,
  side,
  player,
  cash,
  onCash,
  tiles,
  selected,
  onToggle,
}: {
  state: GameState;
  side: 'left' | 'right';
  player: Player;
  cash: number;
  onCash: (v: number) => void;
  tiles: number[];
  selected: number[];
  onToggle: (tileIndex: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-slate-950"
          style={{ backgroundColor: player.color }}
        >
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate text-xs font-medium text-slate-200">{player.name}</span>
      </div>

      {/* Inset on the inner edge keeps the thumb's travel clear of the swap badge overlaid in the gap between columns. */}
      <div className={`w-full ${side === 'left' ? 'pr-4' : 'pl-4'}`}>
        <input
          type="range"
          min={0}
          max={player.cash}
          value={Math.min(cash, player.cash)}
          onChange={(e) => onCash(Number(e.target.value))}
          className="w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
        />
      </div>
      <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-violet-200 ring-1 ring-inset ring-violet-500/30">
        ${Math.min(cash, player.cash)}
      </span>

      <div className="mt-1 w-full space-y-1">
        {tiles.length === 0 ? (
          <p className="text-center text-[11px] text-slate-600">No properties</p>
        ) : (
          tiles.map((i) => {
            const tile = state.board.tiles[i];
            const dot = tile?.kind === 'property' ? GROUP_COLORS[tile.group] : undefined;
            const price = tile && 'price' in tile ? tile.price : undefined;
            const isSelected = selected.includes(i);
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => onToggle(i)}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                className={`flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-left text-[11px] ring-1 ring-inset transition-colors ${
                  isSelected ? 'bg-violet-500/20 text-violet-100 ring-violet-500/40' : 'bg-white/5 text-slate-300 ring-white/10'
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
                  <span className="truncate">{tileName(state, i)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-slate-400">${price}</span>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
