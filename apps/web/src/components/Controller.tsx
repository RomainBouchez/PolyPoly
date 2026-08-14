import { useState } from 'react';
import type { GameAction, GameEvent, GameState, PlayerId } from '@polypoly/engine';
import { BoardGrid } from './board/BoardGrid.js';
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

/** The phone view. In home mode (a PC is running BoardDisplay) players stay
 *  on the "Play" tab. Without a PC — travel mode — the "Board" tab gives the
 *  same full board right here, so the whole game still works on phones alone. */
export function Controller({ state, events, myPlayerId, onAction }: ControllerProps) {
  const [tab, setTab] = useState<Tab>('play');

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'play' ? (
          <PlayTab state={state} events={events} myPlayerId={myPlayerId} onAction={onAction} />
        ) : (
          <BoardTab state={state} events={events} myPlayerId={myPlayerId} onAction={onAction} />
        )}
      </div>

      <div className="grid shrink-0 grid-cols-2 border-t border-slate-800">
        <button
          onClick={() => setTab('play')}
          className={`py-2.5 text-sm font-medium ${tab === 'play' ? 'bg-slate-900 text-emerald-400' : 'text-slate-500'}`}
        >
          🎮 Play
        </button>
        <button
          onClick={() => setTab('board')}
          className={`py-2.5 text-sm font-medium ${tab === 'board' ? 'bg-slate-900 text-emerald-400' : 'text-slate-500'}`}
        >
          🗺️ Board
        </button>
      </div>
    </div>
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
      <div className="mb-3 shrink-0 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: me.color }} />
            <span className="font-medium">{me.name}</span>
          </div>
          <span className="tabular-nums text-slate-300">${me.cash}</span>
        </div>
        {state.config.healthMode && <HealthBar health={me.health} />}
      </div>

      <p className={`mb-3 shrink-0 text-center text-sm ${isMyTurn ? 'font-semibold text-emerald-400' : 'text-slate-500'}`}>
        {state.phase.type === 'game-over' ? 'Game over' : isMyTurn ? "It's your turn" : `${currentPlayer?.name}'s turn`}
      </p>

      <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-3">
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
              return (
                <button
                  key={tileIndex}
                  onClick={() => setSelectedTile(tileIndex)}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
                >
                  {label}
                </button>
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

      {selectedTile !== null && (
        <PropertyCard
          state={state}
          tileIndex={selectedTile}
          myPlayerId={myPlayerId}
          onAction={onAction}
          onClose={() => setSelectedTile(null)}
        />
      )}
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
