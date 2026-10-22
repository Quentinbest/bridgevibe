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
