import { expect, test } from 'vitest';
import { dealFromSeed, SEATS, RANKS, SUITS, sameCard } from '../src/table';
import { actingHand, principlesPolicy } from '../src/robots';
import { begin, scripted, partner, positions } from './f3/positions';
import { constraints } from './f3/permute';
import { runF3, type PolicyFactory } from './f3/run';

test('US-44.1: pinned F3 coverage includes roles, trick phases and learner views', () => {
  expect(positions).toHaveLength(20);
  expect(new Set(positions.map(p => JSON.stringify(p))).size).toBe(20);
  expect(positions.filter(p => p.kind === 'hint')).toHaveLength(6);
  const coverage = new Set<string>();
  for (const p of positions) {
    const table = begin(dealFromSeed(p.seed, p.index));
    for (let i = 0; i < p.actions; i++) scripted(table);
    const view = table.seatView(p.seat);
    coverage.add(`trick:${view.currentTrick.length}`);
    coverage.add(p.actions < 16 ? 'early' : p.actions < 32 ? 'middle' : 'late');
    const role = view.turn === partner(view.contract.declarer) ? 'dummy' : p.seat === view.contract.declarer ? 'declarer' : 'defender';
    coverage.add(`${p.kind}:${role}`);
    coverage.add(`${p.kind}:${p.seat}`);
    if (Object.values(constraints(view).voids).some(v => v.size)) coverage.add('voids');
  }
  for (const required of ['trick:0', 'trick:1', 'trick:2', 'trick:3', 'early', 'middle', 'late', 'voids',
    'robot:dummy', 'robot:declarer', 'robot:defender', 'robot:east', 'robot:west',
    'hint:south', 'hint:north', 'hint:dummy', 'hint:declarer', 'hint:defender']) expect(coverage).toContain(required);
});

test('CI-9 / VAL-05: 20 × 10 compositions have identical worker/runner views and decisions', async () => {
  expect(await runF3()).toEqual([]);
}, 120000);

// US-44.1: deliberately violate ADR-0001 only in this test closure. A hidden
// seat's remaining cards select a legal action; the worker payload stays clean.
const plantedLeak: PolicyFactory = deal => ({ ...principlesPolicy, decide(view, seed, deadline) {
  const normal = principlesPolicy.decide(view, seed, deadline);
  const { fixed } = constraints(view);
  const hiddenSeat = SEATS.find(seat => seat !== view.seat && seat !== partner(view.contract.declarer))!;
  const hidden = deal.hands[hiddenSeat].filter(c => !fixed.has(`${c.suit}:${c.rank}`));
  const checksum = hidden.reduce((n, c) => n + (SUITS.indexOf(c.suit) * 13 + RANKS.indexOf(c.rank) + 1) ** 2, 0);
  const hand = actingHand(view), led = view.currentTrick[0]?.card.suit;
  const following = hand.filter(c => c.suit === led);
  const legal = following.length ? following : hand;
  return { ...normal, card: legal[checksum % legal.length] };
} });

test('US-44.1: the same 20 × 10 suite catches a planted hidden-card dependency', async () => {
  const failures = await runF3({ policy: plantedLeak });
  expect(failures.length).toBeGreaterThan(0);
  expect(failures.every(f => f.position.kind === 'robot')).toBe(true);
  for (const failure of failures) {
    expect(failure.permuted.view).toEqual(failure.original.view);
    const original = failure.original.decision as { action: { card: Parameters<typeof sameCard>[0] } };
    const permuted = failure.permuted.decision as typeof original;
    expect(sameCard(original.action.card, permuted.action.card)).toBe(false);
  }
}, 120000);
