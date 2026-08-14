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

function property(
  index: number,
  group: PropertyGroup,
  name: string,
  emoji: string,
  price: number,
  healthEffect?: HealthEffect,
): PropertyTile {
  return {
    kind: 'property',
    index,
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

const tiles: Tile[] = [
  { kind: 'go', index: 0, name: 'Go' },

  // Side 1: Portugal x2, travel card, Portugal x1, tax, airport, hospital, Greece x3
  property(1, 'portugal', 'Sintra', '🏰', 60),
  property(2, 'portugal', 'Porto', '🍷', 60, FAST_FOOD),
  { kind: 'card', index: 3, deck: 'travel' },
  property(4, 'portugal', 'Lisbon', '🚋', 80),
  { kind: 'tax', index: 5, name: 'Departure Tax', amount: 200 },
  { kind: 'airport', index: 6, name: 'Lisbon Airport', price: 200, mortgageValue: 100 },
  { kind: 'hospital', index: 7, name: 'Central Hospital', price: 150, mortgageValue: 75 },
  property(8, 'greece', 'Poros', '🏝️', 100, CHICHA),
  property(9, 'greece', 'Naxos', '🌊', 100),
  property(10, 'greece', 'Athens', '🏛️', 120, FAST_FOOD),

  { kind: 'jail', index: 11, name: 'Jail / Just Visiting' },

  // Side 2: Norway x2, customs card, Norway x1, utility, airport, hospital, Netherlands x3
  property(12, 'norway', 'Tromsø', '🌌', 140),
  property(13, 'norway', 'Bergen', '⛰️', 140, BASIC_FIT),
  { kind: 'card', index: 14, deck: 'customs' },
  property(15, 'norway', 'Oslo', '🛶', 160),
  { kind: 'utility', index: 16, name: 'Ferry Company', price: 150, mortgageValue: 75 },
  { kind: 'airport', index: 17, name: 'Oslo Airport', price: 200, mortgageValue: 100 },
  { kind: 'hospital', index: 18, name: 'North Hospital', price: 150, mortgageValue: 75 },
  property(19, 'netherlands', 'Rotterdam', '🚢', 180),
  property(20, 'netherlands', 'Utrecht', '⛲', 180),
  property(21, 'netherlands', 'Amsterdam', '🚲', 200),

  { kind: 'vacation', index: 22, name: 'Vacation' },

  // Side 3: Spain x2, travel card, Spain x1, utility, airport, hospital, Italy x3
  property(23, 'spain', 'Seville', '💃', 220),
  property(24, 'spain', 'Barcelona', '🏟️', 220),
  { kind: 'card', index: 25, deck: 'travel' },
  property(26, 'spain', 'Madrid', '🎨', 240, MARCHE_BIO),
  { kind: 'utility', index: 27, name: 'Railway Network', price: 150, mortgageValue: 75 },
  { kind: 'airport', index: 28, name: 'Madrid Airport', price: 200, mortgageValue: 100 },
  { kind: 'hospital', index: 29, name: 'South Hospital', price: 150, mortgageValue: 75 },
  property(30, 'italy', 'Florence', '🎭', 260),
  property(31, 'italy', 'Venice', '🚤', 260, FAST_FOOD),
  property(32, 'italy', 'Rome', '🏟️', 280),

  { kind: 'go-to-jail', index: 33, name: 'Go To Jail' },

  // Side 4: UK x2, customs card, UK x1, airport, tax, France x3
  property(34, 'uk', 'Bristol', '🌉', 300, PHARMACIE),
  property(35, 'uk', 'Manchester', '⚽', 300),
  { kind: 'card', index: 36, deck: 'customs' },
  property(37, 'uk', 'London', '🎡', 320),
  { kind: 'airport', index: 38, name: 'London Airport', price: 200, mortgageValue: 100 },
  { kind: 'tax', index: 39, name: 'Luxury Tax', amount: 100 },
  property(40, 'france', 'Mont-Saint-Michel', '🗻', 350),
  property(41, 'france', 'Nantes', '🐘', 350),
  property(42, 'france', 'Paris', '🗼', 400),
];

export const boardEurope: Board = { tiles };
