import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { BoardLayout, GameEvent, GameState } from '@polypoly/engine';

interface EventToastProps {
  events: GameEvent[];
  state: GameState;
  layout: BoardLayout;
}

/** Pops up near whichever tile triggered the most recent event, instead of
 *  always dead-center — e.g. "sent to jail" appears near the jail corner. */
export function EventToast({ events, state, layout }: EventToastProps) {
  const [visible, setVisible] = useState<{ key: number; icon: string; text: string; tileIndex: number | null } | null>(null);
  const lastCount = useRef(events.length);

  useEffect(() => {
    if (events.length <= lastCount.current) {
      lastCount.current = events.length;
      return;
    }
    const newEvents = events.slice(lastCount.current);
    lastCount.current = events.length;

    const notable = [...newEvents].reverse().find((e) => toastFor(e, state) !== null);
    if (!notable) return;
    const info = toastFor(notable, state)!;
    setVisible({ key: events.length, ...info });
    const timer = setTimeout(() => setVisible((v) => (v?.key === events.length ? null : v)), 2000);
    return () => clearTimeout(timer);
  }, [events, state]);

  const pos = visible?.tileIndex != null ? toastPosition(layout, visible.tileIndex) : { left: 50, top: 50 };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={visible.key}
          className="pointer-events-none absolute z-30 flex max-w-[80%] items-center gap-[10px] rounded-2xl border"
          style={{
            left: `${pos.left}%`,
            top: `${pos.top}%`,
            padding: '16px 22px',
            background: 'rgba(15, 20, 32, 0.96)',
            borderColor: 'rgba(255,255,255,0.14)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
          initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
          animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
          exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <span className="shrink-0 text-[26px] leading-none">{visible.icon}</span>
          <span className="text-sm font-semibold leading-tight text-slate-100">{visible.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function toastPosition(layout: BoardLayout, tileIndex: number): { left: number; top: number } {
  const pos = layout.positions[tileIndex];
  if (!pos) return { left: 50, top: 50 };
  const g = layout.gridSize;
  const clamp = (v: number) => Math.min(0.82, Math.max(0.18, v));
  return {
    left: clamp((pos.col - 1) / (g - 1)) * 100,
    top: clamp((pos.row - 1) / (g - 1)) * 100,
  };
}

function name(state: GameState, playerId: string): string {
  return state.players[playerId]?.name ?? playerId;
}

function tileName(state: GameState, tileIndex: number): string {
  const tile = state.board.tiles[tileIndex];
  return tile && 'name' in tile ? tile.name : `tile ${tileIndex}`;
}

/** Returns null for events that aren't worth a popup (e.g. a lone dice roll). */
function toastFor(event: GameEvent, state: GameState): { icon: string; text: string; tileIndex: number | null } | null {
  switch (event.type) {
    case 'purchased':
      return { icon: '🏠', text: `${name(state, event.playerId)} bought ${tileName(state, event.tileIndex)}`, tileIndex: event.tileIndex };
    case 'declined-purchase':
      return { icon: '🙅', text: `${name(state, event.playerId)} declined ${tileName(state, event.tileIndex)}`, tileIndex: event.tileIndex };
    case 'rent-paid':
      return { icon: '💰', text: `${name(state, event.from)} paid $${event.amount} rent to ${name(state, event.to)}`, tileIndex: event.tileIndex };
    case 'tax-paid':
      return { icon: '💸', text: `${name(state, event.playerId)} paid $${event.amount} tax`, tileIndex: null };
    case 'sent-to-jail':
      return { icon: '🚔', text: `${name(state, event.playerId)} was sent to jail`, tileIndex: null };
    case 'released-from-jail':
      return { icon: '🔓', text: `${name(state, event.playerId)} left jail`, tileIndex: null };
    case 'card-drawn':
      return { icon: event.deck === 'travel' ? '🧳' : '🛃', text: event.text, tileIndex: null };
    case 'health-effect':
      return {
        icon: '🩺',
        text: `${name(state, event.playerId)}: ${event.cashDelta !== 0 ? `$${event.cashDelta} ` : ''}${event.healthDelta !== 0 ? `${event.healthDelta > 0 ? '+' : ''}${event.healthDelta} health` : ''}`,
        tileIndex: event.tileIndex,
      };
    case 'illness':
      return { icon: '🤒', text: `${name(state, event.playerId)} got sick — -${event.healthLoss} health`, tileIndex: null };
    case 'landed-on-vacation':
      return { icon: '🏖️', text: `${name(state, event.playerId)} collected $${event.amount} on Vacation`, tileIndex: null };
    case 'house-built':
      return { icon: '🏗️', text: `${name(state, event.playerId)} built on ${tileName(state, event.tileIndex)}`, tileIndex: event.tileIndex };
    case 'house-sold':
      return { icon: '🏗️', text: `${name(state, event.playerId)} sold a house on ${tileName(state, event.tileIndex)}`, tileIndex: event.tileIndex };
    case 'mortgaged':
      return { icon: '🏦', text: `${name(state, event.playerId)} mortgaged ${tileName(state, event.tileIndex)}`, tileIndex: event.tileIndex };
    case 'unmortgaged':
      return { icon: '💵', text: `${name(state, event.playerId)} lifted the mortgage on ${tileName(state, event.tileIndex)}`, tileIndex: event.tileIndex };
    case 'auction-won':
      return { icon: '🔨', text: `${name(state, event.playerId)} won the auction for $${event.amount}`, tileIndex: event.tileIndex };
    case 'auction-no-sale':
      return { icon: '🔨', text: `No one bid on ${tileName(state, event.tileIndex)}`, tileIndex: event.tileIndex };
    case 'bankrupt':
      return { icon: '💀', text: `${name(state, event.playerId)} went bankrupt`, tileIndex: null };
    case 'game-over':
      return { icon: '🏆', text: `${name(state, event.winnerId)} wins the game!`, tileIndex: null };
    default:
      return null;
  }
}
