import { netWorth } from './rules.js';
import type { GameEvent, GameState, PlayerId } from './types.js';

export function activePlayerIds(state: GameState): PlayerId[] {
  return state.turnOrder.filter((id) => state.players[id]?.status === 'active');
}

export function richestPlayer(state: GameState): PlayerId {
  const ids = activePlayerIds(state);
  return ids.reduce((best, id) => (netWorth(state, id) > netWorth(state, best) ? id : best), ids[0]!);
}

/** The active player currently worth the least — who the wealth-tax tile
 *  pays. Ties (e.g. a fresh game, everyone still equal) keep whichever of
 *  the tied players comes first in turn order, mirroring richestPlayer's
 *  tie-break for the opposite comparison (`<`/`>` rather than `<=`/`>=`, so
 *  the first candidate found only ever loses ties, never keeps them by
 *  chance). Always returns someone — the caller (landing on the tile) is
 *  itself an active player, so the pool is never empty. */
export function poorestPlayer(state: GameState): PlayerId {
  const ids = activePlayerIds(state);
  return ids.reduce((worst, id) => (netWorth(state, id) < netWorth(state, worst) ? id : worst), ids[0]!);
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

export function checkRoundLimit(draft: GameState, events: GameEvent[]): boolean {
  const condition = draft.config.endCondition;
  if (condition.type === 'round-limit' && draft.roundNumber > condition.rounds) {
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
