import { AdminPage } from './components/AdminPage.js';
import { BoardDisplay } from './components/BoardDisplay.js';
import { Controller } from './components/Controller.js';
import { JoinScreen } from './components/JoinScreen.js';
import { Lobby } from './components/Lobby.js';
import { useRoom } from './hooks/useRoom.js';

export default function App() {
  // The shared PC screen opens /board — it watches the game but never joins
  // as a player, so it skips the whole join/lobby flow below.
  if (window.location.pathname === '/board') {
    return <BoardDisplay />;
  }
  // /admin is the same idea: watch-only plus reset/kick controls, no join.
  if (window.location.pathname === '/admin') {
    return <AdminPage />;
  }

  const { connected, joined, room, config, gameState, events, myPlayerId, error, joinAsNew, updateConfig, startGame, sendAction } =
    useRoom();

  if (!joined || !room || !config || !myPlayerId) {
    return <JoinScreen connected={connected} error={error} onJoin={joinAsNew} />;
  }

  if (room.phase === 'lobby') {
    return (
      <Lobby
        room={room}
        config={config}
        myPlayerId={myPlayerId}
        error={error}
        onUpdateConfig={updateConfig}
        onStart={startGame}
      />
    );
  }

  if (!gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Loading game…</p>
      </div>
    );
  }

  return (
    <>
      {/* The socket reconnects and rebinds the seat on its own, so this is a
          status line rather than a wall — the board stays usable and the strip
          disappears by itself. Without it a dropped connection just looked
          like the game had frozen. */}
      {!connected && (
        <div className="fixed inset-x-0 top-0 z-40 bg-amber-500/90 px-3 py-1 text-center text-[11px] font-medium text-slate-950">
          Reconnecting…
        </div>
      )}
      <Controller state={gameState} events={events} myPlayerId={myPlayerId} onAction={sendAction} />
    </>
  );
}
