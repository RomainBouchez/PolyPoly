import { useState, type ReactNode } from 'react';
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
    return <p className="text-center text-sm text-slate-500">Waiting for other players…</p>;
  }

  return (
    <div className="w-full max-w-xs space-y-3">
      {state.phase.type === 'awaiting-purchase' && (
        <PurchaseInfo state={state} tileIndex={state.phase.tileIndex} />
      )}
      {state.phase.type === 'auction' && (
        <p className="text-center text-sm text-slate-300">
          High bid: <span className="font-semibold text-amber-400">${state.phase.highBid}</span>
          {state.phase.highBidderId && <> by {state.players[state.phase.highBidderId]?.name}</>}
        </p>
      )}
      {state.phase.type === 'awaiting-debt-settlement' && (
        <p className="text-center text-sm text-red-400">You owe ${state.phase.amount} — pay up or go bankrupt.</p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {legal.map((action) => {
          if (action.type === 'auction-bid') {
            const min = action.amount;
            return (
              <div key="auction-bid" className="flex items-center gap-2">
                <input
                  type="number"
                  min={min}
                  value={bidAmount ?? min}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
                />
                <ActionButton disabled={busy} onClick={() => run({ ...action, amount: bidAmount ?? min })}>
                  Bid
                </ActionButton>
              </div>
            );
          }
          return (
            <ActionButton
              key={action.type}
              disabled={busy}
              variant={action.type === 'declare-bankruptcy' ? 'danger' : 'default'}
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
  if (!tile || (tile.kind !== 'property' && tile.kind !== 'airport' && tile.kind !== 'utility')) return null;
  return (
    <p className="text-center text-sm text-slate-300">
      {tile.name} — <span className="font-semibold text-amber-400">${tile.price}</span>
    </p>
  );
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
    default:
      return action.type;
  }
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'default',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'danger'
          ? 'bg-red-600 text-white hover:bg-red-500'
          : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
      }`}
    >
      {children}
    </button>
  );
}
