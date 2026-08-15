import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { IllegalActionError } from './errors.js';
import { computeRent } from './rules.js';
import { P1, P2, P3, freshState, scriptedRng } from './testUtils.js';

// Tile 3 = Lisbon (property, price 80). Tile 11 = Jail/Just Visiting.

describe('alliance', () => {
  it('halves rent between allied players', () => {
    const state = freshState({ allianceMode: true });
    state.ownership[3] = { ownerId: P2, houses: 0, mortgaged: false };
    state.alliances = [{ players: [P1, P2], turnsRemaining: 3 }];
    const baseRent = computeRent(state, 3, 4);

    const { events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));
    const rentEvent = events.find((e) => e.type === 'rent-paid');
    expect(rentEvent).toMatchObject({ amount: Math.round(baseRent * 0.5) });
  });

  it('expires after 3 finished turns', () => {
    let state = freshState({ allianceMode: true });
    state.alliances = [{ players: [P1, P2], turnsRemaining: 1 }];
    // Sum 11 (5+6, non-double) lands P1 on Jail (just visiting) — no pending
    // phase, so the move cleanly finishes the turn.
    const { state: after, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([5, 6]));
    expect(after.alliances).toHaveLength(0);
    expect(events.some((e) => e.type === 'alliance-ended')).toBe(true);
  });

  it('form-alliance card fizzles instead of crashing when everyone is already allied', () => {
    const state = freshState({ allianceMode: true });
    state.alliances = [{ players: [P1, P2], turnsRemaining: 3 }];
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
    state.alliances = [{ players: [P1, P2], turnsRemaining: 3 }];
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
    state.alliances = [{ players: [P1, P2], turnsRemaining: 3 }];
    state.players[P1]!.health = 100;
    state.players[P2]!.health = 95;
    expect(() =>
      applyAction(state, { type: 'transfer-health', playerId: P1, toId: P2, amount: 10 }, scriptedRng([])),
    ).toThrow(IllegalActionError);
  });

  it('rejects when healthMode is off even if allianceMode is on', () => {
    const state = freshState({ healthMode: false, allianceMode: true });
    state.alliances = [{ players: [P1, P2], turnsRemaining: 3 }];
    expect(() =>
      applyAction(state, { type: 'transfer-health', playerId: P1, toId: P2, amount: 5 }, scriptedRng([])),
    ).toThrow(IllegalActionError);
  });
});

describe('rainy day', () => {
  it('schedules a trigger turn and doubles rent for its duration', () => {
    const state = freshState({ rainyDay: true });
    expect(state.rainyDay.triggerTurn).not.toBeNull();
    expect(state.rainyDay.durationTurns).toBeGreaterThanOrEqual(1);

    // Force it active right now and confirm computeRent doubles.
    state.ownership[3] = { ownerId: P2, houses: 0, mortgaged: false };
    const normalRent = computeRent(state, 3, 4);
    state.rainyDay.turnsRemaining = 1;
    expect(computeRent(state, 3, 4)).toBe(normalRent * 2);
  });

  it('fires the started/ended events across the scheduled turns', () => {
    let state = freshState({ rainyDay: true });
    state.rainyDay = { triggerTurn: 2, durationTurns: 1, turnsRemaining: 0, triggered: false };

    // Turn 1 -> 2: crosses the trigger turn (sum 11 = jail visit, clean end of turn).
    let result = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([5, 6]));
    expect(result.events.some((e) => e.type === 'rainy-day-started')).toBe(true);
    expect(result.state.rainyDay.turnsRemaining).toBe(1);

    // Next finished turn ticks it down to 0 and ends it.
    result = applyAction(result.state, { type: 'roll', playerId: P2 }, scriptedRng([5, 6]));
    expect(result.events.some((e) => e.type === 'rainy-day-ended')).toBe(true);
    expect(result.state.rainyDay.turnsRemaining).toBe(0);
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
