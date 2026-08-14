import { motion, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { getLegalActions, type GameAction, type GameState, type PlayerId } from '@polypoly/engine';

interface PropertyCardProps {
  state: GameState;
  tileIndex: number;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
  onClose: () => void;
}

const RENT_ROW_LABELS = ['with rent', 'with one house', 'with two houses', 'with three houses', 'with four houses', 'with a hotel'];

// Past this offset or velocity, a downward drag commits to dismissal instead
// of springing back — mirrors a native sheet's flick-to-close threshold.
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 800;

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

  function handleDragEnd(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
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
        className="w-full max-w-sm touch-none overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl sm:touch-auto sm:rounded-3xl"
      >
        <div className="flex cursor-grab justify-center pt-2 active:cursor-grabbing sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-white/15" />
        </div>

        <div className="relative bg-slate-800/60 px-4 py-3 text-center">
          <h2 className="text-lg font-bold tracking-tight">{tile.name}</h2>
          <button
            onClick={onClose}
            className="absolute right-2.5 top-2 rounded-full p-1.5 text-slate-400 transition-colors active:bg-white/10 active:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65dvh] overflow-y-auto overscroll-contain">
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
                  <span className="tabular-nums">${rent}</span>
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

          <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-sm">
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

          <div className="grid grid-cols-3 gap-2 border-t border-white/10 px-4 py-3 text-center text-sm">
            <div>
              <div className="text-slate-500">Price</div>
              <div className="font-semibold tabular-nums">${tile.price}</div>
            </div>
            {tile.kind === 'property' && (
              <>
                <div>
                  <div className="text-slate-500">🏠</div>
                  <div className="font-semibold tabular-nums">${tile.houseCost}</div>
                </div>
                <div>
                  <div className="text-slate-500">🏨</div>
                  <div className="font-semibold tabular-nums">${tile.houseCost}</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pb-[env(safe-area-inset-bottom)]" />
      </motion.div>
    </motion.div>
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
    <motion.button
      onClick={onClick}
      title={label}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-lg text-white active:bg-violet-500"
    >
      {children}
    </motion.button>
  );
}
