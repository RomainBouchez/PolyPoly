import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { GO_SALARY_SICK, JAIL_HEALTH_DRAIN } from './rules.js';
import { freshState, P1, P2, scriptedRng } from './testUtils.js';

// Board indices used below (see data/board.europe.ts):
//  1, 10, 32 = fast food (+cash/-health)   13 = Basic Fit   8 = Chicha
//  26 = Marché bio   35 = Pharmacie (Bristol)
//  6, 18, 29 = hospitals   40 = tax, 42 = Nantes (both health-neutral landings)

describe('illness (double-1)', () => {
  it('costs 20 health at normal health, and unpaid hospital shares go to the vacation pot', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 40; // lands on tile 42 (Nantes) with [1,1] — no health-effect tile
    state.players[P1]!.health = 50;

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 1]));

    expect(next.players[P1]!.health).toBe(30);
    expect(next.vacationPot).toBe(75); // 3 unowned hospitals x $25
    expect(events.some((e) => e.type === 'illness' && !e.doublePeine && e.healthLoss === 20)).toBe(true);
  });

  it('double peine: costs extra health but no longer doubles the cash, when already in the sick zone', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 40;
    state.players[P1]!.health = 15; // already 0-20

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 1]));

    expect(next.players[P1]!.health).toBe(0); // 15 - 30, clamped
    // Doubling the payout too drained whoever could least afford it, so the
    // second penalty is health-only now: 3 unowned hospitals x $25, undoubled.
    expect(next.vacationPot).toBe(75);
    expect(events.some((e) => e.type === 'illness' && e.doublePeine && e.healthLoss === 30)).toBe(true);
  });

  it('pays each hospital owner by their own hospital count, self-ownership nets to zero', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 40;
    state.players[P1]!.health = 50;
    state.ownership[6] = { ownerId: P2, houses: 0, mortgaged: false }; // P2 owns 1 hospital -> $25
    state.ownership[18] = { ownerId: P1, houses: 0, mortgaged: false }; // P1 (the sick player) owns 1 -> self-pay, net 0
    // tile 29 stays unowned -> its $25 share goes to the pot

    const { state: next } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 1]));

    expect(next.players[P2]!.cash).toBe(1500 + 25);
    expect(next.players[P1]!.cash).toBe(1500 - 25); // paid P2 only; self-pay left cash untouched
    expect(next.vacationPot).toBe(25);
  });

  it('scales the payout with the owner\'s own hospital count (1/2/3 -> 25/50/90)', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 40;
    state.players[P1]!.health = 50;
    state.ownership[6] = { ownerId: P2, houses: 0, mortgaged: false };
    state.ownership[18] = { ownerId: P2, houses: 0, mortgaged: false };
    state.ownership[29] = { ownerId: P2, houses: 0, mortgaged: false };

    const { state: next } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 1]));

    expect(next.players[P2]!.cash).toBe(1500 + 90); // all 3 hospitals, one owner
    expect(next.vacationPot).toBe(0);
  });

  it('does not trigger when healthMode is off', () => {
    const state = freshState({ healthMode: false });
    state.players[P1]!.position = 40;
    state.players[P1]!.health = 50;

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 1]));

    expect(next.players[P1]!.health).toBe(50); // untouched
    expect(events.some((e) => e.type === 'illness')).toBe(false);
  });
});

describe('health-effect tiles', () => {
  it('apply on landing regardless of ownership (unowned tile still triggers the effect)', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 10; // +3 (non-double) -> tile 13, Bergen (Basic Fit: -20 cash, +15 health)
    state.players[P1]!.health = 50;

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.cash).toBe(1500 - 20);
    expect(next.players[P1]!.health).toBe(65);
    expect(events.some((e) => e.type === 'health-effect' && e.tileIndex === 13 && e.cashDelta === -20 && e.healthDelta === 15)).toBe(
      true,
    );
    // Still unowned -> still goes to purchase decision on top of the health effect.
    expect(next.phase).toEqual({ type: 'awaiting-purchase', playerId: P1, tileIndex: 13 });
  });

  it('clamp health at 0 and 100', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 10;
    state.players[P1]!.health = 95; // Basic Fit would push to 110, must clamp at 100

    const { state: next } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));
    expect(next.players[P1]!.health).toBe(100);
  });
});

