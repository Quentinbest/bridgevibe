import { expect } from 'vitest';
import { SEATS, SUITS, RANKS, sameCard, highCardPoints, dealIdOf, type Card, type Deal, type Seat, type SeatView, type Suit } from '../../src/table';
import { partner } from './positions';

const key = (card: Card) => `${card.suit}:${card.rank}`;
const order = (a: Card, b: Card) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
export function constraints(view: SeatView) {
  const played = [...view.tricks.flatMap(t => t.cards), ...view.currentTrick];
  const fixed = new Set([...view.hand, ...(view.dummy ?? []), ...played.map(p => p.card)].map(key));
  const voids = Object.fromEntries(SEATS.map(s => [s, new Set<Suit>()])) as Record<Seat, Set<Suit>>;
  for (const trick of [...view.tricks.map(t => t.cards), view.currentTrick]) {
    for (const play of trick) if (play.card.suit !== trick[0].card.suit) voids[play.seat].add(trick[0].card.suit);
  }
  return { played, fixed, voids };
}

// CI-9: equal-HCP swaps preserve announcements; only unplayed hidden cards move.
// This is a deterministic constraint search, not a claim of uniform sampling.
export function permutations(deal: Deal, view: SeatView, seed: number): Deal[] {
  const { fixed, voids } = constraints(view);
  const hands = Object.fromEntries(SEATS.map(s => [s, [...deal.hands[s]]])) as Record<Seat, Card[]>;
  const slots = SEATS.flatMap(seat => hands[seat].flatMap((card, index) => fixed.has(key(card)) ? [] : [{ seat, index }]));
  const seen = new Set([dealIdOf(deal)]);
  const result: Deal[] = [];
  let state = seed >>> 0;
  const random = (n: number) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor(state / 2 ** 32 * n); };
  for (let tries = 0; tries < 100000 && result.length < 10; tries++) {
    const a = slots[random(slots.length)], b = slots[random(slots.length)];
    if (!a || !b || a.seat === b.seat) continue;
    const x = hands[a.seat][a.index], y = hands[b.seat][b.index];
    if (highCardPoints([x]) !== highCardPoints([y]) || voids[a.seat].has(y.suit) || voids[b.seat].has(x.suit)) continue;
    [hands[a.seat][a.index], hands[b.seat][b.index]] = [y, x];
    const next = { ...deal, hands: Object.fromEntries(SEATS.map(s => [s, [...hands[s]].sort(order)])) as unknown as Deal['hands'] };
    const id = dealIdOf(next);
    if (seen.has(id)) continue;
    seen.add(id); result.push({ ...next, dealId: id });
  }
  expect(result, `F3 needs 10 distinct permutations: ${deal.dealId}:${view.positionIndex}:${view.seat}`).toHaveLength(10);
  for (const next of result) validatePermutation(deal, next, view);
  return result;
}

export function validatePermutation(original: Deal, next: Deal, view: SeatView) {
  const { played, fixed, voids } = constraints(view);
  expect(next.dealer).toBe(original.dealer);
  expect(next.vulnerability).toEqual(original.vulnerability);
  expect(new Set(Object.values(next.hands).flat().map(key)).size).toBe(52);
  expect(Object.values(next.hands).flat().map(key).sort()).toEqual(Object.values(original.hands).flat().map(key).sort());
  for (const seat of SEATS) {
    expect(next.hands[seat]).toHaveLength(13);
    expect(highCardPoints(next.hands[seat])).toBe(highCardPoints(original.hands[seat]));
    expect(next.hands[seat].filter(c => fixed.has(key(c)))).toEqual(original.hands[seat].filter(c => fixed.has(key(c))));
    const remaining = next.hands[seat].filter(c => !played.some(p => sameCard(c, p.card)));
    expect(remaining.every(c => !voids[seat].has(c.suit))).toBe(true);
    for (const play of played.filter(p => p.seat === seat)) expect(next.hands[seat]).toContainEqual(play.card);
  }
  expect(next.hands[view.seat]).toEqual(original.hands[view.seat]);
  if (view.dummy) expect(next.hands[partner(view.contract.declarer)]).toEqual(original.hands[partner(view.contract.declarer)]);
}
