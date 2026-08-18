import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { BookOpen, Gamepad2, Map, Trophy } from 'lucide-react';
import { netWorth } from '@polypoly/engine';
import type { GameAction, GameEvent, GameState, LoggedEvent, PlayerId, TradeOffer } from '@polypoly/engine';
import type { NetWorthSnapshot } from '@polypoly/shared';
import { BoardGrid } from './board/BoardGrid.js';
import { tileIcon } from './board/BoardTile.js';
import { GROUP_COLORS, GROUP_FLAG_SVG } from './board/tileLayout.js';
import { PropertyCard } from './board/PropertyCard.js';
import { ActionPanel } from './game/ActionPanel.js';
import { AlliancePanel } from './game/AlliancePanel.js';
import { ActivityFeed } from './game/ActivityFeed.js';
import { CashValue } from './game/CashValue.js';
import { HealthBar, PlayersPanel } from './game/PlayersPanel.js';
import { GameRulesModal } from './game/GameRulesModal.js';
import { IncomingTradeModal } from './game/IncomingTradeModal.js';
import { MatchStatsModal } from './game/MatchStatsModal.js';
import { PendingActionStrip } from './game/PendingActionBanner.js';
import { RoundCounter } from './game/RoundCounter.js';
import { SquatModal } from './game/SquatModal.js';
import { TradeModal } from './game/TradeModal.js';
import { TradePanel } from './game/TradePanel.js';

interface ControllerProps {
  state: GameState;
  events: GameEvent[];
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}

interface ControllerRootProps extends ControllerProps {
  fetchMatchLog: () => Promise<{ log: LoggedEvent[]; logComplete: boolean; netWorthHistory: NetWorthSnapshot[] }>;
}

type Tab = 'play' | 'board';

const TABS: { id: Tab; label: string; icon: typeof Gamepad2 }[] = [
  { id: 'play', label: 'Play', icon: Gamepad2 },
  { id: 'board', label: 'Board', icon: Map },
];

/** The phone view. In home mode (a PC is running BoardDisplay) players stay
 *  on the "Play" tab. Without a PC — travel mode — the "Board" tab gives the
 *  same full board right here, so the whole game still works on phones alone. */
