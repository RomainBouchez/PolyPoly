import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { SQUAT_CARD_ID } from './deck.js';
import { getLegalActions } from './legalActions.js';
import { freshState, P1, P2, scriptedRng } from './testUtils.js';

// Board indices below track data/board.europe.ts:
//   1 Porto (portugal, 60)   2 travel card   3 Lisbon (portugal, 80)
//   4 Departure Tax          8 Poros (greece, 100)
// Lisbon's rent ladder is [2, 10, 30, 90, 160, 250]; Poros's base rent is 4.
const TRAVEL_CARD_TILE = 2;
const LISBON = 3;
const POROS = 8;

describe('grant-squat card', () => {
  it('grants an undecided held charge with a rolled building level and stays out of discard', () => {
    const state = freshState({ auction: false });
    state.decks.travel.drawPile.unshift({ id: 'test-squat', text: 'Test squat', effect: { type: 'grant-squat' } });

    // Dice [1, 1] -> land on the travel card tile at index 2; the 3rd rng call
    // picks the building level from [1, 2, 3, 5] — value 3 selects index 2 -> level 3.
    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 1, 3]));

    expect(next.heldSquatCards).toEqual([
      { cardId: 'test-squat', deck: 'travel', playerId: P1, buildingLevel: 3 },
    ]);
    expect(next.decks.travel.discardPile.find((c) => c.id === 'test-squat')).toBeUndefined();
    expect(events.some((e) => e.type === 'squat-granted' && e.buildingLevel === 3)).toBe(true);
  });
});

