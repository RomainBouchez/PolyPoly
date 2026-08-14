import { useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Gamepad2, Map } from 'lucide-react';
import type { GameAction, GameEvent, GameState, PlayerId } from '@polypoly/engine';
import { BoardGrid } from './board/BoardGrid.js';
import { GROUP_COLORS } from './board/tileLayout.js';
import { PropertyCard } from './board/PropertyCard.js';
import { ActionPanel } from './game/ActionPanel.js';
import { ActivityFeed } from './game/ActivityFeed.js';
import { HealthBar, PlayersPanel } from './game/PlayersPanel.js';
import { TradePanel } from './game/TradePanel.js';

interface ControllerProps {
  state: GameState;
  events: GameEvent[];
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
}

type Tab = 'play' | 'board';

const TABS: { id: Tab; label: string; icon: typeof Gamepad2 }[] = [
  { id: 'play', label: 'Play', icon: Gamepad2 },
  { id: 'board', label: 'Board', icon: Map },
];

/** The phone view. In home mode (a PC is running BoardDisplay) players stay
 *  on the "Play" tab. Without a PC — travel mode — the "Board" tab gives the
 *  same full board right here, so the whole game still works on phones alone. */
export function Controller({ state, events, myPlayerId, onAction }: ControllerProps) {
  const [tab, setTab] = useState<Tab>('play');

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
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
                <PlayTab state={state} events={events} myPlayerId={myPlayerId} onAction={onAction} />
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
                <BoardTab state={state} events={events} myPlayerId={myPlayerId} onAction={onAction} />
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
      </div>
    </MotionConfig>
  );
}

function PlayTab({ state, events, myPlayerId, onAction }: ControllerProps) {
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
            <span className="font-semibold tracking-tight">{me.name}</span>
          </div>
          <span className="text-lg font-semibold tabular-nums text-emerald-400">${me.cash}</span>
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
        <ActionPanel state={state} myPlayerId={myPlayerId} onAction={onAction} />
      </div>

      <div className="mt-3 shrink-0">
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">My properties</h2>
        {myTiles.length === 0 ? (
          <p className="text-sm text-slate-500">None yet</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {myTiles.map((tileIndex) => {
              const tile = state.board.tiles[tileIndex];
              const label = tile && 'name' in tile ? tile.name : `Tile ${tileIndex}`;
              const dot = tile?.kind === 'property' ? GROUP_COLORS[tile.group] : undefined;
              return (
                <motion.button
                  key={tileIndex}
                  onClick={() => setSelectedTile(tileIndex)}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', bounce: 0, visualDuration: 0.2 }}
                  className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-200 ring-1 ring-inset ring-white/10 active:bg-white/10"
                >
                  {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
                  {label}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 shrink-0">
        <TradePanel state={state} myPlayerId={myPlayerId} onAction={onAction} />
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

function BoardTab({ state, events, myPlayerId, onAction }: ControllerProps) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-center">
        <BoardGrid state={state} myPlayerId={myPlayerId} onAction={onAction}>
          <ActionPanel state={state} myPlayerId={myPlayerId} onAction={onAction} />
        </BoardGrid>
      </div>
      <PlayersPanel state={state} />
      <div className="h-40 shrink-0">
        <ActivityFeed events={events} state={state} />
      </div>
    </div>
  );
}
