import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import type { GameAction, GameEvent, GameState, PlayerId } from '@polypoly/engine';
import type { ReactNode } from 'react';
import { BoardTile } from './BoardTile.js';
import { EventToast } from './EventToast.js';
import { PropertyCard } from './PropertyCard.js';
import { computeBoardLayout } from './tileLayout.js';

interface BoardGridProps {
  state: GameState;
  events: GameEvent[];
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => Promise<{ ok: boolean; reason?: string }>;
  children?: ReactNode;
}

export function BoardGrid({ state, events, myPlayerId, onAction, children }: BoardGridProps) {
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  // The board's shape never changes mid-game, so keying on tile count is enough.
  const layout = useMemo(() => computeBoardLayout(state.board), [state.board.tiles.length]);

  return (
    <div
      className="mx-auto grid aspect-square gap-1"
      style={{
        // Sized to whichever is tighter — available height or available width —
        // so the whole board always fits without ever needing to scroll.
        width: 'min(100%, calc(100dvh - 2rem))',
        gridTemplateColumns: `repeat(${layout.gridSize}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${layout.gridSize}, minmax(0, 1fr))`,
      }}
    >
      {state.board.tiles.map((tile) => (
        <BoardTile
          key={tile.index}
          tile={tile}
          state={state}
          position={layout.positions[tile.index]!}
          side={layout.sides[tile.index]}
          onSelect={setSelectedTile}
        />
      ))}
      <div
        style={{ gridRow: `2 / span ${layout.gridSize - 2}`, gridColumn: `2 / span ${layout.gridSize - 2}` }}
        className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-lg bg-slate-900/60 p-4"
      >
        {children}
        <EventToast events={events} state={state} layout={layout} />
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
