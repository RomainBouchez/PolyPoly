import { useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import {
  AIRPORT_RENT_BY_COUNT,
  EMERGENCY_FINE,
  EMERGENCY_HEALTH_THRESHOLD,
  GO_HEALTH_BONUS,
  GO_SALARY,
  GO_SALARY_SICK,
  HEALTH_SICK_THRESHOLD,
  HOSPITAL_PAYOUT,
  JAIL_FINE,
  SUNNY_DAY_DURATION_MAX,
  SUNNY_DAY_DURATION_MIN,
  UNMORTGAGE_INTEREST,
  UTILITY_RENT_MULTIPLIER_BOTH,
  UTILITY_RENT_MULTIPLIER_ONE,
  WEALTH_TAX_RATE,
  getLegalActions,
  groupTiles,
  isOwnable,
  ownsFullGroup,
  type GameAction,
  type GameState,
  type PlayerId,
} from '@polypoly/engine';
import { tileIcon } from './BoardTile.js';

interface PropertyCardProps {
  state: GameState;
  tileIndex: number;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
  onClose: () => void;
}

const RENT_ROW_LABELS = ['with rent', 'with one house', 'with two houses', 'with three houses', 'with four houses', 'with a hotel'];

/**
 * Why the Build button is absent on a property you own. Without this the
 * button simply vanishes, which reads as the game being broken — most often
 * after a bankruptcy, when you have just spent your cash buying up the estate
 * or have inherited a set with a mortgage still on it.
 */
function buildBlockReason(state: GameState, playerId: PlayerId, tileIndex: number): string | null {
  const tile = state.board.tiles[tileIndex];
  if (!tile || tile.kind !== 'property') return null;
  const ownership = state.ownership[tileIndex];
  if (!ownership || ownership.ownerId !== playerId) return null;
  if (ownership.houses >= 5) return null; // already a hotel — nothing to explain

  const siblings = groupTiles(state.board, tile.group);
  if (!ownsFullGroup(state, playerId, tileIndex)) {
    const missing = siblings
      .filter((s) => state.ownership[s.index]?.ownerId !== playerId)
      .map((s) => s.name);
    return `You need the whole set to build — still missing ${missing.join(', ')}.`;
  }

  const mortgaged = siblings.filter((s) => state.ownership[s.index]?.mortgaged).map((s) => s.name);
  if (mortgaged.length > 0) return `Lift the mortgage on ${mortgaged.join(', ')} before building.`;

  if (state.config.evenBuild) {
    const minHouses = Math.min(...siblings.map((s) => state.ownership[s.index]?.houses ?? 0));
    if (ownership.houses > minHouses) {
      const lowest = siblings.filter((s) => (state.ownership[s.index]?.houses ?? 0) === minHouses).map((s) => s.name);
      return `Even build — put the next house on ${lowest.join(' or ')} first.`;
    }
  }

  const cash = state.players[playerId]?.cash ?? 0;
  if (cash < tile.houseCost) return `A house here costs $${tile.houseCost} — you have $${cash}.`;

  if (state.config.limitedHouseSupply) {
    const becomingHotel = ownership.houses === 4;
    if (becomingHotel && state.bank.hotelsRemaining <= 0) return 'The bank has no hotels left.';
    if (!becomingHotel && state.bank.housesRemaining <= 0) return 'The bank has no houses left.';
  }
  return null;
}

// Past this offset or velocity, a downward drag commits to dismissal instead
// of springing back — mirrors a native sheet's flick-to-close threshold.
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 800;

export function PropertyCard({ state, tileIndex, myPlayerId, onAction, onClose }: PropertyCardProps) {
  const tile = state.board.tiles[tileIndex];
  if (!tile) return null;

  const ownership = state.ownership[tileIndex];
  const owner = ownership ? state.players[ownership.ownerId] : null;
  const isMine = ownership?.ownerId === myPlayerId;
  const legal = getLegalActions(state, myPlayerId).filter((a) => 'tileIndex' in a && a.tileIndex === tileIndex);
  const build = legal.find((a) => a.type === 'build-house');
  const sell = legal.find((a) => a.type === 'sell-house');
  const mortgage = legal.find((a) => a.type === 'mortgage');
  const unmortgage = legal.find((a) => a.type === 'unmortgage');
  const [refusal, setRefusal] = useState<string | null>(null);
  const blockReason = isMine ? buildBlockReason(state, myPlayerId, tileIndex) : null;

  // What each button actually costs or pays, so nobody has to remember the
  // house price or work out the 10% interest on a mortgage in their head.
  const houseCost = tile.kind === 'property' ? tile.houseCost : 0;
  const mortgageValue = isOwnable(tile) ? tile.mortgageValue : 0;

  // The server is the authority, so a tap can still be refused even when the
  // action was offered — a race against another player, or a guard the legal-
  // action predicates do not model. Swallowing that reason made the button
  // look broken, so surface it.
  async function run(action: GameAction) {
    setRefusal(null);
    const result = await onAction(action);
    if (!result.ok) setRefusal(result.reason ?? 'That is not allowed right now');
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
          {(tile.kind === 'airport' || tile.kind === 'hospital' || tile.kind === 'utility') && (
            <div className="relative mx-auto mb-1 flex h-14 w-14 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full blur-md"
                style={{ background: 'radial-gradient(circle, rgba(148,163,253,0.45) 0%, transparent 70%)' }}
              />
              <span className="relative text-3xl leading-none drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]">{tileIcon(tile)}</span>
            </div>
          )}
          <h2 className="text-lg font-bold tracking-tight">{tileTitle(tile)}</h2>
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
            <div className="px-4 py-2">
              <div className="flex justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>when</span>
                <span>get</span>
              </div>
              {AIRPORT_RENT_BY_COUNT.map((rent, i) => {
                const count = i + 1;
                const owned = ownedCount(state, ownership?.ownerId, 'airport');
                return (
                  <div
                    key={i}
                    className={`flex justify-between rounded-md px-2 py-1.5 text-sm ${
                      owned === count ? 'bg-slate-800 font-semibold text-white' : 'text-slate-300'
                    }`}
                  >
                    <span>{count === 1 ? 'one airport is owned' : `${count} airports are owned`}</span>
                    <span className="tabular-nums">${rent}</span>
                  </div>
                );
              })}
            </div>
          )}

          {tile.kind === 'hospital' && (
            <div className="px-4 py-2">
              <p className="mb-1 text-xs text-slate-500">No rent for landing here — pays out when another player gets sick (health mode).</p>
              <div className="flex justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>when</span>
                <span>get</span>
              </div>
              {HOSPITAL_PAYOUT.map((payout, i) => {
                const count = i + 1;
                const owned = ownedCount(state, ownership?.ownerId, 'hospital');
                return (
                  <div
                    key={i}
                    className={`flex justify-between rounded-md px-2 py-1.5 text-sm ${
                      owned === count ? 'bg-slate-800 font-semibold text-white' : 'text-slate-300'
                    }`}
                  >
                    <span>{count === 1 ? 'one hospital is owned' : `${count} hospitals are owned`}</span>
                    <span className="tabular-nums">${payout}</span>
                  </div>
                );
              })}
            </div>
          )}

          {tile.kind === 'utility' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>
                If one company is owned, get ${UTILITY_RENT_MULTIPLIER_ONE} x 🎲
              </p>
              <p className="mt-1">
                If two companies are owned, get ${UTILITY_RENT_MULTIPLIER_BOTH} x 🎲
              </p>
            </div>
          )}

          {tile.kind === 'go' && (
            <div className="space-y-1.5 px-4 py-2 text-sm text-slate-300">
              <p>➡️ Collect ${GO_SALARY} every time you pass or land here.</p>
              {state.config.healthMode && (
                <>
                  <p>
                    🤒 While sick (health {HEALTH_SICK_THRESHOLD} or below) you only collect ${GO_SALARY_SICK}.
                  </p>
                  <p>❤️ Passing here also restores {GO_HEALTH_BONUS} health, sick or not.</p>
                </>
              )}
            </div>
          )}

          {tile.kind === 'jail' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>🚔 Just passing through here is free. Sent to jail elsewhere? Pay ${JAIL_FINE}, roll doubles, or use a Get Out of Jail Free card to get out.</p>
            </div>
          )}

          {tile.kind === 'go-to-jail' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>👮 Landing here sends you straight to jail — no passing Go, no collecting ${GO_SALARY}.</p>
            </div>
          )}

          {tile.kind === 'vacation' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>
                🏖️{' '}
                {state.config.vacationCash
                  ? 'Collect the whole vacation pot — filled by taxes and fines paid to the bank.'
                  : 'A free rest stop — nothing happens.'}
              </p>
            </div>
          )}

          {tile.kind === 'tax' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>💸 Pay ${tile.amount} to the bank when you land here.</p>
            </div>
          )}

          {tile.kind === 'wealth-tax' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>
                ⚖️ Pay {Math.round(WEALTH_TAX_RATE * 100)}% of your net worth straight to whoever currently has the least — skipped if that's already you.
              </p>
            </div>
          )}

          {tile.kind === 'card' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>{tile.deck === 'travel' ? '🧳' : '🛃'} Draw a card from the {tile.deck === 'travel' ? 'Travel' : 'Customs'} deck and follow its effect.</p>
            </div>
          )}

          {tile.kind === 'emergency' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>
                🚑 If your health is below {EMERGENCY_HEALTH_THRESHOLD}, pay a ${EMERGENCY_FINE} emergency fine. Above that, nothing happens. (health mode)
              </p>
            </div>
          )}

          {tile.kind === 'sunny' && (
            <div className="px-4 py-2 text-sm text-slate-300">
              <p>
                ☀️ If it's raining, landing here cuts the rain short and halves rent for {SUNNY_DAY_DURATION_MIN}-{SUNNY_DAY_DURATION_MAX} turns. If it isn't raining, nothing happens.
              </p>
            </div>
          )}

          {isMine && (build || sell || mortgage || unmortgage) && (
            <div className="flex items-center justify-center gap-3 px-4 py-3">
              {build && (
                <IconButton
                  label={(ownership?.houses ?? 0) === 4 ? 'Build hotel' : 'Build'}
                  amount={-houseCost}
                  onClick={() => run(build)}
                >
                  ↑
                </IconButton>
              )}
              {sell && (
                <IconButton
                  label={ownership?.houses === 5 ? 'Sell hotel' : 'Sell house'}
                  amount={houseCost / 2}
                  onClick={() => run(sell)}
                >
                  ↓
                </IconButton>
              )}
              {mortgage && (
                <IconButton label="Mortgage" amount={mortgageValue} onClick={() => run(mortgage)}>
                  🏦
                </IconButton>
              )}
              {unmortgage && (
                <IconButton
                  label="Unmortgage"
                  amount={-Math.round(mortgageValue * UNMORTGAGE_INTEREST)}
                  onClick={() => run(unmortgage)}
                >
                  💰
                </IconButton>
              )}
            </div>
          )}

          {isMine && !build && blockReason && (
            <p className="px-4 pb-3 text-center text-xs leading-snug text-amber-300/90">{blockReason}</p>
          )}

          <AnimatePresence>
            {refusal && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden px-4 pb-3 text-center text-xs leading-snug text-red-300"
              >
                {refusal}
              </motion.p>
            )}
          </AnimatePresence>

          {isOwnable(tile) && (
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-sm">
              <span className="text-slate-500">Owner</span>
              {owner ? (
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: owner.color }} />
                  {owner.name}
                </span>
              ) : (
                <span className="text-slate-400">No owner</span>
              )}
            </div>
          )}

          {isOwnable(tile) && (
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
          )}
        </div>

        <div className="pb-[env(safe-area-inset-bottom)]" />
      </motion.div>
    </motion.div>
  );
}

