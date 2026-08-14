import { AnimatePresence, motion } from 'motion/react';
import type { GameEvent, GameState } from '@polypoly/engine';

export function ActivityFeed({ events, state }: { events: GameEvent[]; state: GameState }) {
  const recent = [...events].reverse().slice(0, 40);
  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-lg shadow-black/20">
      <h2 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Activity</h2>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto text-xs text-slate-400">
        <AnimatePresence initial={false}>
          {recent.map((event, i) => (
            <motion.li
              key={events.length - i}
              initial={i === 0 ? { opacity: 0, x: -6 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className={i === 0 ? 'text-slate-300' : undefined}
            >
              {describeEvent(event, state)}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function name(state: GameState, playerId: string): string {
  return state.players[playerId]?.name ?? playerId;
}

function tileName(state: GameState, tileIndex: number): string {
  const tile = state.board.tiles[tileIndex];
  return tile && tile.kind !== 'go' && tile.kind !== 'jail' && tile.kind !== 'vacation' && tile.kind !== 'go-to-jail' && tile.kind !== 'card'
    ? tile.name
    : `tile ${tileIndex}`;
}

function describeEvent(event: GameEvent, state: GameState): string {
  switch (event.type) {
    case 'rolled':
      return `${name(state, event.playerId)} rolled ${event.dice[0]}+${event.dice[1]}`;
    case 'moved':
      return `${name(state, event.playerId)} moved to ${tileName(state, event.to)}`;
    case 'collected-go':
      return `${name(state, event.playerId)} collected $${event.amount} for passing Go`;
    case 'rent-paid':
      return `${name(state, event.from)} paid $${event.amount} rent to ${name(state, event.to)}`;
    case 'tax-paid':
      return `${name(state, event.playerId)} paid $${event.amount} tax`;
    case 'purchased':
      return `${name(state, event.playerId)} bought ${tileName(state, event.tileIndex)} for $${event.price}`;
    case 'declined-purchase':
      return `${name(state, event.playerId)} declined to buy ${tileName(state, event.tileIndex)}`;
    case 'sent-to-jail':
      return `${name(state, event.playerId)} was sent to jail (${event.reason})`;
    case 'released-from-jail':
      return `${name(state, event.playerId)} left jail (${event.method})`;
    case 'stayed-in-jail':
      return `${name(state, event.playerId)} stayed in jail`;
    case 'card-drawn':
      return `${name(state, event.playerId)} drew: ${event.text}`;
    case 'card-effect':
      return `${name(state, event.playerId)} — ${event.description}`;
    case 'health-effect':
      return `${name(state, event.playerId)} at ${tileName(state, event.tileIndex)}: ${event.cashDelta !== 0 ? `$${event.cashDelta} ` : ''}${
        event.healthDelta !== 0 ? `${event.healthDelta > 0 ? '+' : ''}${event.healthDelta} health` : ''
      }`;
    case 'illness':
      return `${name(state, event.playerId)} got sick${event.doublePeine ? ' (double peine)' : ''} — -${event.healthLoss} health`;
    case 'landed-on-vacation':
      return `${name(state, event.playerId)} collected $${event.amount} on Vacation`;
    case 'house-built':
      return `${name(state, event.playerId)} built on ${tileName(state, event.tileIndex)} (${event.houses} 🏠)`;
    case 'house-sold':
      return `${name(state, event.playerId)} sold a house on ${tileName(state, event.tileIndex)}`;
    case 'mortgaged':
      return `${name(state, event.playerId)} mortgaged ${tileName(state, event.tileIndex)} for $${event.amount}`;
    case 'unmortgaged':
      return `${name(state, event.playerId)} lifted the mortgage on ${tileName(state, event.tileIndex)}`;
    case 'auction-started':
      return `Auction started for ${tileName(state, event.tileIndex)}`;
    case 'auction-bid':
      return `${name(state, event.playerId)} bid $${event.amount}`;
    case 'auction-passed':
      return `${name(state, event.playerId)} passed`;
    case 'auction-won':
      return `${name(state, event.playerId)} won the auction for $${event.amount}`;
    case 'auction-no-sale':
      return `No one bid on ${tileName(state, event.tileIndex)}`;
    case 'trade-proposed':
      return `${name(state, event.fromId)} proposed a trade to ${name(state, event.toId)}`;
    case 'trade-accepted':
      return `Trade #${event.tradeId} accepted`;
    case 'trade-declined':
      return `Trade #${event.tradeId} declined`;
    case 'trade-cancelled':
      return `Trade #${event.tradeId} cancelled`;
    case 'debt-pending':
      return `${name(state, event.playerId)} owes $${event.amount}`;
    case 'debt-settled':
      return `${name(state, event.playerId)} settled their debt`;
    case 'bankrupt':
      return `${name(state, event.playerId)} went bankrupt`;
    case 'turn-ended':
      return `— ${name(state, event.nextPlayerId)}'s turn —`;
    case 'game-over':
      return `🏆 ${name(state, event.winnerId)} wins the game!`;
  }
}
