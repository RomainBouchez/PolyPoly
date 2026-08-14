import { getLegalActions, type GameAction, type GameState, type PlayerId } from '@polypoly/engine';

interface PropertyCardProps {
  state: GameState;
  tileIndex: number;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
  onClose: () => void;
}

const RENT_ROW_LABELS = ['with rent', 'with one house', 'with two houses', 'with three houses', 'with four houses', 'with a hotel'];

export function PropertyCard({ state, tileIndex, myPlayerId, onAction, onClose }: PropertyCardProps) {
  const tile = state.board.tiles[tileIndex];
  if (!tile || (tile.kind !== 'property' && tile.kind !== 'airport' && tile.kind !== 'utility' && tile.kind !== 'hospital')) return null;

  const ownership = state.ownership[tileIndex];
  const owner = ownership ? state.players[ownership.ownerId] : null;
  const isMine = ownership?.ownerId === myPlayerId;
  const legal = getLegalActions(state, myPlayerId).filter((a) => 'tileIndex' in a && a.tileIndex === tileIndex);
  const build = legal.find((a) => a.type === 'build-house');
  const sell = legal.find((a) => a.type === 'sell-house');
  const mortgage = legal.find((a) => a.type === 'mortgage');
  const unmortgage = legal.find((a) => a.type === 'unmortgage');

  async function run(action: GameAction) {
    await onAction(action);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <div className="bg-slate-800 px-4 py-3 text-center">
          <h2 className="text-lg font-bold">{tile.name}</h2>
        </div>

        {tile.kind === 'property' && (
          <div className="px-4 py-2">
            <div className="flex justify-between text-xs uppercase tracking-wide text-slate-500">
              <span>when</span>
              <span>get</span>
            </div>
            {tile.rentLadder.map((rent, i) => (
              <div
                key={i}
                className={`flex justify-between rounded-md px-2 py-1.5 text-sm ${
                  (ownership?.houses ?? 0) === i ? 'bg-slate-800 font-semibold text-white' : 'text-slate-300'
                }`}
              >
                <span>{RENT_ROW_LABELS[i]}</span>
                <span>${rent}</span>
              </div>
            ))}
          </div>
        )}

        {tile.kind === 'property' && tile.healthEffect && (
          <div className="mx-4 mb-2 rounded-md bg-slate-800/60 px-3 py-2 text-sm text-slate-300">
            {healthEffectLabel(tile.healthEffect)}
          </div>
        )}

        {tile.kind === 'airport' && (
          <div className="px-4 py-2 text-sm text-slate-300">
            <p>Rent: $25 / $50 / $100 / $200 depending on how many airports the owner holds.</p>
          </div>
        )}
        {tile.kind === 'utility' && (
          <div className="px-4 py-2 text-sm text-slate-300">
            <p>Rent: dice roll ×4 with one utility, ×10 with both.</p>
          </div>
        )}
        {tile.kind === 'hospital' && (
          <div className="px-4 py-2 text-sm text-slate-300">
            <p>🏥 No rent for landing here. Pays out to the owner whenever another player gets sick (health mode).</p>
          </div>
        )}

        {isMine && (build || sell || mortgage || unmortgage) && (
          <div className="flex items-center justify-center gap-3 px-4 py-3">
            {build && (
              <IconButton label="Build" onClick={() => run(build)}>
                ↑
              </IconButton>
            )}
            {sell && (
              <IconButton label="Sell house" onClick={() => run(sell)}>
                ↓
              </IconButton>
            )}
            {mortgage && (
              <IconButton label="Mortgage" onClick={() => run(mortgage)}>
                🏦
              </IconButton>
            )}
            {unmortgage && (
              <IconButton label="Unmortgage" onClick={() => run(unmortgage)}>
                💰
              </IconButton>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-slate-800 px-4 py-2 text-sm">
          <span className="text-slate-500">Owner</span>
          {owner ? (
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: owner.color }} />
              {owner.name}
            </span>
          ) : (
            <span className="text-slate-400">Unowned</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-slate-800 px-4 py-3 text-center text-sm">
          <div>
            <div className="text-slate-500">Price</div>
            <div className="font-semibold">${tile.price}</div>
          </div>
          {tile.kind === 'property' && (
            <>
              <div>
                <div className="text-slate-500">🏠</div>
                <div className="font-semibold">${tile.houseCost}</div>
              </div>
              <div>
                <div className="text-slate-500">🏨</div>
                <div className="font-semibold">${tile.houseCost}</div>
              </div>
            </>
          )}
        </div>

        <button onClick={onClose} className="w-full border-t border-slate-800 py-2 text-sm text-slate-400 hover:text-slate-200">
          Close
        </button>
      </div>
    </div>
  );
}

function healthEffectLabel(effect: { cashDelta: number; healthDelta: number; pharmacy?: boolean }): string {
  if (effect.pharmacy) return '💊 Resets health to 50 (once per player per game)';
  const parts: string[] = [];
  if (effect.cashDelta !== 0) parts.push(`${effect.cashDelta > 0 ? '+' : ''}$${effect.cashDelta}`);
  if (effect.healthDelta !== 0) parts.push(`${effect.healthDelta > 0 ? '+' : ''}${effect.healthDelta} health`);
  return `Landing here: ${parts.join(', ')}`;
}

function IconButton({ children, label, onClick }: { children: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-lg text-white hover:bg-violet-500"
    >
      {children}
    </button>
  );
}
