import { useCallback, useEffect, useState } from 'react';
import type { GameEvent, GameState, LoggedEvent } from '@polypoly/engine';
import type { NetWorthSnapshot } from '@polypoly/shared';
import { socket } from '../socket.js';

const MAX_EVENT_LOG = 200;

interface SpectatorHandle {
  gameState: GameState | null;
  events: GameEvent[];
  fetchMatchLog: () => Promise<{ log: LoggedEvent[]; logComplete: boolean; netWorthHistory: NetWorthSnapshot[] }>;
}

/** Watches the room's broadcasts without ever joining as a player — the PC's
 *  shared board display just needs to render state, not act on it. */
export function useSpectator(): SpectatorHandle {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);

  useEffect(() => {
    function onGameState(state: unknown, newEvents: unknown) {
      setGameState(state as GameState);
      const batch = newEvents as GameEvent[];
      if (batch.length > 0) setEvents((prev) => [...prev, ...batch].slice(-MAX_EVENT_LOG));
    }
    socket.on('game:state', onGameState);
    return () => {
      socket.off('game:state', onGameState);
    };
  }, []);

  // Full match history is fetched on demand (opening the stats screen), not
  // carried on every 'game:state' broadcast — that fires on every single
  // action, and shipping a growing multi-hundred-event array with it would
  // bloat routine play traffic for no benefit.
  const fetchMatchLog = useCallback(() => {
    return new Promise<{ log: LoggedEvent[]; logComplete: boolean; netWorthHistory: NetWorthSnapshot[] }>((resolve, reject) => {
      socket.emit('game:match-log', (result) => {
        if (!result.ok) {
          reject(new Error(result.reason));
          return;
        }
        resolve({ log: result.log as LoggedEvent[], logComplete: result.logComplete, netWorthHistory: result.netWorthHistory });
      });
    });
  }, []);

  return { gameState, events, fetchMatchLog };
}
