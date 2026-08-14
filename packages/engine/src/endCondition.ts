import { netWorth } from './rules.js';
import type { GameEvent, GameState, PlayerId } from './types.js';

export function activePlayerIds(state: GameState): PlayerId[] {
  return state.turnOrder.filter((id) => state.players[id]?.status === 'active');
}

export function richestPlayer(state: GameState): PlayerId {
  const ids = activePlayerIds(state);
  return ids.reduce((best, id) => (netWorth(state, id) > netWorth(state, best) ? id : best), ids[0]!);
}

function endGame(draft: GameState, winnerId: PlayerId, events: GameEvent[]): void {
  draft.phase = { type: 'game-over', winnerId };
  events.push({ type: 'game-over', winnerId });
}

/** Ends the game if only one active player remains. Applies regardless of
 *  the configured end condition — a game cannot continue with one player. */
export function checkLastStanding(draft: GameState, events: GameEvent[]): boolean {
  const active = activePlayerIds(draft);
  if (active.length <= 1) {
    endGame(draft, active[0] ?? draft.turnOrder[0]!, events);
    return true;
  }
  return false;
}

export function checkTurnLimit(draft: GameState, events: GameEvent[]): boolean {
  const condition = draft.config.endCondition;
  if (condition.type === 'turn-limit' && draft.turnNumber > condition.turns) {
    endGame(draft, richestPlayer(draft), events);
    return true;
  }
  return false;
}

export function checkTimeLimit(draft: GameState, elapsedMinutes: number, events: GameEvent[]): boolean {
  const condition = draft.config.endCondition;
  if (condition.type === 'time-limit' && elapsedMinutes >= condition.minutes) {
    endGame(draft, richestPlayer(draft), events);
    return true;
  }
  return false;
}