/** How many tiles of `kind` a player owns — used to highlight which
 *  when/get row currently applies on the airport/hospital rent tables. */
function ownedCount(state: GameState, ownerId: PlayerId | undefined, kind: 'airport' | 'hospital'): number {
  if (!ownerId) return 0;
  return state.board.tiles.filter((t) => t.kind === kind && state.ownership[t.index]?.ownerId === ownerId).length;
}

function tileTitle(tile: { kind: string; name?: string; deck?: 'travel' | 'customs' }): string {
  if (tile.kind === 'card') return tile.deck === 'travel' ? 'Travel' : 'Customs';
  return tile.name ?? tile.kind;
}

function healthEffectLabel(effect: { cashDelta: number; healthDelta: number; pharmacy?: boolean }): string {
  if (effect.pharmacy) return '💊 Resets health to 50 (once per player per game)';
  const parts: string[] = [];
  if (effect.cashDelta !== 0) parts.push(`${effect.cashDelta > 0 ? '+' : ''}$${effect.cashDelta}`);
  if (effect.healthDelta !== 0) parts.push(`${effect.healthDelta > 0 ? '+' : ''}${effect.healthDelta} health`);
  return `Landing here: ${parts.join(', ')}`;
}

/** `amount` is signed from the player's side: positive is cash in, negative is
 *  cash out. Shown on the button itself so the price is read before the tap. */
function IconButton({
  children,
  label,
  amount,
  onClick,
}: {
  children: string;
  label: string;
  amount: number;
  onClick: () => void;
}) {
  const price = `${amount >= 0 ? '+' : '−'}$${Math.abs(amount).toLocaleString('en-US')}`;
  return (
    <motion.button
      onClick={onClick}
      title={`${label} (${price})`}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
      className="flex flex-col items-center gap-0.5 rounded-2xl bg-violet-600 px-2.5 py-1.5 text-white active:bg-violet-500"
    >
      <span className="text-lg leading-none">{children}</span>
      <span className="text-[10px] font-medium leading-none whitespace-nowrap">{label}</span>
      <span
        className={`text-[10px] font-semibold leading-none tabular-nums whitespace-nowrap ${
          amount >= 0 ? 'text-emerald-200' : 'text-violet-200'
        }`}
      >
        {price}
      </span>
    </motion.button>
  );
}
