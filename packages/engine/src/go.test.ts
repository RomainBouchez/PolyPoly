import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction.js';
import { GO_SALARY, GO_SALARY_SICK } from './rules.js';
import { freshState, P1, scriptedRng } from './testUtils.js';

// The board is 44 tiles, Go is index 0. Rolling from 40 with a 4 lands
// exactly on Go; with a 6 it wraps past Go onto Porto.
const START_CASH = 1500;

function rollFrom(position: number, dice: [number, number], config = {}) {
  const state = freshState(config);
  state.players[P1]!.position = position;
  return applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([...dice, 1, 1, 1, 1]));
}

const gained = (r: ReturnType<typeof rollFrom>) => r.state.players[P1]!.cash - START_CASH;
const collected = (r: ReturnType<typeof rollFrom>) => r.events.filter((e) => e.type === 'collected-go');

describe('passing Go', () => {
  it('pays when wrapping past Go', () => {
    const r = rollFrom(40, [3, 3]); // 40 + 6 -> tile 2
    expect(r.state.players[P1]!.position).toBe(2);
    expect(gained(r)).toBe(GO_SALARY);
    expect(collected(r)).toHaveLength(1);
  });

  it('pays when landing exactly on Go', () => {
    const r = rollFrom(40, [2, 2]); // 40 + 4 -> tile 0
    expect(r.state.players[P1]!.position).toBe(0);
    expect(gained(r)).toBe(GO_SALARY);
    expect(collected(r)).toHaveLength(1);
  });

  it('pays exactly once, not twice, when landing on Go', () => {
    expect(collected(rollFrom(40, [2, 2]))).toHaveLength(1);
  });

  it('pays when a double lands exactly on Go', () => {
    const r = rollFrom(38, [3, 3]); // doubles, 38 + 6 -> tile 0
    expect(r.state.players[P1]!.position).toBe(0);
    expect(gained(r)).toBe(GO_SALARY);
  });

  it('does not pay on a move that stays short of Go', () => {
    const r = rollFrom(30, [2, 3]);
    expect(gained(r)).toBe(0);
    expect(collected(r)).toEqual([]);
  });

  it('does not pay when three doubles send the player to jail', () => {
    const state = freshState();
    state.players[P1]!.position = 40;
    state.doublesCount = 2; // this roll is the third double
    const r = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([2, 2]));
    expect(r.state.players[P1]!.cash).toBe(START_CASH);
    expect(r.events.some((e) => e.type === 'collected-go')).toBe(false);
  });
});

describe('passing Go in health mode', () => {
  it('still pays a healthy player', () => {
    const r = rollFrom(40, [2, 2], { healthMode: true });
    expect(gained(r)).toBe(GO_SALARY);
  });

  // A sick player used to get nothing at all, which left them unable to fund
  // the very things that would cure them. They now collect a reduced salary.
  it('pays a sick player the reduced salary, not nothing', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 40;
    state.players[P1]!.health = 20;
    const r = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([2, 2, 1, 1]));
    expect(r.state.players[P1]!.cash - START_CASH).toBe(GO_SALARY_SICK);
    expect(r.events.some((e) => e.type === 'collected-go')).toBe(true);
  });

  it('pays at health 21, just above the sick threshold', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 40;
    state.players[P1]!.health = 21;
    const r = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([2, 2, 1, 1]));
    expect(r.state.players[P1]!.cash - START_CASH).toBe(GO_SALARY);
  });

  it('still restores health when passing Go while sick', () => {
    const state = freshState({ healthMode: true });
    state.players[P1]!.position = 40;
    state.players[P1]!.health = 10;
    const r = applyAction(state, { type: 'roll', playerId: P1 }, scriptedRng([2, 2, 1, 1]));
    expect(r.state.players[P1]!.health).toBeGreaterThan(10);
  });
});
