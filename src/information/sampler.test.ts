import { expect, test } from 'vitest';
import { dealFromSeed, startPlaythrough, SEATS, SUITS, RANKS, highCardPoints, seatViewSeed, encodeSeatView, decodeSeatView, type SeatView } from '../table';
import { sampleLayouts } from './index';

function position(seed: string) {
  const deal = dealFromSeed(seed, 1);
  return startPlaythrough({ deal, contract: { level: 1, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth', gameFormat: 'minibridge',
    setupEvents: SEATS.map(seat => ({ kind: 'announcement', seat, hcp: highCardPoints(deal.hands[seat]) })) });
}
function assertSamples(view: SeatView) {
  const result = sampleLayouts(view, 3, seatViewSeed(view));
  expect('abstention' in result).toBe(false);
  if ('abstention' in result) return;
  const plays = [...view.tricks.flatMap(t => t.cards), ...view.currentTrick];
  for (const layout of result.layouts) {
    expect(layout[view.seat]).toEqual(view.hand);
    const dummy = SEATS[(SEATS.indexOf(view.contract.declarer) + 2) % 4];
    expect(layout[dummy]).toEqual(view.dummy);
    const all = [...SEATS.flatMap(s => layout[s]), ...plays.map(p => p.card)];
    expect(new Set(all.map(c => `${c.suit}:${c.rank}`)).size).toBe(52);
    for (const seat of SEATS) {
      expect(layout[seat]).toHaveLength(view.cardCounts[seat]);
      expect(highCardPoints([...layout[seat], ...plays.filter(p => p.seat === seat).map(p => p.card)])).toBe(view.announcements.find(a => a.seat === seat)!.hcp);
    }
    for (const trick of [...view.tricks.map(t => t.cards), view.currentTrick]) for (const play of trick) {
      if (play.card.suit !== trick[0].card.suit) expect(layout[play.seat].some(c => c.suit === trick[0].card.suit)).toBe(false);
    }
  }
  expect(sampleLayouts(view, 3, seatViewSeed(view))).toEqual(result);
}
// US-14.5: generated positions exercise points already played, show-outs, counts and exposed Dummy.
test('every sample respects all public constraints across many generated positions', () => {
  let checked = 0;
  for (let seed = 0; seed < 12; seed++) {
    const table = position(`hint-property-${seed}`);
    for (let i = 0; i < 48; i++) {
      if (i % 8 === 0) { assertSamples(table.seatView('south')); checked++; }
      const turn = table.seatView('south').turn!;
      table.submit(turn, table.controllerOf(turn), table.legalActions(turn)[0], { kind: 'imported', format: 'pbn' });
    }
  }
  expect(checked).toBe(72);
}, 30000);
test('enumerates every small layout and abstains on impossible constraints or exhausted tries', () => {
  const table = position('enumeration');
  for (let i = 0; i < 48; i++) { const turn = table.seatView('south').turn!; table.submit(turn, table.controllerOf(turn), table.legalActions(turn)[0], { kind: 'imported', format: 'pbn' }); }
  const view = table.seatView('south');
  expect(sampleLayouts(view, 50, seatViewSeed(view))).toMatchObject({ enumerated: true });
  const impossible = { ...encodeSeatView(view), announcements: view.announcements.map(a => ({ ...a, hcp: 40 })) };
  expect(sampleLayouts(decodeSeatView(impossible), 50, 'bad')).toEqual({ abstention: { reason: 'uncertain', cause: 'constraints' } });
  expect(sampleLayouts(position('tries').seatView('south'), 50, 'tries', 0)).toHaveProperty('abstention');
  expect(SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })))).toHaveLength(52);
});
// §4.6.7: C(8,4) = 70 unconstrained assignments; public HCP and voids leave a small set.
test('enumerates each consistent layout exactly once even when the unconstrained count exceeds fifty', () => {
  const table = position('constrained-enumeration');
  for (let i = 0; i < 36; i++) {
    const turn = table.seatView('south').turn!;
    table.submit(turn, table.controllerOf(turn), table.legalActions(turn)[0], { kind: 'imported', format: 'pbn' });
  }
  const view = table.seatView('south');
  expect(view.cardCounts.east).toBe(4); expect(view.cardCounts.west).toBe(4);
  const pool = [...table.seatView('east').hand, ...table.seatView('west').hand];
  const plays = [...view.tricks.flatMap(t => t.cards), ...view.currentTrick];
  const canonical = (east: readonly typeof pool[number][]) => east.map(c => `${c.suit}:${c.rank}`).sort().join(',');
  const expected: string[] = [];
  // An independent exhaustive oracle over all seventy combinations checks completeness, not just validity.
  for (let mask = 0; mask < 1 << pool.length; mask++) {
    const east = pool.filter((_, i) => mask & (1 << i)), west = pool.filter((_, i) => !(mask & (1 << i)));
    if (east.length !== 4) continue;
    const layout = { east, west };
    const fits = (['east', 'west'] as const).every(seat => {
      if (highCardPoints([...layout[seat], ...plays.filter(p => p.seat === seat).map(p => p.card)]) !== view.announcements.find(a => a.seat === seat)!.hcp) return false;
      return [...view.tricks.map(t => t.cards), view.currentTrick].every(trick => !trick.some(p => p.seat === seat && p.card.suit !== trick[0].card.suit)
        || layout[seat].every(c => c.suit !== trick[0].card.suit));
    });
    if (fits) expected.push(canonical(east));
  }
  expect(expected.length).toBeGreaterThan(0); expect(expected.length).toBeLessThanOrEqual(50);
  const result = sampleLayouts(view, 50, seatViewSeed(view));
  if ('abstention' in result) throw new Error('Expected complete enumeration');
  expect(result.enumerated).toBe(true);
  const actual = result.layouts.map(layout => canonical(layout.east));
  expect(actual.sort()).toEqual(expected.sort()); expect(new Set(actual).size).toBe(actual.length);
});
test('large positions still return the fixed sample count rather than enumerate', () => {
  const view = position('large-sampling').seatView('south');
  const result = sampleLayouts(view, 50, seatViewSeed(view));
  if ('abstention' in result) throw new Error('Expected samples');
  expect(result.enumerated).toBe(false); expect(result.layouts).toHaveLength(50);
});
