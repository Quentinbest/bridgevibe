import { expect, test } from 'vitest';
import data from '../docs/domain/t5-auctions-draft/auctions.json';

// T5 / #4: the draft auction set stays valid data while teachers edit it.
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const HCP: Record<string, number> = { A: 4, K: 3, Q: 2, J: 1 };
const cards = (holding: string) => holding.match(/10|[AKQJ98765432]/g) ?? [];
test('T5: 30 auctions, each a legal 13-card hand with its stated HCP, seat and required cases', () => {
  expect(data.auctions).toHaveLength(30);
  for (const auction of data.auctions) {
    const suits = Object.values(auction.hand).map(cards);
    expect(suits.flat(), auction.id).toHaveLength(13);
    for (const suit of suits) expect(new Set(suit).size, auction.id).toBe(suit.length);
    expect(suits.flat().every(rank => RANKS.includes(rank))).toBe(true);
    expect(suits.flat().reduce((n, rank) => n + (HCP[rank] ?? 0), 0), auction.id).toBe(auction.hcp);
    expect(suits.map(s => s.length).join('-'), auction.id).toBe(auction.shape);
    const seats = ['N', 'E', 'S', 'W'];
    expect(auction.seat, auction.id).toBe(seats[(seats.indexOf(auction.dealer) + auction.auction.length) % 4]);
  }
  const tags = data.auctions.flatMap(a => a.tags);
  for (const required of ['valid-alternative', 'forcing', 'not-covered']) expect(tags).toContain(required);
});
