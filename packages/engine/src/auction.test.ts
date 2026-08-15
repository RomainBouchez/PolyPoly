import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { freshState, P1, P2, P3, scriptedRng } from './testUtils.js';

// Tile 1 = Sintra, price 60. Turn order is P1, P2, P3.

function declineIntoAuction() {
  const state = freshState({ auction: true });
  state.phase = { type: 'awaiting-purchase', playerId: P1, tileIndex: 1 };
  return applyAction(state, { type: 'decline-purchase', playerId: P1 }, scriptedRng([])).state;
}

describe('auction', () => {
  it('starts with everyone but the decliner bidding first, decliner rejoins at the end', () => {
    const state = declineIntoAuction();
    expect(state.phase).toMatchObject({ type: 'auction', tileIndex: 1, order: [P2, P3, P1], turnPlayerId: P2 });
  });

  it('resolves to the sole remaining bidder, with an unwilling bidder passing along the way', () => {
    let state = declineIntoAuction();
    state = applyAction(state, { type: 'auction-bid', playerId: P2, amount: 10 }, scriptedRng([])).state;
    // P3 never bids — the unwilling bidder — just passes.
    state = applyAction(state, { type: 'auction-pass', playerId: P3 }, scriptedRng([])).state;
    const { state: after, events } = applyAction(state, { type: 'auction-pass', playerId: P1 }, scriptedRng([]));

    expect(after.ownership[1]).toEqual({ ownerId: P2, houses: 0, mortgaged: false });
    expect(after.players[P2]!.cash).toBe(1500 - 10);
    expect(events.some((e) => e.type === 'auction-won' && e.playerId === P2 && e.amount === 10)).toBe(true);
    // Auction resolved mid P1's turn (no reroll) — turn should now be over.
    expect(after.turnOrder[after.currentPlayerIndex]).toBe(P2);
  });

  it('leaves the tile unowned when nobody bids', () => {
    let state = declineIntoAuction();
    state = applyAction(state, { type: 'auction-pass', playerId: P2 }, scriptedRng([])).state;
    const { state: after, events } = applyAction(state, { type: 'auction-pass', playerId: P3 }, scriptedRng([]));

    expect(after.ownership[1]).toBeUndefined();
    expect(events.some((e) => e.type === 'auction-no-sale' && e.tileIndex === 1)).toBe(true);
  });

  it('rejects a bid that does not beat the current high bid', () => {
    let state = declineIntoAuction();
    state = applyAction(state, { type: 'auction-bid', playerId: P2, amount: 10 }, scriptedRng([])).state;
    expect(() => applyAction(state, { type: 'auction-bid', playerId: P3, amount: 10 }, scriptedRng([]))).toThrow();
  });

  it('rejects bidding out of turn', () => {
    const state = declineIntoAuction();
    expect(() => applyAction(state, { type: 'auction-bid', playerId: P3, amount: 10 }, scriptedRng([]))).toThrow();
  });

  it('excludes jailed players from the bidding order', () => {
    const state = freshState({ auction: true });
    state.players[P2]!.inJail = true;
    state.phase = { type: 'awaiting-purchase', playerId: P1, tileIndex: 1 };
    const after = applyAction(state, { type: 'decline-purchase', playerId: P1 }, scriptedRng([])).state;
    expect(after.phase).toMatchObject({ type: 'auction', order: [P3, P1], turnPlayerId: P3 });
  });

  it('skips the auction as a no-sale when the decliner is the only eligible bidder left', () => {
    const state = freshState({ auction: true });
    state.players[P2]!.inJail = true;
    state.players[P3]!.inJail = true;
    state.phase = { type: 'awaiting-purchase', playerId: P1, tileIndex: 1 };
    const { state: after, events } = applyAction(state, { type: 'decline-purchase', playerId: P1 }, scriptedRng([]));

    expect(after.phase.type).not.toBe('auction');
    expect(after.ownership[1]).toBeUndefined();
    expect(events.some((e) => e.type === 'auction-no-sale' && e.tileIndex === 1)).toBe(true);
    expect(events.some((e) => e.type === 'auction-started')).toBe(false);
  });
});
