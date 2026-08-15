import type { Board, HealthEffect, PropertyGroup, PropertyTile, Tile } from '../board.types.js';

/**
 * Classic-Monopoly-style rent curve derived from price: base rent scales with
 * price, and houses/hotel multiply it 5x/15x/45x/80x/125x — the same ratios
 * Mediterranean Avenue uses (price 60 -> base 2 -> ladder 2/10/30/90/160/250).
 */
function rentLadder(price: number): PropertyTile['rentLadder'] {
  const base = Math.max(2, Math.round(price / 30 / 2) * 2);
  return [base, base * 5, base * 15, base * 45, base * 80, base * 125];
}

// `index` is assigned by the final pass below (matching each tile's position
// in `tiles`) — every builder here takes a placeholder 0 so inserting or
// reordering tiles never requires renumbering everything after it by hand.
function property(
  group: PropertyGroup,
  name: string,
  emoji: string,
  price: number,
  healthEffect?: HealthEffect,
): PropertyTile {
  return {
    kind: 'property',
    index: 0,
    group,
    name,
    emoji,
    price,
    rentLadder: rentLadder(price),
    houseCost: Math.round(price / 2 / 10) * 10,
    mortgageValue: price / 2,
    ...(healthEffect ? { healthEffect } : {}),
  };
}

const FAST_FOOD: HealthEffect = { cashDelta: 10, healthDelta: -10 };
const BASIC_FIT: HealthEffect = { cashDelta: -20, healthDelta: 15 };
const CHICHA: HealthEffect = { cashDelta: 0, healthDelta: -15 };
const MARCHE_BIO: HealthEffect = { cashDelta: -40, healthDelta: 10 };
const PHARMACIE: HealthEffect = { cashDelta: 0, healthDelta: 0, pharmacy: true };

// Board is 44 tiles, laid out as 4 EQUAL sides of 10 (bottom/left/top/right)
// between the 4 corners. Emergency (bottom) and Sunny (top) were added right
// after each side's hospital, keeping bottom==top and left==right so every
// side lands on the same length — same reasoning as the original 9/10/9/10
// layout's Sintra cut / Rome move, just extended to fit the two new tiles
// without reintroducing an uneven side.
const tiles: Tile[] = [
  { kind: 'go', index: 0, name: 'Go' },

  // Side 1 (bottom): Portugal x1, travel card, Portugal x1, tax, airport, hospital, emergency, Greece x3
  property('portugal', 'Porto', '🍷', 60, FAST_FOOD),
  { kind: 'card', index: 0, deck: 'travel' },
  property('portugal', 'Lisbon', '🚋', 80),
  { kind: 'tax', index: 0, name: 'Departure Tax', amount: 200 },
  { kind: 'airport', index: 0, name: 'Lisbon Airport', price: 200, mortgageValue: 100 },
  { kind: 'hospital', index: 0, name: 'Central Hospital', price: 150, mortgageValue: 75 },
  { kind: 'emergency', index: 0, name: 'Emergency' },
  property('greece', 'Poros', '🏝️', 100, CHICHA),
  property('greece', 'Naxos', '🌊', 100),
  property('greece', 'Athens', '🏛️', 120, FAST_FOOD),

  { kind: 'jail', index: 0, name: 'Jail / Just Visiting' },

  // Side 2 (left): Norway x2, customs card, Norway x1, utility, airport, hospital, Netherlands x3
  property('norway', 'Tromsø', '🌌', 140),
  property('norway', 'Bergen', '⛰️', 140, BASIC_FIT),
  { kind: 'card', index: 0, deck: 'customs' },
  property('norway', 'Oslo', '🛶', 160),
  { kind: 'utility', index: 0, name: 'Ferry Company', price: 150, mortgageValue: 75 },
  { kind: 'airport', index: 0, name: 'Oslo Airport', price: 200, mortgageValue: 100 },
  { kind: 'hospital', index: 0, name: 'North Hospital', price: 150, mortgageValue: 75 },
  property('netherlands', 'Rotterdam', '🚢', 180),
  property('netherlands', 'Utrecht', '⛲', 180),
  property('netherlands', 'Amsterdam', '🚲', 200),

  { kind: 'vacation', index: 0, name: 'Vacation' },

  // Side 3 (top): Spain x2, travel card, Spain x1, utility, airport, hospital, sunny, Italy x2
  property('spain', 'Seville', '💃', 220),
  property('spain', 'Barcelona', '🏟️', 220),
  { kind: 'card', index: 0, deck: 'travel' },
  property('spain', 'Madrid', '🎨', 240, MARCHE_BIO),
  { kind: 'utility', index: 0, name: 'Railway Network', price: 150, mortgageValue: 75 },
  { kind: 'airport', index: 0, name: 'Madrid Airport', price: 200, mortgageValue: 100 },
  { kind: 'hospital', index: 0, name: 'South Hospital', price: 150, mortgageValue: 75 },
  { kind: 'sunny', index: 0, name: 'Sunny Day' },
  property('italy', 'Florence', '🎭', 260),
  property('italy', 'Venice', '🚤', 260, FAST_FOOD),

  { kind: 'go-to-jail', index: 0, name: 'Go To Jail' },

  // Side 4 (right): Italy x1, UK x2, customs card, UK x1, airport, tax, France x3
  property('italy', 'Rome', '🏟️', 280),
  property('uk', 'Bristol', '🌉', 300, PHARMACIE),
  property('uk', 'Manchester', '⚽', 300),
  { kind: 'card', index: 0, deck: 'customs' },
  property('uk', 'London', '🎡', 320),
  { kind: 'airport', index: 0, name: 'London Airport', price: 200, mortgageValue: 100 },
  { kind: 'tax', index: 0, name: 'Luxury Tax', amount: 100 },
  property('france', 'Mont-Saint-Michel', '🗻', 350),
  property('france', 'Nantes', '🐘', 350),
  property('france', 'Paris', '🗼', 400),
];

tiles.forEach((tile, i) => {
  tile.index = i;
});

export const boardEurope: Board = { tiles };