describe('use-squat-on / skip-squat', () => {
  function setupUndecidedCharge() {
    const state = freshState();
    // Real card id — held cards round-trip through findCardById() on skip,
    // which only knows about the actual deck data.
    state.heldSquatCards.push({ cardId: SQUAT_CARD_ID, deck: 'travel', playerId: P1, buildingLevel: 2 });
    state.ownership[LISBON] = { ownerId: P2, houses: 2, mortgaged: false };
    return state;
  }

  it('is offered as a legal action any time, not gated to whoever is mid-turn', () => {
    const state = setupUndecidedCharge();
    // It's P1's own turn (awaiting-roll) here, but the point is this doesn't
    // depend on phase at all — build-house/mortgage work the same way.
    const { events } = applyAction(state, { type: 'use-squat-on', playerId: P1, tileIndex: LISBON }, scriptedRng([]));
    expect(events.some((e) => e.type === 'squat-target-chosen' && e.targetId === P2 && e.tileIndex === LISBON)).toBe(true);
  });

  it('picking a target reserves the tile, marks the opponent squatted, and keeps the card held', () => {
    const { state: next } = applyAction(
      setupUndecidedCharge(),
      { type: 'use-squat-on', playerId: P1, tileIndex: LISBON },
      scriptedRng([]),
    );

    expect(next.heldSquatCards).toEqual([
      { cardId: SQUAT_CARD_ID, deck: 'travel', playerId: P1, buildingLevel: 2, targetTileIndex: LISBON },
    ]);
    expect(next.players[P1]!.squattedPlayerIds).toEqual([P2]);
  });

  it('landing on the reserved tile waives rent automatically, no further decision needed', () => {
    const targeted = applyAction(
      setupUndecidedCharge(),
      { type: 'use-squat-on', playerId: P1, tileIndex: LISBON },
      scriptedRng([]),
    ).state;

    // Dice [1, 2] -> Go + 3 lands exactly on the reserved Lisbon.
    const { state: next, events } = applyAction(targeted, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.cash).toBe(1500);
    expect(next.players[P2]!.cash).toBe(1500);
    expect(next.heldSquatCards).toEqual([]);
    expect(next.decks.travel.discardPile.find((c) => c.id === SQUAT_CARD_ID)).toBeDefined();
    expect(events.some((e) => e.type === 'squatted' && e.targetId === P2 && e.tileIndex === LISBON)).toBe(true);
    expect(events.some((e) => e.type === 'rent-paid')).toBe(false);
  });

  it('landing on a different, unreserved property still charges rent normally', () => {
    const state = setupUndecidedCharge();
    state.ownership[POROS] = { ownerId: P2, houses: 0, mortgaged: false }; // base rent 4
    const targeted = applyAction(state, { type: 'use-squat-on', playerId: P1, tileIndex: LISBON }, scriptedRng([])).state;

    // Dice [3, 5] -> lands on Poros, not the reserved Lisbon.
    const { state: next, events } = applyAction(targeted, { type: 'roll', playerId: P1 }, scriptedRng([3, 5]));

    expect(events.some((e) => e.type === 'rent-paid' && e.tileIndex === POROS)).toBe(true);
    expect(next.players[P1]!.cash).toBe(1500 - 4);
    expect(next.heldSquatCards).toHaveLength(1); // reservation on Lisbon untouched
  });

  it('skip-squat discards the pass and returns the card to discard', () => {
    const { state: next, events } = applyAction(setupUndecidedCharge(), { type: 'skip-squat', playerId: P1 }, scriptedRng([]));

    expect(next.heldSquatCards).toEqual([]);
    expect(next.decks.travel.discardPile.find((c) => c.id === SQUAT_CARD_ID)).toBeDefined();
    expect(events.some((e) => e.type === 'squat-skipped' && e.playerId === P1)).toBe(true);
  });

  it('can always be skipped when no opponent property matches the level', () => {
    // A level-2 pass with nothing at 2 houses on the board — the holder would
    // otherwise be stuck holding an undecided charge forever.
    const state = freshState();
    state.heldSquatCards.push({ cardId: SQUAT_CARD_ID, deck: 'travel', playerId: P1, buildingLevel: 2 });
    state.ownership[LISBON] = { ownerId: P2, houses: 0, mortgaged: false };

    const legal = getLegalActions(state, P1);
    expect(legal.some((a) => a.type === 'use-squat-on')).toBe(false);
    expect(legal.some((a) => a.type === 'skip-squat')).toBe(true);

    const { state: next, events } = applyAction(state, { type: 'skip-squat', playerId: P1 }, scriptedRng([]));
    expect(next.heldSquatCards).toEqual([]);
    expect(events.some((e) => e.type === 'squat-skipped' && e.playerId === P1)).toBe(true);
  });

  it('can still be skipped while sick, when targeting is blocked', () => {
    const state = setupUndecidedCharge();
    state.config.healthMode = true;
    state.players[P1]!.health = 15;

    const legal = getLegalActions(state, P1);
    expect(legal.some((a) => a.type === 'use-squat-on')).toBe(false);
    expect(legal.some((a) => a.type === 'skip-squat')).toBe(true);

    const { state: next } = applyAction(state, { type: 'skip-squat', playerId: P1 }, scriptedRng([]));
    expect(next.heldSquatCards).toEqual([]);
  });

  it('cannot target the same opponent twice, even with a second undecided charge', () => {
    const state = setupUndecidedCharge();
    state.players[P1]!.squattedPlayerIds.push(P2);

    expect(() => applyAction(state, { type: 'use-squat-on', playerId: P1, tileIndex: LISBON }, scriptedRng([]))).toThrow();
  });

  it('is blocked while sick (health 0-20) in health mode', () => {
    const state = setupUndecidedCharge();
    state.config.healthMode = true;
    state.players[P1]!.health = 15;

    expect(() => applyAction(state, { type: 'use-squat-on', playerId: P1, tileIndex: LISBON }, scriptedRng([]))).toThrow();
  });

  it('does nothing when squatCards is disabled in config', () => {
    const state = setupUndecidedCharge();
    state.config.squatCards = false;

    expect(() => applyAction(state, { type: 'use-squat-on', playerId: P1, tileIndex: LISBON }, scriptedRng([]))).toThrow();
  });
});
