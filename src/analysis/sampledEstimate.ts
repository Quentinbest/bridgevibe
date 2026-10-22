import { RANKS, SUITS, sameCard, seatViewSeed, type Card, type SeatView } from '../table';
import { sampleLayouts } from '../information';
import type { SolverPort } from './index';

import { unavailable, type HintResult } from './hintResult';
export { unavailable, type HintResult } from './hintResult';
// US-14.5, GLOSSARY Equivalent Actions: hidden ranks, ranks in another visible hand and cards on the
// current trick (which can still win it) separate classes; only completed tricks join ranks.
export function visibleClasses(view: SeatView, candidates: readonly Card[]): Card[][] {
  const own = view.turn === view.seat ? view.hand : view.dummy ?? [];
  const played = view.tricks.flatMap(t => t.cards).map(p => p.card);
  const available = [...own, ...played];
  const groups: Card[][] = [];
  for (const suit of SUITS) {
    let group: Card[] | undefined;
    for (const rank of RANKS) {
      const card = { suit, rank };
      if (!available.some(c => sameCard(c, card))) group = undefined;
      if (candidates.some(c => sameCard(c, card))) {
        if (!group) { group = []; groups.push(group); }
        group.push(card);
      }
    }
  }
  return groups;
}
const lowest = (cards: readonly Card[]) => cards.reduce((a, b) => RANKS.indexOf(a.rank) > RANKS.indexOf(b.rank) ? a : b);
// §4.6.7: fixed-count averages only; deadlines never publish partial work.
export async function sampledEstimate(solver: SolverPort, view: SeatView, candidates: readonly Card[], count: number, seed: string, deadline: number, now = Date.now): Promise<HintResult> {
  try {
    if (now() >= deadline) return unavailable('timeout');
    const samples = sampleLayouts(view, count, `${seatViewSeed(view)}:${seed}`);
    if (now() >= deadline) return unavailable('timeout');
    if ('abstention' in samples) return { ...samples, sampleCount: 0, enumerated: false };
    const classes = visibleClasses(view, candidates).map(cards => ({ cards, tricks: 0 }));
    if (!classes.length || !view.turn) return unavailable();
    for (const layout of samples.layouts) {
      if (now() >= deadline) return unavailable('timeout');
      const result = await solver.solvePosition(layout, { strain: view.contract.strain, leader: view.currentTrick[0]?.seat ?? view.turn, currentTrick: view.currentTrick });
      if (now() >= deadline) return unavailable('timeout');
      for (const group of classes) {
        const score = result.classes.find(c => c.cards.some(card => sameCard(card, group.cards[0])));
        if (!score || !Number.isFinite(score.tricks)) return unavailable();
        group.tricks += score.tricks;
      }
    }
    for (const group of classes) group.tricks /= samples.layouts.length;
    classes.sort((a, b) => b.tricks - a.tricks || RANKS.indexOf(lowest(b.cards).rank) - RANKS.indexOf(lowest(a.cards).rank) || SUITS.indexOf(a.cards[0].suit) - SUITS.indexOf(b.cards[0].suit));
    return { classes, sampleCount: samples.layouts.length, enumerated: samples.enumerated };
  } catch { return unavailable(); }
}
