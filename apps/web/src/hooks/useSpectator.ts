import { useEffect, useState } from 'react';
import type { GameEvent, GameState } from '@polypoly/engine';
import { socket } from '../socket.js';

const MAX_EVENT_LOG = 200;

/** Watches the room's broadcasts without ever joining as a player — the PC's
 *  shared board display just needs to render state, not act on it. */
export function useSpectator(): { gameState: GameState | null; events: GameEvent[] } {
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

  return { gameState, events };
}
