import { useState } from 'react';
import { motion, type PanInfo } from 'motion/react';
import { Check, Pencil, X } from 'lucide-react';
import type { GameAction, GameState, PlayerId, TradeOffer } from '@polypoly/engine';
import { tileIcon } from '../board/BoardTile.js';
import { GROUP_FLAG_SVG } from '../board/tileLayout.js';

interface IncomingTradeModalProps {
  state: GameState;
  trade: TradeOffer;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
  /** Hand the offer to the trade builder so it can be answered with changes. */
  onNegotiate: (trade: TradeOffer) => void;
  onClose: () => void;
}

const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 800;

function tileName(state: GameState, tileIndex: number): string {
  const tile = state.board.tiles[tileIndex];
  return tile && 'name' in tile ? tile.name : `Tile ${tileIndex}`;
}

function PropertyChip({ state, tileIndex }: { state: GameState; tileIndex: number }) {
  const tile = state.board.tiles[tileIndex];
  // Properties carry a country flag; airports, utilities and hospitals have
  // none, so they fall back to the same emoji the board gives them.
  const flagSvg = tile?.kind === 'property' ? GROUP_FLAG_SVG[tile.group] : undefined;
  const icon = !flagSvg && tile ? tileIcon(tile) : undefined;
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] ring-1 ring-inset ring-white/10">
      {flagSvg && (
        <span
          className="block h-2.5 w-4 shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.25)] [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: flagSvg }}
        />
      )}
      {icon && <span className="w-4 shrink-0 text-center leading-none">{icon}</span>}
      <span className="truncate">{tileName(state, tileIndex)}</span>
    </span>
  );
}

function Side({ state, label, cash, properties }: { state: GameState; label: string; cash: number; properties: number[] }) {
  const empty = cash === 0 && properties.length === 0;
  return (
    <div className="flex-1 rounded-xl bg-black/20 p-2.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {empty ? (
        <p className="text-[11px] text-slate-600">Nothing</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {cash > 0 && (
            <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold tabular-nums text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
              ${cash}
            </span>
          )}
          {properties.map((i) => (
            <PropertyChip key={i} state={state} tileIndex={i} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pops when an offer arrives so it is not missed. Unlike the Squat modal this
 * one is dismissible: a trade can land while you are mid-turn, and forcing an
 * answer would interrupt whatever you were doing. Dismissing leaves the offer
 * standing in the Trades tab.
 */
export function IncomingTradeModal({ state, trade, myPlayerId, onAction, onNegotiate, onClose }: IncomingTradeModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = state.players[trade.fromId];

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    const result = await onAction({ type: 'respond-trade', playerId: myPlayerId, tradeId: trade.id, accept });
    setBusy(false);
    if (!result.ok) setError(result.reason ?? 'That did not go through');
    else onClose();
  }

  function handleDragEnd(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.55 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0.15, visualDuration: 0.4 }}
        className="w-full max-w-sm touch-none overflow-hidden rounded-t-3xl border border-violet-500/30 bg-slate-900 text-slate-100 shadow-2xl sm:touch-auto sm:rounded-3xl"
      >
        <div className="flex cursor-grab justify-center pt-2 active:cursor-grabbing sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-white/15" />
        </div>

        <div className="relative bg-violet-600/20 px-4 py-3 text-center">
          <h2 className="text-lg font-bold tracking-tight">🤝 Trade offer</h2>
          <p className="mt-0.5 text-sm text-violet-200">
            from <span style={{ color: from?.color }}>{from?.name ?? 'a player'}</span>
          </p>
          <button
            onClick={onClose}
            className="absolute right-2.5 top-2 rounded-full p-1.5 text-slate-400 transition-colors active:bg-white/10 active:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 px-4 py-3">
          <Side state={state} label="You get" cash={trade.fromCash} properties={trade.fromProperties} />
          <Side state={state} label="You give" cash={trade.toCash} properties={trade.toProperties} />
        </div>

        {error && <p className="px-4 pb-2 text-center text-xs text-red-300">{error}</p>}

        <div className="flex gap-2 border-t border-white/10 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <motion.button
            onClick={() => respond(false)}
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-inset ring-white/10 active:bg-white/10 disabled:opacity-50"
          >
            <X size={15} /> Decline
          </motion.button>
          <motion.button
            onClick={() => onNegotiate(trade)}
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-500/20 px-3 py-2.5 text-sm font-medium text-violet-100 ring-1 ring-inset ring-violet-500/40 active:bg-violet-500/30 disabled:opacity-50"
          >
            <Pencil size={15} /> Negotiate
          </motion.button>
          <motion.button
            onClick={() => respond(true)}
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2.5 text-sm font-medium text-emerald-100 ring-1 ring-inset ring-emerald-500/40 active:bg-emerald-500/30 disabled:opacity-50"
          >
            <Check size={15} /> Accept
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
