import type { Card } from '../cards.types.js';

// Text is placeholder and meant to be rewritten. Effects are what the engine reads.

export const travelDeck: Card[] = [
  { id: 'travel-01', text: 'Flight upgrade! Collect $50.', effect: { type: 'collect', amount: 50 } },
  { id: 'travel-02', text: 'Lost luggage. Pay $50.', effect: { type: 'pay', amount: 50 } },
  { id: 'travel-03', text: 'Advance to Go. Collect $200.', effect: { type: 'move-to', tileIndex: 0 } },
  { id: 'travel-04', text: 'Advance to Paris.', effect: { type: 'move-to', tileIndex: 43 } },
  { id: 'travel-05', text: 'Go back 3 spaces.', effect: { type: 'move-relative', steps: -3 } },
  { id: 'travel-06', text: 'Travel insurance payout. Collect $100.', effect: { type: 'collect', amount: 100 } },
  { id: 'travel-07', text: 'Missed connection. Go to Jail.', effect: { type: 'go-to-jail' } },
  { id: 'travel-08', text: 'Frequent flyer bonus. Collect $150.', effect: { type: 'collect', amount: 150 } },
  { id: 'travel-09', text: 'Souvenir shopping spree. Pay $75.', effect: { type: 'pay', amount: 75 } },
  { id: 'travel-10', text: 'Get Out of Jail Free.', effect: { type: 'get-out-of-jail-free' } },
  { id: 'travel-11', text: 'Everyone loved your postcards. Collect $25 from each player.', effect: { type: 'collect-from-each-player', amount: 25 } },
  { id: 'travel-12', text: 'Group dinner is on you. Pay each player $25.', effect: { type: 'pay-each-player', amount: 25 } },
  { id: 'travel-13', text: 'Advance to Athens.', effect: { type: 'move-to', tileIndex: 10 } },
  { id: 'travel-14', text: 'Advance to Amsterdam.', effect: { type: 'move-to', tileIndex: 21 } },
  { id: 'travel-15', text: 'Bonus miles. Move forward 4 spaces.', effect: { type: 'move-relative', steps: 4 } },
  { id: 'travel-16', text: 'Refund from a cancelled tour. Collect $75.', effect: { type: 'collect', amount: 75 } },
  { id: 'travel-17', text: 'Chance encounter — form a temporary alliance with a fellow traveler for 3 turns!', effect: { type: 'form-alliance' }, requiresConfig: 'allianceMode' },
];

export const customsDeck: Card[] = [
  { id: 'customs-01', text: 'Random bag check. Pay $100.', effect: { type: 'pay', amount: 100 } },
  { id: 'customs-02', text: 'Nothing to declare. Collect $20.', effect: { type: 'collect', amount: 20 } },
  { id: 'customs-03', text: 'Overstayed your visa. Go to Jail.', effect: { type: 'go-to-jail' } },
  { id: 'customs-04', text: 'Duty-free refund. Collect $60.', effect: { type: 'collect', amount: 60 } },
  { id: 'customs-05', text: 'Currency exchange fee. Pay $40.', effect: { type: 'pay', amount: 40 } },
  { id: 'customs-06', text: 'Advance to Lisbon Airport.', effect: { type: 'move-to', tileIndex: 5 } },
  { id: 'customs-07', text: 'Get Out of Jail Free.', effect: { type: 'get-out-of-jail-free' } },
  { id: 'customs-08', text: 'VIP lounge access. Collect $100.', effect: { type: 'collect', amount: 100 } },
  { id: 'customs-09', text: 'Border tax audit. Pay $150.', effect: { type: 'pay', amount: 150 } },
  { id: 'customs-10', text: 'You inspired the group. Collect $25 from each player.', effect: { type: 'collect-from-each-player', amount: 25 } },
  { id: 'customs-11', text: 'You broke the group luggage cart. Pay each player $25.', effect: { type: 'pay-each-player', amount: 25 } },
  { id: 'customs-12', text: 'Advance to Rome.', effect: { type: 'move-to', tileIndex: 34 } },
  { id: 'customs-13', text: 'Move back 2 spaces for a re-check.', effect: { type: 'move-relative', steps: -2 } },
  { id: 'customs-14', text: 'Fast-track security. Move forward 3 spaces.', effect: { type: 'move-relative', steps: 3 } },
  { id: 'customs-15', text: 'Diplomatic immunity. Collect $50.', effect: { type: 'collect', amount: 50 } },
  { id: 'customs-16', text: 'Customs fine. Pay $80.', effect: { type: 'pay', amount: 80 } },
];
