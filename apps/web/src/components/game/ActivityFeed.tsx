import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { GameEvent, GameState } from '@polypoly/engine';
import { PlayerName, TileLabel } from './GameLabels.js';

export function ActivityFeed({ events, state }: { events: GameEvent[]; state: GameState }) {
  const recent = [...events].reverse().slice(0, 40);
  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-lg shadow-black/20">
      <h2 className="mb-2 shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Activity</h2>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto text-center text-xs text-slate-400">
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

function squatLevelLabel(level: number): string {
  return level === 5 ? 'hotel' : `${level}-house`;
}

function describeEvent(event: GameEvent, state: GameState): ReactNode {
  const P = ({ id }: { id: string }) => <PlayerName state={state} playerId={id} />;
  const T = ({ i }: { i: number }) => <TileLabel state={state} tileIndex={i} />;

  switch (event.type) {
    case 'rolled':
      return (
        <>
          <P id={event.playerId} /> rolled {event.dice[0]}+{event.dice[1]}
        </>
      );
    case 'moved':
      return (
        <>
          <P id={event.playerId} /> moved to <T i={event.to} />
        </>
      );
    case 'collected-go':
      return (
        <>
          <P id={event.playerId} /> collected ${event.amount} for passing Go
        </>
      );
    case 'rent-paid':
      return (
        <>
          <P id={event.from} /> paid ${event.amount} rent to <P id={event.to} />
        </>
      );
    case 'tax-paid':
      return (
        <>
          <P id={event.playerId} /> paid ${event.amount} tax
        </>
      );
    case 'wealth-tax-paid':
      return (
        <>
          ⚖️ <P id={event.playerId} /> paid ${event.amount} in Departure Tax to <P id={event.toId} />
        </>
      );
    case 'purchased':
      return (
        <>
          <P id={event.playerId} /> bought <T i={event.tileIndex} /> for ${event.price}
        </>
      );
    case 'declined-purchase':
      return (
        <>
          <P id={event.playerId} /> declined to buy <T i={event.tileIndex} />
        </>
      );
    case 'sent-to-jail':
      return (
        <>
          <P id={event.playerId} /> was sent to jail ({event.reason})
        </>
      );
    case 'released-from-jail':
      return (
        <>
          <P id={event.playerId} /> left jail ({event.method})
        </>
      );
    case 'stayed-in-jail':
      return (
        <>
          <P id={event.playerId} /> stayed in jail
        </>
      );
    case 'card-drawn':
      return (
        <>
          <P id={event.playerId} /> drew: {event.text}
        </>
      );
    case 'card-effect':
      return (
        <>
          <P id={event.playerId} /> — {event.description}
        </>
      );
    case 'health-effect':
      return (
        <>
          <P id={event.playerId} /> at <T i={event.tileIndex} />: {event.cashDelta !== 0 ? `$${event.cashDelta} ` : ''}
          {event.healthDelta !== 0 ? `${event.healthDelta > 0 ? '+' : ''}${event.healthDelta} health` : ''}
        </>
      );
    case 'illness':
      return (
        <>
          <P id={event.playerId} /> got sick{event.doublePeine ? ' (double peine)' : ''} — -{event.healthLoss} health
          {event.cashPaid > 0 && <>, ${event.cashPaid} in hospital fees</>}
        </>
      );
    case 'jail-health-lost':
      return (
        <>
          <P id={event.playerId} /> is worn down by jail — -{event.amount} health
        </>
      );
    case 'landed-on-vacation':
      return (
        <>
          <P id={event.playerId} /> collected ${event.amount} on Vacation
        </>
      );
    case 'house-built':
      return (
        <>
          <P id={event.playerId} /> built on <T i={event.tileIndex} /> ({event.houses} 🏠)
        </>
      );
    case 'house-sold':
      return (
        <>
          <P id={event.playerId} /> sold a house on <T i={event.tileIndex} />
        </>
      );
    case 'mortgaged':
      return (
        <>
          <P id={event.playerId} /> mortgaged <T i={event.tileIndex} /> for ${event.amount}
        </>
      );
    case 'unmortgaged':
      return (
        <>
          <P id={event.playerId} /> lifted the mortgage on <T i={event.tileIndex} />
        </>
      );
    case 'auction-started':
      return (
        <>
          Auction started for <T i={event.tileIndex} />
        </>
      );
    case 'auction-bid':
      return (
        <>
          <P id={event.playerId} /> bid ${event.amount}
        </>
      );
    case 'auction-passed':
      return (
        <>
          <P id={event.playerId} /> passed
        </>
      );
    case 'auction-won':
      return (
        <>
          <P id={event.playerId} /> won the auction for ${event.amount}
        </>
      );
    case 'auction-no-sale':
      return (
        <>
          No one bid on <T i={event.tileIndex} />
        </>
      );
    case 'trade-proposed':
      return (
        <>
          <P id={event.fromId} /> proposed a trade to <P id={event.toId} />
        </>
      );
    case 'trade-accepted':
      return `Trade #${event.tradeId} accepted`;
    case 'trade-declined':
      return `Trade #${event.tradeId} declined`;
    case 'trade-cancelled':
      return `Trade #${event.tradeId} cancelled`;
    case 'trade-countered':
      return (
        <>
          <P id={event.fromId} /> countered <P id={event.toId} />'s offer
        </>
      );
    case 'debt-pending':
      return (
        <>
          <P id={event.playerId} /> owes ${event.amount}
        </>
      );
    case 'debt-settled':
      return (
        <>
          <P id={event.playerId} /> settled their debt
        </>
      );
    case 'squat-granted':
      return (
        <>
          <P id={event.playerId} /> got a Squat pass for {squatLevelLabel(event.buildingLevel)} properties
        </>
      );
    case 'squat-target-chosen':
      return (
        <>
          <P id={event.playerId} /> will squat <P id={event.targetId} />'s <T i={event.tileIndex} />
        </>
      );
    case 'squat-skipped':
      return (
        <>
          <P id={event.playerId} /> skipped their Squat pass
        </>
      );
    case 'squatted':
      return (
        <>
          <P id={event.playerId} /> squatted <P id={event.targetId} />'s <T i={event.tileIndex} /> — stayed free
        </>
      );
    case 'bankrupt':
      return (
        <>
          <P id={event.playerId} /> went bankrupt
        </>
      );
    case 'turn-ended':
      return (
        <>
          — <P id={event.nextPlayerId} />'s turn —
        </>
      );
    case 'game-over':
      return (
        <>
          🏆 <P id={event.winnerId} /> wins the game!
        </>
      );
    case 'emergency-fine':
      return (
        <>
          🚑 <P id={event.playerId} /> paid a ${event.amount} emergency fine
        </>
      );
    case 'sunny-day-started':
      return `☀️ Sunny day! Rent halved for ${event.turns} turn${event.turns > 1 ? 's' : ''}`;
    case 'sunny-day-ended':
      return '☀️ The sunny day is over';
    case 'rainy-day-started':
      return `🌧️ Rainy day! Rent doubled for ${event.turns} turn${event.turns > 1 ? 's' : ''}`;
    case 'rainy-day-ended':
      return '🌧️ The rain has stopped';
    case 'alliance-formed':
      return (
        <>
          🤝 <P id={event.players[0]} /> and <P id={event.players[1]} /> formed an alliance
        </>
      );
    case 'alliance-ended':
      return (
        <>
          <P id={event.players[0]} /> and <P id={event.players[1]} />'s alliance ended
        </>
      );
    case 'health-transferred':
      return (
        <>
          <P id={event.fromId} /> gave {event.amount} health to <P id={event.toId} />
        </>
      );
    case 'hostage-taken':
      return (
        <>
          <P id={event.playerId} /> took <T i={event.tileIndex} /> hostage
        </>
      );
    case 'hostage-released':
      return (
        <>
          <P id={event.playerId} /> released <T i={event.tileIndex} />
        </>
      );
  }
}
