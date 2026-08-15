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

  // `connected` only reflects this socket's own transport state. If the
  // socket silently auto-reconnects, `connected` flips back to true even
  // though the server never re-bound this seat (that only happens via a
  // fresh 'join', which a bare reconnect does not send) — so also check the
  // server's own belief about this seat, carried on every room:update.
  const seatConnected = room.players.find((p) => p.id === myPlayerId)?.connected ?? false;
  if (!connected || !seatConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <div>
          <p className="text-lg font-medium">Disconnected</p>
          <p className="mt-1 text-sm text-slate-400">Please refresh the page to reconnect.</p>
        </div>
      </div>
    );
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

  return <Controller state={gameState} events={events} myPlayerId={myPlayerId} onAction={sendAction} />;
}
