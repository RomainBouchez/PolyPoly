import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { IllegalActionError } from './errors.js';
import { computeRent } from './rules.js';
import { P1, P2, P3, freshState, scriptedRng } from './testUtils.js';
import type { GameState } from './types.js';

// Tile 3 = Lisbon (property, price 80). Tile 11 = Jail/Just Visiting.

/** One player's turn that ends cleanly: 5+6 is not a double and lands on Jail
 *  (just visiting) from anywhere the tests start, so nothing is left pending. */
function takeCleanTurn(state: GameState): GameState {
  const actor = state.turnOrder[state.currentPlayerIndex]!;
  return applyAction(state, { type: 'roll', playerId: actor }, scriptedRng([5, 6])).state;
}

describe('alliance', () => {
  it('halves rent between allied players', () => {
    const state = freshState({ allianceMode: true });
    state.ownership[3] = { ownerId: P2, houses: 0, mortgaged: false };
    state.alliances = [{ players: [P1, P2], roundsRemaining: 3 }];
    const baseRent = computeRent(state, 3, 4);

    const { events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));
    const rentEvent = events.find((e) => e.type === 'rent-paid');
    expect(rentEvent).toMatchObject({ amount: Math.round(baseRent * 0.5) });
  });

  it('counts full rounds, not individual turns', () => {
    let state = freshState({ allianceMode: true });
    state.alliances = [{ players: [P1, P2], roundsRemaining: 1 }];

    // Ticking per finished turn would have ended this on the very first roll.
    // It has to survive until every player has played once.
    for (let i = 0; i < state.turnOrder.length - 1; i++) {
      state = takeCleanTurn(state);
      expect(state.alliances).toHaveLength(1);
    }

    const actor = state.turnOrder[state.currentPlayerIndex]!;
    const { state: after, events } = applyAction(state, { type: 'roll', playerId: actor }, scriptedRng([5, 6]));
    expect(after.alliances).toHaveLength(0);
    expect(events.some((e) => e.type === 'alliance-ended')).toBe(true);
  });

  it('form-alliance card fizzles instead of crashing when everyone is already allied', () => {
    const state = freshState({ allianceMode: true });
    state.alliances = [{ players: [P1, P2], roundsRemaining: 3 }];
    state.decks.travel.drawPile.unshift({ id: 'travel-17', text: 'Alliance', effect: { type: 'form-alliance' } });
    state.players[P3]!.position = 23; // 23 + 1 + 1 = 25, a travel card tile
    state.currentPlayerIndex = state.turnOrder.indexOf(P3);
    state.phase = { type: 'awaiting-roll', playerId: P3 };
    const { state: after, events } = applyAction(state, { type: 'roll', playerId: P3 }, scriptedRng([1, 1]));
    // P3 wasn't already allied, but if the only other active players (P1,P2)
    // are already paired off, the card fizzles instead of crashing.
    expect(events.some((e) => e.type === 'card-drawn')).toBe(true);
    expect(after.alliances).toHaveLength(1); // unchanged
  });
});

describe('health transfer', () => {
  it('moves health between allies within bounds', () => {
    const state = freshState({ healthMode: true, allianceMode: true });
    state.alliances = [{ players: [P1, P2], roundsRemaining: 3 }];
    state.players[P1]!.health = 50;
    state.players[P2]!.health = 50;

    const { state: after } = applyAction(state, { type: 'transfer-health', playerId: P1, toId: P2, amount: 10 }, scriptedRng([]));
    expect(after.players[P1]!.health).toBe(40);
    expect(after.players[P2]!.health).toBe(60);
  });

  it('rejects transfers between non-allies', () => {
    const state = freshState({ healthMode: true, allianceMode: true });
    expect(() =>
      applyAction(state, { type: 'transfer-health', playerId: P1, toId: P2, amount: 10 }, scriptedRng([])),
    ).toThrow(IllegalActionError);
  });

  it('rejects a transfer that would exceed the health cap', () => {
    const state = freshState({ healthMode: true, allianceMode: true });
    state.alliances = [{ players: [P1, P2], roundsRemaining: 3 }];
    state.players[P1]!.health = 100;
    state.players[P2]!.health = 95;
    expect(() =>
      applyAction(state, { type: 'transfer-health', playerId: P1, toId: P2, amount: 10 }, scriptedRng([])),
    ).toThrow(IllegalActionError);
  });

  it('rejects when healthMode is off even if allianceMode is on', () => {
    const state = freshState({ healthMode: false, allianceMode: true });
    state.alliances = [{ players: [P1, P2], roundsRemaining: 3 }];
    expect(() =>
      applyAction(state, { type: 'transfer-health', playerId: P1, toId: P2, amount: 5 }, scriptedRng([])),
    ).toThrow(IllegalActionError);
  });
});

