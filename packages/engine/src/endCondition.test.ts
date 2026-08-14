import { describe, expect, it } from 'vitest';
import { checkLastStanding, checkTimeLimit, checkTurnLimit, richestPlayer } from './endCondition.js';
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

describe('checkTurnLimit', () => {
  it('ends the game once the turn number exceeds the configured limit, richest player wins', () => {
    const state = freshState({ endCondition: { type: 'turn-limit', turns: 10 } });
    state.turnNumber = 11;
    state.players[P2]!.cash = 5000; // richest

    const ended = checkTurnLimit(state, []);
    expect(ended).toBe(true);
    expect(state.phase).toEqual({ type: 'game-over', winnerId: P2 });
  });

  it('does not end the game before the limit', () => {
    const state = freshState({ endCondition: { type: 'turn-limit', turns: 10 } });
    state.turnNumber = 5;
    expect(checkTurnLimit(state, [])).toBe(false);
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
