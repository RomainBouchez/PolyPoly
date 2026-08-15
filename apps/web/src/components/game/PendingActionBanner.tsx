import { AnimatePresence, motion } from 'motion/react';
import type { GameState, PlayerId } from '@polypoly/engine';

interface PendingAction {
  key: string;
  icon: string;
  title: string;
  detail: string;
}

function playerName(state: GameState, id: PlayerId): string {
  return state.players[id]?.name ?? 'A player';
}

function tileName(state: GameState, tileIndex: number): string {
  const tile = state.board.tiles[tileIndex];
  return tile && 'name' in tile ? tile.name : `tile ${tileIndex}`;
}

/**
 * What the game is currently waiting on — not a log of what happened. The
 * distinction is the whole point: an action that takes time and blocks
 * everyone (an offer awaiting an answer, a live auction, a player who must
 * raise cash) earns a place here; a state like "in jail" does not, because
 * nobody is waiting on it.
 *
 * Derived from state rather than the event stream so it survives a reconnect:
 * a player who reloads mid-auction still sees the auction.
 */
export function pendingAction(state: GameState): PendingAction | null {
  const phase = state.phase;

  if (phase.type === 'auction') {
    const leader = phase.highBidderId ? playerName(state, phase.highBidderId) : null;
    return {
      key: `auction-${phase.tileIndex}`,
      icon: '🔨',
      title: `Auction — ${tileName(state, phase.tileIndex)}`,
      detail: leader ? `${leader} leads at $${phase.highBid}` : 'No bids yet',
    };
  }

  if (phase.type === 'awaiting-debt-settlement') {
    const owed = phase.creditorId === 'bank' ? 'the bank' : playerName(state, phase.creditorId);
    return {
      key: `debt-${phase.playerId}`,
      icon: '💸',
      title: `${playerName(state, phase.playerId)} owes $${phase.amount}`,
      detail: `Selling or mortgaging to pay ${owed}`,
    };
  }

  const undecidedSquat = state.heldSquatCards.find((h) => h.targetTileIndex === undefined);
  if (undecidedSquat) {
    return {
      key: `squat-${undecidedSquat.playerId}`,
      icon: '🏚️',
      title: `${playerName(state, undecidedSquat.playerId)} drew a Squat pass`,
      detail: 'Choosing a property to squat',
    };
  }

  const trade = state.pendingTrades[0];
  if (trade) {
    return {
      key: `trade-${trade.id}`,
      icon: '🤝',
      title: `${playerName(state, trade.fromId)} → ${playerName(state, trade.toId)}`,
      detail: `Waiting on ${playerName(state, trade.toId)} to answer`,
    };
  }

  return null;
}

/** Centred card for the shared board screen. */
export function PendingActionBanner({ state }: { state: GameState }) {
  const action = pendingAction(state);
  return (
    <AnimatePresence mode="popLayout">
      {action && (
        <motion.div
          key={action.key}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ type: 'spring', bounce: 0.15, visualDuration: 0.35 }}
          className="w-full max-w-sm rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-2.5 text-center backdrop-blur-sm"
        >
          <p className="text-sm font-semibold text-amber-100">
            {action.icon} {action.title}
          </p>
          <p className="mt-0.5 text-xs text-amber-200/70">{action.detail}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Slim strip for the phone, sitting under the header rather than taking a
 *  whole card — space is at a premium there. */
export function PendingActionStrip({ state }: { state: GameState }) {
  const action = pendingAction(state);
  return (
    <AnimatePresence mode="popLayout">
      {action && (
        <motion.div
          key={action.key}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: 'spring', bounce: 0, visualDuration: 0.3 }}
          className="overflow-hidden"
        >
          {/* Title and detail share one truncating line: the strip has to fit
              the narrowest phone, and a separate detail column would either
              wrap or need a breakpoint this project does not define. */}
          <div className="flex items-center gap-2 border-b border-amber-400/20 bg-amber-500/10 px-3 py-1.5">
            <span className="shrink-0 text-sm leading-none">{action.icon}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-amber-200/70">
              <span className="font-medium text-amber-100">{action.title}</span>
              <span className="mx-1.5">·</span>
              {action.detail}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