describe('rainy day', () => {
  it('schedules a trigger turn and doubles rent for its duration', () => {
    const state = freshState({ rainyDay: true });
    expect(state.rainyDay.triggerRound).not.toBeNull();
    expect(state.rainyDay.durationRounds).toBeGreaterThanOrEqual(1);

    // Force it active right now and confirm computeRent doubles.
    state.ownership[3] = { ownerId: P2, houses: 0, mortgaged: false };
    const normalRent = computeRent(state, 3, 4);
    state.rainyDay.roundsRemaining = 1;
    expect(computeRent(state, 3, 4)).toBe(normalRent * 2);
  });

  it('fires the started/ended events across the scheduled rounds', () => {
    let state = freshState({ rainyDay: true });
    state.rainyDay = { triggerRound: 2, durationRounds: 1, roundsRemaining: 0, triggered: false };

    // Nothing happens part-way through the opening round.
    for (let i = 0; i < state.turnOrder.length - 1; i++) {
      state = takeCleanTurn(state);
      expect(state.rainyDay.triggered).toBe(false);
    }

    // Completing the round crosses into round 2 and starts the rain.
    let actor = state.turnOrder[state.currentPlayerIndex]!;
    let result = applyAction(state, { type: 'roll', playerId: actor }, scriptedRng([5, 6]));
    expect(result.events.some((e) => e.type === 'rainy-day-started')).toBe(true);
    expect(result.state.rainyDay.roundsRemaining).toBe(1);

    // It lasts a whole round, not one player's turn.
    state = result.state;
    for (let i = 0; i < state.turnOrder.length - 1; i++) {
      state = takeCleanTurn(state);
      expect(state.rainyDay.roundsRemaining).toBe(1);
    }
    actor = state.turnOrder[state.currentPlayerIndex]!;
    result = applyAction(state, { type: 'roll', playerId: actor }, scriptedRng([5, 6]));
    expect(result.events.some((e) => e.type === 'rainy-day-ended')).toBe(true);
    expect(result.state.rainyDay.roundsRemaining).toBe(0);
  });
});

describe('hostage', () => {
  function jailedState() {
    const state = freshState({ hostageMode: true });
    state.ownership[3] = { ownerId: P2, houses: 0, mortgaged: false };
    state.players[P1]!.inJail = true;
    state.phase = { type: 'awaiting-jail-decision', playerId: P1 };
    return state;
  }

  it('voids rent on the hostage tile while the kidnapper stays in jail', () => {
    const state = jailedState();
    const { state: after, events } = applyAction(
      state,
      { type: 'take-hostage', playerId: P1, tileIndex: 3 },
      scriptedRng([]),
    );
    expect(after.hostage).toEqual({ tileIndex: 3, kidnapperId: P1, ownerId: P2 });
    expect(events.some((e) => e.type === 'hostage-taken')).toBe(true);
    expect(computeRent(after, 3, 4)).toBe(0);
  });

  it('rejects taking a second hostage while one is already held', () => {
    const state = jailedState();
    const { state: after } = applyAction(state, { type: 'take-hostage', playerId: P1, tileIndex: 3 }, scriptedRng([]));
    state.ownership[12] = { ownerId: P3, houses: 0, mortgaged: false };
    expect(() =>
      applyAction(after, { type: 'take-hostage', playerId: P1, tileIndex: 12 }, scriptedRng([])),
    ).toThrow(IllegalActionError);
  });

  it('releases the hostage when the kidnapper pays their way out of jail', () => {
    const state = jailedState();
    const { state: withHostage } = applyAction(state, { type: 'take-hostage', playerId: P1, tileIndex: 3 }, scriptedRng([]));
    const { state: after, events } = applyAction(withHostage, { type: 'pay-jail-fine', playerId: P1 }, scriptedRng([]));
    expect(after.hostage).toBeNull();
    expect(events.some((e) => e.type === 'hostage-released')).toBe(true);
    expect(computeRent(after, 3, 4)).toBeGreaterThan(0);
  });

  it('rejects taking your own property hostage', () => {
    const state = jailedState();
    state.ownership[3] = { ownerId: P1, houses: 0, mortgaged: false };
    expect(() => applyAction(state, { type: 'take-hostage', playerId: P1, tileIndex: 3 }, scriptedRng([]))).toThrow(
      IllegalActionError,
    );
  });
});
