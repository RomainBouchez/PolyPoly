import { BoardGrid } from './board/BoardGrid.js';
import { ActivityFeed } from './game/ActivityFeed.js';
import { PlayersPanel } from './game/PlayersPanel.js';
import { useSpectator } from '../hooks/useSpectator.js';

const NOOP_ACTION = async () => ({ ok: false, reason: 'This is the shared display — play from your phone' });

/** The shared PC screen in home mode: shows the board only, no controls.
 *  Doesn't join as a player — it just watches the room's broadcasts. */
export function BoardDisplay() {
  const { gameState, events } = useSpectator();

  if (!gameState) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Waiting for the game to start…</p>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.turnOrder[gameState.currentPlayerIndex]!];

  return (
    <div className="h-dvh overflow-hidden bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex h-full max-w-7xl gap-4">
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <BoardGrid state={gameState} events={events} myPlayerId="" onAction={NOOP_ACTION}>
            {gameState.phase.type !== 'game-over' && currentPlayer && (
              <p className="text-lg font-semibold" style={{ color: currentPlayer.color }}>
                {currentPlayer.name}'s turn
              </p>
            )}
            <div className="min-h-0 w-full flex-1 overflow-hidden">
              <ActivityFeed events={events} state={gameState} />
            </div>
          </BoardGrid>
        </div>

        <div className="w-80 shrink-0 overflow-y-auto">
          <PlayersPanel state={gameState} />
        </div>
      </div>
    </div>
  );
}
