import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { getLegalActions, type GameAction, type GameState, type PlayerId } from '@polypoly/engine';

interface ActionPanelProps {
  state: GameState;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}

const TURN_ACTION_TYPES = new Set<GameAction['type']>([
  'roll',
  'buy',
  'decline-purchase',
  'pay-jail-fine',
  'roll-for-jail',
  'use-jail-card',
  'auction-bid',
  'auction-pass',
  'pay-debt',
  'declare-bankruptcy',
  'take-hostage',
]);

export function ActionPanel({ state, myPlayerId, onAction }: ActionPanelProps) {
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<number | null>(null);

  const legal = getLegalActions(state, myPlayerId).filter((a) => TURN_ACTION_TYPES.has(a.type));

  async function run(action: GameAction) {
    setBusy(true);
    const result = await onAction(action);
    setBusy(false);
    setLastError(result.ok ? null : (result.reason ?? 'Action failed'));
  }

  if (state.phase.type === 'game-over') {
    const winner = state.players[state.phase.winnerId];
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-emerald-400">🏆 {winner?.name} wins!</p>
      </div>
    );
  }

  if (legal.length === 0) {
    if (state.phase.type === 'awaiting-roll') {
      return (
        <div className="flex justify-center">
          <ActionButton disabled variant="primary" onClick={() => {}}>
            🎲 Roll dice
          </ActionButton>
        </div>
      );
    }
    return <p className="text-center text-sm text-slate-500">Waiting for other players…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-xs space-y-3">
      {state.phase.type === 'awaiting-purchase' && (
        <PurchaseInfo state={state} tileIndex={state.phase.tileIndex} />
      )}
      {state.phase.type === 'auction' && (
        <p className="rounded-full bg-amber-500/10 px-3 py-1.5 text-center text-sm text-amber-300 ring-1 ring-inset ring-amber-500/20">
          High bid: <span className="font-semibold">${state.phase.highBid}</span>
          {state.phase.highBidderId && <> by {state.players[state.phase.highBidderId]?.name}</>}
        </p>
      )}
      {state.phase.type === 'awaiting-debt-settlement' && (
        <p className="rounded-full bg-red-500/10 px-3 py-1.5 text-center text-sm text-red-400 ring-1 ring-inset ring-red-500/20">
          You owe ${state.phase.amount} — pay up or go bankrupt.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {legal.map((action) => {
          if (action.type === 'auction-bid') {
            // Bids raise in $10 steps — the min from the engine already
            // reflects the current high bid + the minimum increment.
            const min = action.amount;
            const amount = Math.max(bidAmount ?? min, min);
            return (
              <div key="auction-bid" className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-white/10 bg-slate-800">
                  <motion.button
                    type="button"
                    disabled={amount <= min}
                    onClick={() => setBidAmount(amount - 10)}
                    whileTap={amount > min ? { scale: 0.9 } : undefined}
                    transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                    className="px-3 py-1.5 text-lg leading-none text-slate-300 disabled:opacity-30"
                  >
                    −
                  </motion.button>
                  <span className="min-w-[3.5rem] px-1 text-center text-sm font-semibold tabular-nums text-slate-100">
                    ${amount}
                  </span>
                  <motion.button
                    type="button"
                    onClick={() => setBidAmount(amount + 10)}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                    className="px-3 py-1.5 text-lg leading-none text-slate-300"
                  >
                    +
                  </motion.button>
                </div>
                <ActionButton disabled={busy} variant="primary" onClick={() => run({ ...action, amount })}>
                  Bid
                </ActionButton>
              </div>
            );
          }
          return (
            <ActionButton
              key={action.type}
              disabled={busy}
              variant={action.type === 'declare-bankruptcy' ? 'danger' : isPrimaryAction(action.type) ? 'primary' : 'secondary'}
              onClick={() => {
                if (action.type === 'declare-bankruptcy' && !confirm('Declare bankruptcy? This ends your game.')) return;
                run(action);
              }}
            >
              {actionLabel(action, state)}
            </ActionButton>
          );
        })}
      </div>

      {lastError && <p className="text-center text-sm text-red-400">{lastError}</p>}
    </div>
  );
}

function PurchaseInfo({ state, tileIndex }: { state: GameState; tileIndex: number }) {
  const tile = state.board.tiles[tileIndex];
  if (!tile || (tile.kind !== 'property' && tile.kind !== 'airport' && tile.kind !== 'utility' && tile.kind !== 'hospital'))
    return null;
  return (
    <p className="rounded-full bg-white/5 px-3 py-1.5 text-center text-sm text-slate-300 ring-1 ring-inset ring-white/10">
      {tile.name} — <span className="font-semibold text-amber-400">${tile.price}</span>
    </p>
  );
}

const PRIMARY_ACTION_TYPES = new Set<GameAction['type']>([
  'roll',
  'roll-for-jail',
  'buy',
  'pay-jail-fine',
  'use-jail-card',
  'pay-debt',
]);

function isPrimaryAction(type: GameAction['type']): boolean {
  return PRIMARY_ACTION_TYPES.has(type);
}

function actionLabel(action: GameAction, state: GameState): string {
  switch (action.type) {
    case 'roll':
      return '🎲 Roll dice';
    case 'buy':
      return 'Buy';
    case 'decline-purchase':
      return 'Decline';
    case 'pay-jail-fine':
      return 'Pay $50 fine';
    case 'roll-for-jail':
      return '🎲 Try for doubles';
    case 'use-jail-card':
      return 'Use Get Out of Jail Free';
    case 'auction-pass':
      return 'Pass';
    case 'pay-debt':
      return state.phase.type === 'awaiting-debt-settlement' ? `Pay $${state.phase.amount}` : 'Pay debt';
    case 'declare-bankruptcy':
      return 'Declare bankruptcy';
    case 'take-hostage': {
      const tile = state.board.tiles[action.tileIndex];
      const name = tile && 'name' in tile ? tile.name : `tile ${action.tileIndex}`;
      return `🎭 Kidnap ${name}`;
    }
    default:
      return action.type;
  }
}

const VARIANT_STYLES = {
  primary: 'bg-emerald-500 text-slate-950 active:bg-emerald-400',
  secondary: 'bg-white/5 text-slate-200 ring-1 ring-inset ring-white/10 active:bg-white/10',
  danger: 'bg-red-600 text-white active:bg-red-500',
};

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm shadow-black/10 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]}`}
    >
      {children}
    </motion.button>
  );
}
