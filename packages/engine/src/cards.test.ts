import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { freshState, P1, P2, scriptedRng } from './testUtils.js';

// Tile 25 is a travel-deck card tile, reached from tile 22 (Vacation) with a
// 1+2 roll (non-double) — no GO passed along the way, so cash assertions
// stay clean.

function startJustBeforeCard(state: ReturnType<typeof freshState>) {
  state.players[P1]!.position = 22;
}

describe('cards', () => {
  it('collect: adds cash and ends the turn', () => {
    const state = freshState({ auction: false });
    startJustBeforeCard(state);
    state.decks.travel.drawPile.unshift({ id: 'test-collect', text: 'Test collect', effect: { type: 'collect', amount: 77 } });

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.cash).toBe(1500 + 77);
    expect(events.some((e) => e.type === 'card-drawn' && e.cardId === 'test-collect')).toBe(true);
    expect(next.turnOrder[next.currentPlayerIndex]).toBe(P2);
  });

  it('pay: deducts cash to the bank', () => {
    const state = freshState({ auction: false });
    startJustBeforeCard(state);
    state.decks.travel.drawPile.unshift({ id: 'test-pay', text: 'Test pay', effect: { type: 'pay', amount: 60 } });

    const { state: next } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));
    expect(next.players[P1]!.cash).toBe(1500 - 60);
  });

  it('move-to: relocates the player and resolves the new tile (purchase pending, no GO salary moving forward)', () => {
    const state = freshState({ auction: false });
    startJustBeforeCard(state);
    state.decks.travel.drawPile.unshift({ id: 'test-move', text: 'Advance to Paris', effect: { type: 'move-to', tileIndex: 43 } });

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.position).toBe(43);
    expect(next.phase).toEqual({ type: 'awaiting-purchase', playerId: P1, tileIndex: 43 });
    expect(events.some((e) => e.type === 'collected-go')).toBe(false);
  });

  it('go-to-jail: sends the player to jail with reason "card"', () => {
    const state = freshState({ auction: false });
    startJustBeforeCard(state);
    state.decks.travel.drawPile.unshift({ id: 'test-jail', text: 'Overstayed', effect: { type: 'go-to-jail' } });

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.inJail).toBe(true);
    expect(events.some((e) => e.type === 'sent-to-jail' && e.reason === 'card')).toBe(true);
  });

  it('get-out-of-jail-free: is held, not discarded, and can be used later', () => {
    const state = freshState({ auction: false });
    startJustBeforeCard(state);
    // travel-10 is the real "Get Out of Jail Free" card in the travel deck data.
    state.decks.travel.drawPile.unshift({ id: 'travel-10', text: 'Get Out of Jail Free.', effect: { type: 'get-out-of-jail-free' } });

    const { state: afterDraw } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));
    expect(afterDraw.players[P1]!.getOutOfJailFreeCards).toBe(1);
    expect(afterDraw.decks.travel.discardPile.find((c) => c.id === 'travel-10')).toBeUndefined();

    const jailed = structuredClone(afterDraw);
    jailed.players[P1]!.inJail = true;
    jailed.phase = { type: 'awaiting-jail-decision', playerId: P1 };

    const { state: released } = applyAction(jailed, { type: 'use-jail-card', playerId: P1 }, scriptedRng([]));
    expect(released.players[P1]!.inJail).toBe(false);
    expect(released.players[P1]!.getOutOfJailFreeCards).toBe(0);
    expect(released.decks.travel.discardPile.find((c) => c.id === 'travel-10')).toBeDefined();
  });
});
