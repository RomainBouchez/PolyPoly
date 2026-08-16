import { describe, expect, it } from 'vitest';
import { checkLastStanding, checkTimeLimit, checkRoundLimit, richestPlayer } from './endCondition.js';
import { applyAction } from './applyAction.js';
import { createRng } from './rng.js';
import { DEFAULT_PLAYERS, freshState, P1, P2, P3 } from './testUtils.js';

describe('checkLastStanding', () => {
  it('ends the game once only one active player remains', () => {
    const state = freshState();
    state.players[P2]!.status = 'bankrupt';
    state.players[P3]!.status = 'bankrupt';

    const ended = checkLastStanding(state, []);
    expect(ended).toBe(true);
    expect(state.phase).toEqual({ type: 'game-over', winnerId: P1 });
  });

  it('does not end the game with two or more active players', () => {
    const state = freshState();
    state.players[P3]!.status = 'bankrupt';
    expect(checkLastStanding(state, [])).toBe(false);
  });
});

describe('checkRoundLimit', () => {
  it('ends the game once the round number exceeds the configured limit, richest player wins', () => {
    const state = freshState({ endCondition: { type: 'round-limit', rounds: 10 } });
    state.roundNumber = 11;
    state.players[P2]!.cash = 5000; // richest

    const ended = checkRoundLimit(state, []);
    expect(ended).toBe(true);
    expect(state.phase).toEqual({ type: 'game-over', winnerId: P2 });
  });

  it('does not end the game before the limit', () => {
    const state = freshState({ endCondition: { type: 'round-limit', rounds: 10 } });
    state.roundNumber = 5;
    expect(checkRoundLimit(state, [])).toBe(false);
  });
});

describe('checkTimeLimit', () => {
  it('ends the game once elapsed minutes reach the configured limit', () => {
    const state = freshState({ endCondition: { type: 'time-limit', minutes: 60 } });
    state.players[P3]!.cash = 9000; // richest

    const ended = checkTimeLimit(state, 61, []);
    expect(ended).toBe(true);
    expect(state.phase).toEqual({ type: 'game-over', winnerId: P3 });
  });

  it('does not end the game before the time limit', () => {
    const state = freshState({ endCondition: { type: 'time-limit', minutes: 60 } });
    expect(checkTimeLimit(state, 10, [])).toBe(false);
  });
});

describe('richestPlayer', () => {
  it('accounts for property value alongside cash', () => {
    const state = freshState({}, DEFAULT_PLAYERS.slice(0, 2));
    state.players[P1]!.cash = 100;
    state.players[P2]!.cash = 100;
    state.ownership[1] = { ownerId: P2, houses: 0, mortgaged: false }; // Sintra, price 60
    expect(richestPlayer(state)).toBe(P2);
  });
});

describe('rounds vs turns', () => {
  // The old limit counted individual turns, so "10" ended a five-player game
  // after two trips around the table. A round is one full trip: it may take
  // more than one turn per player, since doubles let a player roll again.
  it('advances a round only once every player has played', () => {
    let state = freshState({ auction: false, endCondition: { type: 'round-limit', rounds: 5 } });
    const seen = new Set<string>();
    expect(state.roundNumber).toBe(1);

    for (let guard = 0; guard < 200 && state.roundNumber === 1; guard++) {
      const actor = state.turnOrder[state.currentPlayerIndex]!;
      seen.add(actor);
      const phase = state.phase.type;
      const action =
        phase === 'awaiting-purchase'
          ? ({ type: 'decline-purchase', playerId: actor } as const)
          : phase === 'awaiting-jail-decision'
            ? ({ type: 'roll-for-jail', playerId: actor } as const)
            : ({ type: 'roll', playerId: actor } as const);
      state = applyAction(state, action, createRng(guard + 1)).state;
      if (state.phase.type === 'game-over') break;
    }

    expect(state.roundNumber).toBe(2);
    // Every player got a turn before the round ticked over.
    expect(seen.size).toBe(state.turnOrder.length);
  });
});
