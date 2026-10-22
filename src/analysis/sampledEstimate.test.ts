import { expect, test, vi } from 'vitest';
import { dealFromSeed, decodeSeatView, startPlaythrough, sameCard, RANKS, SUITS, type Card } from '../table';
import { sampledEstimate, visibleClasses } from './sampledEstimate';
import type { SolverPort } from './index';
const table = () => startPlaythrough({ deal: dealFromSeed('estimator', 1), contract: { level: 1, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
const solver: SolverPort = { name: 'test', version: '1', solveTable: vi.fn(), solvePosition: async layout => ({ name: 'test', version: '1', classes: Object.values(layout).flat().map(card => ({ cards: [card], tricks: 3 })) }) };
test('fixed samples are deterministic and tied classes use lowest rank then SUITS order', async () => {
  const view = table().seatView('west');
  const estimate = () => sampledEstimate(solver, view, view.hand, 3, 'fixed', Infinity);
  const first = await estimate(); expect(await estimate()).toEqual(first);
  expect(first).toHaveProperty('sampleCount', 3);
  if ('abstention' in first) throw new Error('unexpected abstention');
  const lowest = (cards: readonly Card[]) => Math.min(...cards.map(c => c.rank === 'A' ? 14 : c.rank === 'K' ? 13 : c.rank === 'Q' ? 12 : c.rank === 'J' ? 11 : Number(c.rank)));
  const expected = [...view.hand].sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit))[0];
  expect(first.classes[0].cards).toContainEqual(expected);
  expect(lowest(first.classes[0].cards)).toBe(Math.min(...first.classes.map(c => lowest(c.cards))));
});
test('deadline and failure abstain without a partial average', async () => {
  const view = table().seatView('west');
  expect(await sampledEstimate(solver, view, view.hand, 3, 'fixed', 0)).toHaveProperty('abstention.cause', 'timeout');
  let clock = 0;
  const slow = { ...solver, solvePosition: async (...args: Parameters<SolverPort['solvePosition']>) => { clock += 10; return solver.solvePosition(...args); } };
  expect(await sampledEstimate(slow, view, view.hand, 3, 'fixed', 15, () => clock)).toMatchObject({ abstention: { cause: 'timeout' }, sampleCount: 0 });
  expect(await sampledEstimate({ ...solver, solvePosition: async () => { throw new Error('fault'); } }, view, view.hand, 3, 'fixed', Infinity)).toHaveProperty('abstention.cause', 'error');
});
test('visible equivalence joins only ranks held or played, never hidden or in another visible hand', () => {
  const t = table();
  for (let i = 0; i < 20; i++) {
    const view = t.seatView(t.seatView('south').turn!);
    const groups = visibleClasses(view, view.hand);
    for (const a of view.hand) for (const b of view.hand) {
      if (a.suit !== b.suit) continue;
      const ranks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
      const between = ranks.slice(Math.min(ranks.indexOf(a.rank), ranks.indexOf(b.rank)) + 1, Math.max(ranks.indexOf(a.rank), ranks.indexOf(b.rank)));
      const allowed = [...view.hand, ...view.tricks.flatMap(t => t.cards.map(p => p.card))];
      const equivalent = between.every(rank => allowed.some(c => c.suit === a.suit && c.rank === rank));
      expect(groups.some(g => g.some(c => sameCard(c, a)) && g.some(c => sameCard(c, b)))).toBe(equivalent);
    }
    const seat = view.turn!; t.submit(seat, t.controllerOf(seat), t.legalActions(seat)[0], { kind: 'imported', format: 'pbn' });
  }
});
test('a card on the current trick separates ranks: K and J stay apart with Q led', () => {
  // Cross-review repro: DDS scores K and J differently here, so merging them would recommend the wrong card.
  const spade = (rank: Card['rank']): Card => ({ suit: 'spades', rank });
  const view = decodeSeatView({ seat: 'south', positionIndex: 1, hand: [spade('K'), spade('J')], dummy: null, announcements: [],
    contract: { level: 1, strain: 'no-trumps', declarer: 'north' }, tricks: [], currentTrick: [{ seat: 'east', card: spade('Q') }],
    turn: 'south', tricksWon: { northSouth: 0, eastWest: 0 }, cardCounts: { north: 2, east: 1, south: 2, west: 2 }, status: 'in-progress' });
  expect(visibleClasses(view, view.hand)).toEqual([[spade('K')], [spade('J')]]);
});