export function Controller({ state, events, myPlayerId, onAction, fetchMatchLog }: ControllerRootProps) {
  const [tab, setTab] = useState<Tab>('play');
  const [negotiating, setNegotiating] = useState<TradeOffer | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  // Fired from the arrival *event*, not from the presence of a pending trade:
  // keying off state meant every remount — a reconnect, a refresh — re-popped
  // an offer that had simply not been answered yet. `events` only ever holds
  // batches received since this mount, so an offer announces itself once, when
  // it is actually sent, and afterwards lives in the Trades tab.
  const [announced, setAnnounced] = useState<TradeOffer | null>(null);
  const seenEventCount = useRef(events.length);

  useEffect(() => {
    if (events.length <= seenEventCount.current) {
      seenEventCount.current = events.length;
      return;
    }
    const fresh = events.slice(seenEventCount.current);
    seenEventCount.current = events.length;
    const mine = fresh.filter((e) => e.type === 'trade-proposed' && e.toId === myPlayerId);
    const latest = mine[mine.length - 1];
    if (latest && latest.type === 'trade-proposed') {
      const offer = state.pendingTrades.find((t) => t.id === latest.tradeId);
      if (offer) setAnnounced(offer);
    }
    // Pop the summary once, for whoever's device was open at the moment the
    // game actually ended — same "fresh events since mount" reasoning as the
    // trade announcement above, so a reconnect never re-triggers it.
    if (fresh.some((e) => e.type === 'game-over')) setStatsOpen(true);
  }, [events, state, myPlayerId]);

  // Drop it the moment it stops being live — accepted, declined or countered
  // by someone else while the sheet sat open.
  const incomingTrade = announced && state.pendingTrades.some((t) => t.id === announced.id) ? announced : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
        <PendingActionStrip state={state} />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false}>
            {tab === 'play' ? (
              <motion.div
                key="play"
                className="absolute inset-0 h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <PlayTab state={state} events={events} myPlayerId={myPlayerId} onAction={onAction} onOpenStats={() => setStatsOpen(true)} />
              </motion.div>
            ) : (
              <motion.div
                key="board"
                className="absolute inset-0 h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <BoardTab state={state} events={events} myPlayerId={myPlayerId} onAction={onAction} onOpenStats={() => setStatsOpen(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav
          className="grid shrink-0 grid-cols-2 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="relative flex flex-col items-center gap-0.5 py-2.5 active:opacity-70"
              >
                {active && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-emerald-400"
                    transition={{ type: 'spring', bounce: 0, visualDuration: 0.35 }}
                  />
                )}
                <Icon size={20} strokeWidth={active ? 2.4 : 2} className={active ? 'text-emerald-400' : 'text-slate-500'} />
                <span className={`text-[11px] font-medium ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sits clear of the tab bar, and above the board without covering
            the tiles a player is reading. Hidden while any sheet is open so it
            does not float over its own modal. */}
        {!rulesOpen && !statsOpen && !negotiating && !incomingTrade && (
          <motion.button
            onClick={() => setRulesOpen(true)}
            aria-label="Game rules"
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            className="fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/90 text-slate-200 shadow-lg shadow-black/40 ring-1 ring-white/15 backdrop-blur active:bg-slate-700"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
          >
            <BookOpen size={20} />
          </motion.button>
        )}

        {/* Stacked above the rules button, and only once there's a match to
            summarize — the auto-popup already showed it once, this is just
            how to get back to it after dismissing. */}
        {state.phase.type === 'game-over' && !rulesOpen && !statsOpen && !negotiating && !incomingTrade && (
          <motion.button
            onClick={() => setStatsOpen(true)}
            aria-label="Match stats"
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
            className="fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/90 text-white shadow-lg shadow-black/40 ring-1 ring-white/15 backdrop-blur active:bg-emerald-500"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 8.5rem)' }}
          >
            <Trophy size={20} />
          </motion.button>
        )}

        <AnimatePresence>
          {rulesOpen && <GameRulesModal state={state} onClose={() => setRulesOpen(false)} />}
        </AnimatePresence>

        <AnimatePresence>
          {statsOpen && (
            <MatchStatsModal state={state} myPlayerId={myPlayerId} fetchMatchLog={fetchMatchLog} onClose={() => setStatsOpen(false)} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {state.heldSquatCards.some((h) => h.playerId === myPlayerId && h.targetTileIndex === undefined) && (
            <SquatModal key="squat" state={state} myPlayerId={myPlayerId} onAction={onAction} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {negotiating ? (
            <TradeModal
              key="counter"
              state={state}
              myPlayerId={myPlayerId}
              onAction={onAction}
              counters={negotiating}
              onClose={() => setNegotiating(null)}
            />
          ) : (
            incomingTrade && (
              <IncomingTradeModal
                key={`incoming-${incomingTrade.id}`}
                state={state}
                trade={incomingTrade}
                myPlayerId={myPlayerId}
                onAction={onAction}
                onNegotiate={(t) => {
                  setAnnounced(null);
                  setNegotiating(t);
                }}
                onClose={() => setAnnounced(null)}
              />
            )
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function PlayTab({ state, events, myPlayerId, onAction, onOpenStats }: ControllerProps & { onOpenStats: () => void }) {
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const me = state.players[myPlayerId]!;
  const currentPlayer = state.players[state.turnOrder[state.currentPlayerIndex]!];
  const isMyTurn = currentPlayer?.id === myPlayerId;

  const myTiles = Object.entries(state.ownership)
    .filter(([, o]) => o.ownerId === myPlayerId)
    .map(([tileIndexStr]) => Number(tileIndexStr))
    .sort((a, b) => a - b);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="mb-3 shrink-0 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-slate-950 ring-2 ring-white/15"
              style={{ backgroundColor: me.color }}
            >
              {me.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-semibold tracking-tight">{me.name}</span>
              <RoundCounter state={state} className="self-start" />
            </div>
          </div>
          <div className="text-right">
            <CashValue cash={me.cash} baseColor="#34d399" className="text-lg font-semibold tabular-nums" />
            <p className="text-[11px] tabular-nums text-slate-500">worth ${netWorth(state, myPlayerId).toLocaleString('en-US')}</p>
          </div>
        </div>
        {state.config.healthMode && <HealthBar health={me.health} />}
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={state.phase.type === 'game-over' ? 'over' : isMyTurn ? 'mine' : currentPlayer?.id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18 }}
          className={`mb-3 flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm font-medium ${
            isMyTurn ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30' : 'bg-white/5 text-slate-400'
          }`}
        >
          {isMyTurn && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
          {state.phase.type === 'game-over' ? 'Game over' : isMyTurn ? "It's your turn" : `${currentPlayer?.name}'s turn`}
        </motion.p>
      </AnimatePresence>

      <div className="shrink-0 rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-lg shadow-black/20">
        <ActionPanel state={state} myPlayerId={myPlayerId} onAction={onAction} onOpenStats={onOpenStats} />
      </div>

      <div className="mt-3 shrink-0">
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">My properties</h2>
        {myTiles.length === 0 ? (
          <p className="text-sm text-slate-500">None yet</p>
        ) : (
          <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-slate-900 p-1.5 shadow-lg shadow-black/20">
            {myTiles.map((tileIndex) => {
              const tile = state.board.tiles[tileIndex];
              const label = tile && 'name' in tile ? tile.name : `Tile ${tileIndex}`;
              const ownership = state.ownership[tileIndex];
              const dot = tile?.kind === 'property' ? GROUP_COLORS[tile.group] : undefined;
              const flagSvg = tile?.kind === 'property' ? GROUP_FLAG_SVG[tile.group] : undefined;
              return (
                <motion.button
                  key={tileIndex}
                  onClick={() => setSelectedTile(tileIndex)}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 text-left text-xs text-slate-200 ring-1 ring-inset ring-white/10 active:bg-white/10"
                >
                  {flagSvg ? (
                    <span
                      className="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-white/25 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: flagSvg }}
                    />
                  ) : tile ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[11px] leading-none">
                      {tileIcon(tile)}
                    </span>
                  ) : (
                    dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
                  )}
                  <span className="flex-1 truncate font-medium">{label}</span>
                  {ownership?.mortgaged && (
                    <span className="shrink-0 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                      Mortgaged
                    </span>
                  )}
                  {ownership && ownership.houses > 0 && (
                    <span className="shrink-0 text-[11px]">{ownership.houses === 5 ? '🏨' : '🏠'.repeat(ownership.houses)}</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 shrink-0">
        <TradePanel state={state} myPlayerId={myPlayerId} onAction={onAction} />
      </div>

      <div className="mt-3 shrink-0">
        <AlliancePanel state={state} myPlayerId={myPlayerId} onAction={onAction} />
      </div>

      <div className="mt-3 min-h-[8rem] flex-1">
        <ActivityFeed events={events} state={state} />
      </div>

      <AnimatePresence>
        {selectedTile !== null && (
          <PropertyCard
            state={state}
            tileIndex={selectedTile}
            myPlayerId={myPlayerId}
            onAction={onAction}
            onClose={() => setSelectedTile(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

function BoardTab({ state, events, myPlayerId, onAction, onOpenStats }: ControllerProps & { onOpenStats: () => void }) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-center">
        <BoardGrid state={state} events={events} myPlayerId={myPlayerId} onAction={onAction}>
          <ActionPanel state={state} myPlayerId={myPlayerId} onAction={onAction} onOpenStats={onOpenStats} />
        </BoardGrid>
      </div>
      <PlayersPanel state={state} />
      <div className="h-40 shrink-0">
        <ActivityFeed events={events} state={state} />
      </div>
    </div>
  );
}
