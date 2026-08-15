import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { IllegalActionError } from './errors.js';
import { DEFAULT_PLAYERS, freshState, P1, P2, scriptedRng } from './testUtils.js';

describe('roll — movement', () => {
  it('moves the player by the dice sum and ends the turn on a non-double', () => {
    const state = freshState();
    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.position).toBe(3); // 1+2
    expect(next.phase).toEqual({ type: 'awaiting-purchase', playerId: P1, tileIndex: 3 }); // Lisbon
    expect(events.some((e) => e.type === 'moved')).toBe(true);
    expect(events.some((e) => e.type === 'turn-ended')).toBe(false); // purchase pending, turn not over yet
  });

  it('pays 200 salary when passing Go', () => {
    const state = freshState();
    state.players[P1]!.position = 41;
    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([2, 2]));
    // 41 + 4 = 45 % 44 = 1, wrapped past Go. Note: [2,2] is a double, handled in its own test below.
    expect(next.players[P1]!.position).toBe(1);
    expect(next.players[P1]!.cash).toBe(1500 + 200);
    expect(events.some((e) => e.type === 'collected-go')).toBe(true);
  });

  it('rejects a roll from a player who is not the active player', () => {
    const state = freshState();
    expect(() => applyAction(state, { type: 'roll', playerId: P2 }, scriptedRng([1, 2]))).toThrow(
      IllegalActionError,
    );
  });
});

describe('roll — doubles', () => {
  it('grants a reroll to the same player after a double', () => {
    const state = freshState({ auction: false }); // auction flow is covered separately below
    // 3+3 lands on tile 6 (Central Hospital, unowned) -> purchase pending overrides the reroll phase either way,
    // so decline first, then check the phase falls back to awaiting-roll for the same player.
    const { state: afterRoll } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([3, 3]));
    expect(afterRoll.phase).toEqual({ type: 'awaiting-purchase', playerId: P1, tileIndex: 6 });

    const { state: afterDecline } = applyAction(afterRoll, { type: 'decline-purchase', playerId: P1 }, scriptedRng([]));
    expect(afterDecline.phase).toEqual({ type: 'awaiting-roll', playerId: P1 });
    expect(afterDecline.currentPlayerIndex).toBe(0); // still P1's turn
  });

  it('sends the player to jail after three consecutive doubles', () => {
    let state = freshState({ auction: false });
    state = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([3, 3])).state; // double 1, lands on tile 6
    state = applyAction(state, { type: 'decline-purchase', playerId: P1 }, scriptedRng([])).state;
    state = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 1])).state; // double 2, tile 8
    state = applyAction(state, { type: 'decline-purchase', playerId: P1 }, scriptedRng([])).state;

    const { state: afterThird, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([5, 5]));

    expect(afterThird.players[P1]!.inJail).toBe(true);
    expect(afterThird.players[P1]!.position).toBe(11);
    expect(events.some((e) => e.type === 'sent-to-jail' && e.reason === 'three-doubles')).toBe(true);
    // Turn passed to the next player — no reroll despite the double.
    expect(afterThird.turnOrder[afterThird.currentPlayerIndex]).toBe(P2);
  });
});

describe('buying and declining property', () => {
  it('buy: deducts price, records ownership, ends the turn (non-double roll)', () => {
    const state = freshState();
    const rolled = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2])).state; // tile 3, Lisbon 80
    const { state: bought, events } = applyAction(rolled, { type: 'buy', playerId: P1 }, scriptedRng([]));

    expect(bought.players[P1]!.cash).toBe(1500 - 80);
    expect(bought.ownership[3]).toEqual({ ownerId: P1, houses: 0, mortgaged: false });
    expect(events.some((e) => e.type === 'purchased')).toBe(true);
    expect(bought.turnOrder[bought.currentPlayerIndex]).toBe(P2); // turn advanced
  });

  it('decline: leaves the tile unowned and ends the turn', () => {
    const state = freshState({ auction: false });
    const rolled = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2])).state;
    const { state: declined } = applyAction(rolled, { type: 'decline-purchase', playerId: P1 }, scriptedRng([]));

    expect(declined.ownership[3]).toBeUndefined();
    expect(declined.turnOrder[declined.currentPlayerIndex]).toBe(P2);
  });

  it('rejects buying without enough cash', () => {
    const state = freshState();
    state.players[P1]!.cash = 10;
    const rolled = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2])).state;
    expect(() => applyAction(rolled, { type: 'buy', playerId: P1 }, scriptedRng([]))).toThrow(IllegalActionError);
  });
});

