import { describe, expect, test, vi } from 'vitest';
import { DEALING_ALGORITHM, dealFromSeed, dealIdOf, redeal, SEATS, SUITS, startPlaythrough, type Hand } from './index';
import { sha256 } from './dealing';
import vectors from './dealing-vectors.json';

// US-03.4: these published vectors run unchanged in Node and Chromium.
for (const vector of vectors) test(`published vector ${vector.seed}:${vector.index}`, () => {
  const deal = dealFromSeed(vector.seed, vector.index);
  const pbn = 'N:' + SEATS.map(seat => SUITS.map(suit => deal.hands[seat]
    .filter(card => card.suit === suit).map(card => card.rank === '10' ? 'T' : card.rank).join('')).join('.')).join(' ');
  expect({ pbn, dealer: deal.dealer, vulnerability: deal.vulnerability, dealId: deal.dealId })
    .toEqual({ pbn: vector.pbn, dealer: vector.dealer, vulnerability: vector.vulnerability, dealId: vector.dealId });
  expect(deal.origin).toEqual({ kind: 'seed', seed: vector.seed, index: vector.index, rotation: 0, algorithm: DEALING_ALGORITHM });
  expect(dealFromSeed(vector.seed, vector.index)).toEqual(deal);
  expect(new Set(Object.values(deal.hands).flat().map(card => `${card.suit}:${card.rank}`)).size).toBe(52);
  for (const hand of Object.values(deal.hands)) expect(hand).toHaveLength(13);
});
test.each([
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
])('SHA-256 standard vector %s', (message, digest) => expect(sha256(message)).toBe(digest));
test('duplicate dealer and vulnerability cycle covers all 16 boards and repeats', () => {
  const cycle = ['none', 'NS', 'EW', 'both', 'NS', 'EW', 'both', 'none', 'EW', 'both', 'none', 'NS', 'both', 'none', 'NS', 'EW'];
  for (let i = 0; i < 32; i++) {
    const deal = dealFromSeed('cycle', i + 1), vulnerability = cycle[i % 16];
    expect(deal.dealer).toBe(SEATS[i % 4]);
    expect(deal.vulnerability).toEqual({ northSouth: ['NS', 'both'].includes(vulnerability), eastWest: ['EW', 'both'].includes(vulnerability) });
  }
});
test('content identity ignores hand order and origin, but includes dealer and vulnerability', () => {
  const deal = dealFromSeed('abc', 1);
  const reordered = { ...deal, hands: { ...deal.hands, north: [...deal.hands.north].reverse() as unknown as Hand },
    origin: { kind: 'authored' as const, contentId: 'test', version: 1 } };
  expect(dealIdOf(reordered)).toBe(deal.dealId);
  expect(dealIdOf({ ...deal, dealer: 'east' })).not.toBe(deal.dealId);
  expect(dealIdOf({ ...deal, vulnerability: { northSouth: true, eastWest: false } })).not.toBe(deal.dealId);
  expect(() => redeal(reordered)).toThrow(RangeError);
});
test('redeal advances the index without mutating the original; record retains origin', () => {
  const deal = dealFromSeed('abc', 1);
  expect(redeal(deal)).toEqual(dealFromSeed('abc', 2));
  expect(redeal(deal).hands).not.toEqual(deal.hands);
  expect(Object.isFrozen(deal.hands.north[0])).toBe(true);
  const table = startPlaythrough({ deal, contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
  expect(table.record().deal).toEqual(deal);
  expect(() => redeal(dealFromSeed('abc', Number.MAX_SAFE_INTEGER))).toThrow(RangeError);
});
describe('input validation', () => {
  test.each(['', 'a'.repeat(65), 'a b', '中文', 'a:b', 'a\n'])('rejects seed %s', seed => expect(() => dealFromSeed(seed, 1)).toThrow(RangeError));
  test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects index %s', index => expect(() => dealFromSeed('abc', index)).toThrow(RangeError));
});
test('dealing never calls Math.random', () => {
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Forbidden'); });
  try { expect(dealFromSeed('abc', 1).dealId).toBe(vectors[0].dealId); } finally { random.mockRestore(); }
});
