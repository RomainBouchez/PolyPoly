import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameAction, GameState, PlayerId } from '@polypoly/engine';
import { TradeModal } from './TradeModal.js';

interface TradePanelProps {
  state: GameState;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}

function tileName(state: GameState, tileIndex: number): string {
  const tile = state.board.tiles[tileIndex];
  return tile && tile.kind !== 'go' && tile.kind !== 'jail' && tile.kind !== 'vacation' && tile.kind !== 'go-to-jail' && tile.kind !== 'card'
    ? tile.name
    : `Tile ${tileIndex}`;
}

export function TradePanel({ state, myPlayerId, onAction }: TradePanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const others = state.turnOrder.filter((id) => id !== myPlayerId && state.players[id]?.status === 'active');

  const incoming = state.pendingTrades.filter((t) => t.toId === myPlayerId);
  const outgoing = state.pendingTrades.filter((t) => t.fromId === myPlayerId);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-lg shadow-black/20">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Trades</h2>

      {incoming.map((t) => (
        <div key={t.id} className="mb-2 rounded-xl bg-white/5 p-2.5 text-sm ring-1 ring-inset ring-white/10">
          <p className="text-slate-200">
            {state.players[t.fromId]?.name} offers {t.fromProperties.map((i) => tileName(state, i)).join(', ') || 'nothing'}
            {t.fromCash > 0 && ` + $${t.fromCash}`} for {t.toProperties.map((i) => tileName(state, i)).join(', ') || 'nothing'}
            {t.toCash > 0 && ` + $${t.toCash}`}
          </p>
          <div className="mt-1.5 flex gap-2">
            <motion.button
              onClick={() => onAction({ type: 'respond-trade', playerId: myPlayerId, tradeId: t.id, accept: true })}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
              className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 active:bg-emerald-400"
            >
              Accept
            </motion.button>
            <motion.button
              onClick={() => onAction({ type: 'respond-trade', playerId: myPlayerId, tradeId: t.id, accept: false })}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200 active:bg-white/15"
            >
              Decline
            </motion.button>
          </div>
        </div>
      ))}

      {outgoing.map((t) => (
        <div key={t.id} className="mb-2 rounded-xl bg-white/5 p-2.5 text-sm ring-1 ring-inset ring-white/10">
          <p className="text-slate-200">Offer sent to {state.players[t.toId]?.name}, waiting for response…</p>
          <motion.button
            onClick={() => onAction({ type: 'cancel-trade', playerId: myPlayerId, tradeId: t.id })}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            className="mt-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200 active:bg-white/15"
          >
            Cancel
          </motion.button>
        </div>
      ))}

      {others.length === 0 ? (
        <p className="text-sm text-slate-500">No one to trade with</p>
      ) : (
        <motion.button
          onClick={() => setModalOpen(true)}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
          className="w-full rounded-lg bg-violet-600 px-2 py-2 text-sm font-semibold text-white active:bg-violet-500"
        >
          Propose a trade
        </motion.button>
      )}

      <AnimatePresence>
        {modalOpen && (
          <TradeModal state={state} myPlayerId={myPlayerId} onAction={onAction} onClose={() => setModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
