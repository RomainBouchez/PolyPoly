import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import type { GameAction, GameEvent, GameState, PlayerId } from '@polypoly/engine';
import type { ReactNode } from 'react';
import { BoardTile } from './BoardTile.js';
import { DiceRoll } from './DiceRoll.js';
import { EventToast } from './EventToast.js';
import { PlayerTokensLayer } from './PlayerTokensLayer.js';
import { PropertyCard } from './PropertyCard.js';
import { computeBoardLayout, weightedGridTemplateColumns, weightedGridTemplateRows } from './tileLayout.js';

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
  const gridTemplateColumns = weightedGridTemplateColumns(layout.gridSize);
  const gridTemplateRows = weightedGridTemplateRows(layout.gridSize);

  return (
    <div
      className="relative mx-auto grid aspect-square gap-[3px] rounded-xl bg-black p-[3px]"
      style={{
        // Sized to whichever is tighter — available height or available width —
        // so the whole board always fits without ever needing to scroll.
        width: 'min(100%, calc(100dvh - 1rem))',
        // Every track is the same size — all tiles (ring cells) end up
        // identical squares, and the center panel just spans whatever's
        // left in the middle (gridSize-2 tracks), growing/shrinking with
        // the screen instead of the tiles resizing.
        gridTemplateColumns,
        gridTemplateRows,
        // Establishes the containment the player-token layer's cqmin sizing
        // resolves against (each tile has its OWN nested container for its
        // own cqmin content, which takes precedence inside a tile — this
        // only feeds elements sized directly off the whole board).
        containerType: 'size',
      }}
    >
      {/* Rendered before the tiles so it paints *underneath* them. */}
      <div
        style={{
          gridRow: `2 / span ${layout.gridSize - 2}`,
          gridColumn: `2 / span ${layout.gridSize - 2}`,
          background: 'radial-gradient(ellipse at center, #131b2c 0%, #0b1019 100%)',
        }}
        className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[10px] border border-white/[0.08] p-4"
      >
        <DiceRoll events={events} />
        {children}
      </div>

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

      <PlayerTokensLayer state={state} layout={layout} />

      {/* A dedicated layer over the tiles (not the center panel below, which
          intentionally paints underneath them) so the toast is always
          visible — clipped to the exact same inner-square grid cell as the
          center panel, so it can never spill out onto/over the tile ring
          regardless of board size.
          `isolate` + `will-change-transform` force this onto its own
          composited layer. z-40 is already the correct CSS ordering, but on
          a low-power GPU it is a weak guarantee: when a sibling in the
          centre panel is actively animating, the compositor can paint it
          above this layer despite the lower z-index — a stacking-vs-
          compositing race that z-index alone cannot prevent. Promoting this
          layer explicitly removes the ambiguity.

          Why it shows on phones and not the shared PC screen: the board CSS
          is identical (both render this same BoardGrid, DiceRoll included).
          What differs is `children` — the phone puts ActionPanel in the
          centre panel, whose buttons carry whileTap-primed transforms, so
          there is a transform-animated sibling here that BoardDisplay's
          turn label and ActivityFeed never introduce. */}
      <div
        style={{
          gridRow: `2 / span ${layout.gridSize - 2}`,
          gridColumn: `2 / span ${layout.gridSize - 2}`,
        }}
        className="pointer-events-none relative isolate z-40 overflow-hidden rounded-[10px] will-change-transform"
      >
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
