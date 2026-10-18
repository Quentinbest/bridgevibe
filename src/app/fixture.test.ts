import { expect, test } from 'vitest';
import { RANKS, SEATS, SUITS, type Deal } from '../table';
import { fixedDeal } from './fixture';
test('fixed Deal contains the entire deck, 13 Cards per Seat', () => {
  const deal: Deal = fixedDeal;
  const cards = SEATS.flatMap(seat => { expect(deal.hands[seat]).toHaveLength(13); return [...deal.hands[seat]]; });
  expect(new Set(cards.map(card => `${card.suit}:${card.rank}`))).toEqual(new Set(SUITS.flatMap(suit => RANKS.map(rank => `${suit}:${rank}`))));
  expect(deal.dealer).toBe('south');
  expect(deal.vulnerability).toEqual({ northSouth: false, eastWest: false });
});