describe('pharmacy', () => {
  it('resets health to 50 once, then does nothing on a later visit', () => {
    let state = freshState({ healthMode: true });
    state.players[P1]!.position = 31; // +4 (non-double) -> tile 35, Bristol (pharmacy)
    state.players[P1]!.health = 10;

    const first = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 3]));
    expect(first.state.players[P1]!.health).toBe(50);
    expect(first.state.players[P1]!.pharmacyUsed).toBe(true);
    expect(first.events.some((e) => e.type === 'health-effect' && e.tileIndex === 35 && e.healthDelta === 40)).toBe(true);

    state = first.state;
    state.phase = { type: 'awaiting-roll', playerId: P1 }; // was awaiting-purchase (Bristol was unowned)
    state.players[P1]!.position = 31;
    state.players[P1]!.health = 5;

    const second = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 3]));
    expect(second.state.players[P1]!.health).toBe(5); // unchanged — already used this game
    expect(second.events.some((e) => e.type === 'health-effect')).toBe(false);
  });
});

describe('Go bonus interaction with health', () => {
  it('pays the reduced salary while in the sick zone, and still grants the health bonus', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 41; // +3 (non-double) wraps past Go to tile 0
    state.players[P1]!.health = 15;

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.cash).toBe(1500 + GO_SALARY_SICK); // reduced, not withheld
    expect(next.players[P1]!.health).toBe(20); // +5, still capped at 100
    expect(events.some((e) => e.type === 'collected-go' && e.amount === GO_SALARY_SICK)).toBe(true);
  });

  it('pays the normal $200 plus the health bonus outside the sick zone', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 41;
    state.players[P1]!.health = 50;

    const { state: next, events } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.cash).toBe(1500 + 200);
    expect(next.players[P1]!.health).toBe(55);
    expect(events.some((e) => e.type === 'collected-go')).toBe(true);
  });

  it('behaves like a normal game when healthMode is off (no health field consequences)', () => {
    const state = freshState({ healthMode: false });
    state.players[P1]!.position = 41;

    const { state: next } = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([1, 2]));
    expect(next.players[P1]!.cash).toBe(1500 + 200);
  });
});

describe('jail health drain', () => {
  function jailed(health: number, config = { healthMode: true }) {
    const state = freshState(config);
    state.players[P1]!.inJail = true;
    state.players[P1]!.jailTurns = 0;
    state.players[P1]!.health = health;
    state.phase = { type: 'awaiting-jail-decision', playerId: P1 };
    return state;
  }

  it('costs health for a turn spent in jail, and says so', () => {
    const { state: next, events } = applyAction(jailed(50), { type: 'roll-for-jail', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.health).toBe(50 - JAIL_HEALTH_DRAIN);
    expect(events.some((e) => e.type === 'jail-health-lost' && e.amount === JAIL_HEALTH_DRAIN)).toBe(true);
  });

  it('does not drain when the player rolls doubles and walks straight out', () => {
    const { state: next, events } = applyAction(jailed(50), { type: 'roll-for-jail', playerId: P1 }, scriptedRng([2, 2]));

    expect(next.players[P1]!.inJail).toBe(false);
    expect(next.players[P1]!.health).toBe(50);
    expect(events.some((e) => e.type === 'jail-health-lost')).toBe(false);
  });

  it('never drives health below zero', () => {
    const { state: next } = applyAction(jailed(2), { type: 'roll-for-jail', playerId: P1 }, scriptedRng([1, 2]));
    expect(next.players[P1]!.health).toBe(0);
  });

  it('does nothing when healthMode is off', () => {
    const state = jailed(50, { healthMode: false });
    const { state: next, events } = applyAction(state, { type: 'roll-for-jail', playerId: P1 }, scriptedRng([1, 2]));

    expect(next.players[P1]!.health).toBe(50);
    expect(events.some((e) => e.type === 'jail-health-lost')).toBe(false);
  });

  it('costs at most one full stay — 3 turns, 9 health', () => {
    let state = jailed(50);
    let total = 0;
    for (let turn = 0; turn < 3; turn++) {
      const r = applyAction(state, { type: 'roll-for-jail', playerId: P1 }, scriptedRng([1, 2]));
      total += r.events.filter((e) => e.type === 'jail-health-lost').length;
      state = r.state;
      state.phase = { type: 'awaiting-jail-decision', playerId: P1 };
    }
    expect(total).toBe(3);
    expect(state.players[P1]!.health).toBe(50 - 3 * JAIL_HEALTH_DRAIN);
    expect(state.players[P1]!.inJail).toBe(false); // released after MAX_JAIL_TURNS
  });
});
