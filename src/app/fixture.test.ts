import { expect, test } from 'vitest';
import { RANKS, SEATS, SUITS, type Deal } from '../table';
import * as fixture from './fixture';

// The Deal behind the static screen. It lives here, not in the app, so hidden cards never
// reach the UI or its bundle (ADR-0001, US-16.4).
const fixedDeal = {
  hands: {
    north: [
      { suit: 'spades', rank: 'A' },
      { suit: 'spades', rank: '5' },
      { suit: 'spades', rank: '2' },
      { suit: 'hearts', rank: 'Q' },
      { suit: 'hearts', rank: '4' },
      { suit: 'diamonds', rank: 'K' },
      { suit: 'diamonds', rank: 'Q' },
      { suit: 'diamonds', rank: '9' },
      { suit: 'diamonds', rank: '7' },
      { suit: 'clubs', rank: 'A' },
      { suit: 'clubs', rank: '9' },
      { suit: 'clubs', rank: '6' },
      { suit: 'clubs', rank: '4' },
    ],
    east: [
      { suit: 'spades', rank: '8' },
      { suit: 'spades', rank: '7' },
      { suit: 'spades', rank: '3' },
      { suit: 'hearts', rank: '8' },
      { suit: 'hearts', rank: '6' },
      { suit: 'hearts', rank: '5' },
      { suit: 'hearts', rank: '2' },
      { suit: 'diamonds', rank: '10' },
      { suit: 'diamonds', rank: '6' },
      { suit: 'diamonds', rank: '4' },
      { suit: 'clubs', rank: '5' },
      { suit: 'clubs', rank: '3' },
      { suit: 'clubs', rank: '2' },
    ],
    south: [
      { suit: 'spades', rank: 'K' },
      { suit: 'spades', rank: '6' },
      { suit: 'spades', rank: '4' },
      { suit: 'hearts', rank: 'A' },
      { suit: 'hearts', rank: '7' },
      { suit: 'hearts', rank: '3' },
      { suit: 'diamonds', rank: 'A' },
      { suit: 'diamonds', rank: 'J' },
      { suit: 'diamonds', rank: '5' },
      { suit: 'diamonds', rank: '2' },
      { suit: 'clubs', rank: 'K' },
      { suit: 'clubs', rank: 'Q' },
      { suit: 'clubs', rank: '8' },
    ],
    west: [
      { suit: 'spades', rank: 'Q' },
      { suit: 'spades', rank: 'J' },
      { suit: 'spades', rank: '10' },
      { suit: 'spades', rank: '9' },
      { suit: 'hearts', rank: 'K' },
      { suit: 'hearts', rank: 'J' },
      { suit: 'hearts', rank: '10' },
      { suit: 'hearts', rank: '9' },
      { suit: 'diamonds', rank: '8' },
      { suit: 'diamonds', rank: '3' },
      { suit: 'clubs', rank: 'J' },
      { suit: 'clubs', rank: '10' },
      { suit: 'clubs', rank: '7' },
    ],
  },
  dealer: 'south',
  vulnerability: { northSouth: false, eastWest: false },
} as const satisfies Deal;

const key = (card: { suit: string; rank: string }) => `${card.suit}:${card.rank}`;

test('fixed Deal contains the entire deck, 13 Cards per Seat', () => {
  const deal: Deal = fixedDeal;
  const cards = SEATS.flatMap(seat => { expect(deal.hands[seat]).toHaveLength(13); return [...deal.hands[seat]]; });
  expect(new Set(cards.map(key))).toEqual(new Set(SUITS.flatMap(suit => RANKS.map(rank => `${suit}:${rank}`))));
  expect(deal.dealer).toBe('south');
  expect(deal.vulnerability).toEqual({ northSouth: false, eastWest: false });
});

test('the learner view shows Dummy and the learner\'s hand, and only counts for opponents', () => {
  expect(fixture.learnerView.dummy).toEqual(fixedDeal.hands.north);
  expect(fixture.learnerView.hand).toEqual(fixedDeal.hands.south);
  expect(fixture.learnerView.opponentCardCount).toEqual({ west: fixedDeal.hands.west.length, east: fixedDeal.hands.east.length });
  // No opponent card identity appears anywhere the app can import.
  const exported = JSON.stringify(fixture);
  for (const card of [...fixedDeal.hands.west, ...fixedDeal.hands.east]) {
    expect(exported).not.toContain(JSON.stringify(card));
  }
});