describe('rent', () => {
  it('is paid to the owner when landing on their property', () => {
    const state = freshState();
    state.ownership[3] = { ownerId: P2, houses: 0, mortgaged: false }; // Lisbon, price 80
    const tile = state.board.tiles[3]!;
    if (tile.kind !== 'property') throw new Error('expected property');

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.cash).toBe(1500 - tile.rentLadder[0]);
    expect(next.players[P2]!.cash).toBe(1500 + tile.rentLadder[0]);
    expect(events.some((e) => e.type === 'rent-paid')).toBe(true);
  });
});

describe('tax', () => {
  it('deducts the tax amount from the player', () => {
    const state = freshState();
    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 3])); // tile 4, Departure Tax 200

    expect(next.players[P1]!.cash).toBe(1500 - 200);
    expect(events.some((e) => e.type === 'tax-paid')).toBe(true);
  });
});

describe('jail', () => {
  it('go-to-jail tile sends the player to jail and ends the turn immediately', () => {
    const state = freshState();
    state.players[P1]!.position = 31;
    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 1])); // 31+2=33

    expect(next.players[P1]!.inJail).toBe(true);
    expect(next.players[P1]!.position).toBe(11);
    expect(events.some((e) => e.type === 'sent-to-jail' && e.reason === 'tile')).toBe(true);
    expect(next.turnOrder[next.currentPlayerIndex]).toBe(P2); // no reroll despite the double roll
  });

  it('a jailed player is offered a jail decision instead of a roll', () => {
    const state = freshState();
    state.players[P1]!.inJail = true;
    expect(() => applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]))).toThrow(
      IllegalActionError,
    );
  });

  it('paying the fine releases the player and lets them roll normally', () => {
    const state = freshState();
    state.players[P1]!.inJail = true;
    state.phase = { type: 'awaiting-jail-decision', playerId: P1 };

    const { state: next } = applyAction(state, { type: 'pay-jail-fine', playerId: P1 }, scriptedRng([]));
    expect(next.players[P1]!.inJail).toBe(false);
    expect(next.players[P1]!.cash).toBe(1500 - 50);
    expect(next.phase).toEqual({ type: 'awaiting-roll', playerId: P1 });
  });

  it('rolling doubles escapes jail and moves, with no bonus reroll', () => {
    const state = freshState();
    state.players[P1]!.inJail = true;
    state.players[P1]!.position = 12; // arbitrary start — the engine doesn't require it to equal the jail tile
    state.phase = { type: 'awaiting-jail-decision', playerId: P1 };

    // 5+5 from tile 12 lands on tile 22 (Vacation) — a neutral tile, so the
    // turn-end assertion below isn't confused with an awaiting-purchase phase.
    const { state: next, events } = applyAction(state, { type: 'roll-for-jail', playerId: P1 }, scriptedRng([5, 5]));
    expect(next.players[P1]!.inJail).toBe(false);
    expect(next.players[P1]!.position).toBe(22);
    expect(events.some((e) => e.type === 'released-from-jail' && e.method === 'rolled-doubles')).toBe(true);
    expect(next.turnOrder[next.currentPlayerIndex]).toBe(P2); // turn ends, no bonus roll
  });

  it('failing to roll doubles three times forces release without moving', () => {
    let state = freshState();
    state.players[P1]!.inJail = true;
    state.phase = { type: 'awaiting-jail-decision', playerId: P1 };
    // Turn order is p1,p2,p3 — force it back to p1 each time by resetting phase/index manually
    // to simulate three separate turns landing back on the jailed player.
    state = applyAction(state, { type: 'roll-for-jail', playerId: P1 }, scriptedRng([1, 2])).state;
    expect(state.players[P1]!.jailTurns).toBe(1);
    state.currentPlayerIndex = 0;
    state.phase = { type: 'awaiting-jail-decision', playerId: P1 };

    state = applyAction(state, { type: 'roll-for-jail', playerId: P1 }, scriptedRng([1, 2])).state;
    expect(state.players[P1]!.jailTurns).toBe(2);
    state.currentPlayerIndex = 0;
    state.phase = { type: 'awaiting-jail-decision', playerId: P1 };

    const { state: after3rd, events } = applyAction(state, { type: 'roll-for-jail', playerId: P1 }, scriptedRng([1, 2]));
    expect(after3rd.players[P1]!.inJail).toBe(false);
    expect(after3rd.players[P1]!.jailTurns).toBe(0);
    expect(after3rd.players[P1]!.cash).toBe(1500 - 50);
    expect(events.some((e) => e.type === 'released-from-jail' && e.method === 'max-turns')).toBe(true);
  });
});

describe('turn order', () => {
  it('has three players in the configured order at start', () => {
    const state = freshState();
    expect(state.turnOrder).toEqual(DEFAULT_PLAYERS.map((p) => p.id));
    expect(state.phase).toEqual({ type: 'awaiting-roll', playerId: P1 });
  });
});
