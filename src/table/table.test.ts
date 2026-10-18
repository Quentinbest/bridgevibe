import { expect, test } from 'vitest';
import { SUITS, RANKS, SEATS } from './index';
test('four suits and thirteen ranks make 52 distinct cards', () => {
  expect(SUITS).toHaveLength(4);
  expect(RANKS).toHaveLength(13);
  expect(new Set(SUITS.flatMap(suit => RANKS.map(rank => `${suit}:${rank}`))).size).toBe(52);
});
test('four distinct seats', () => { expect(SEATS).toHaveLength(4); expect(new Set(SEATS).size).toBe(4); });
