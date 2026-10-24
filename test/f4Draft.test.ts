import { describe, expect, it } from 'vitest';
import { blindSection, cardName, classify, draftDeal, render } from '../scripts/f4/draft';
import { dealFromSeed, RANKS, SEATS, SUITS, startMiniBridge } from '../src/table';
import { visibleClasses } from '../src/analysis/sampledEstimate';

// DEP-05, ADR-0001, US-18.9: real Table, policies, sampler and DDS; no full scan.
describe('F4 teacher draft', () => {
  it('classifies selection evidence without producing labels', () => {
    const m = (sampled: number, doubleDummy: number) => ({ cards: [], sampled, doubleDummy });
    expect(classify([m(5, 3), m(4.75, 4)])).toBe('correct-play-loses');
    expect(classify([m(5, 4), m(4, 3)])).toBe('clear');
    expect(classify([m(5, 4), m(4.75, 4)])).toBe('close');
    expect(classify([m(5, 4), m(4.7, 4)])).toBeNull();
  });
  it('requires sampled-best losses and a real sampled advantage, including tied best classes', () => {
    const m = (sampled: number, doubleDummy: number) => ({ cards: [], sampled, doubleDummy });
    expect(classify([m(5, 3), m(4.75, 4)])).toBe('correct-play-loses');
    expect(classify([m(5, 4), m(4.8, 3), m(4.5, 4)])).toBeNull();
    expect(classify([m(9.26, 8), m(9.44, 9), m(9.44, 9)])).toBeNull();
    expect(classify([m(5, 3), m(4.76, 4)])).toBeNull();
    expect(classify([m(5, 3), m(5, 3), m(4.5, 4)])).toBe('correct-play-loses');
    expect(classify([m(5, 3), m(5, 4), m(4.5, 4)])).toBeNull();
    expect(classify([m(5, 3), m(5, 3)])).toBe('close');
  });
  it('reproduces two seeds, legally replays keys, leaves labels blank and hides unseen cards', async () => {
    const points = [];
    for (const [seed, role] of [['f4-test-a', 'declarer'], ['f4-test-b', 'defender']] as const) {
      const first = await draftDeal(seed, 1, role, undefined, 4);
      const second = await draftDeal(seed, 1, role, undefined, 4);
      expect(first).not.toBeNull();
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      const point = first!;
      points.push(point);
      const { decision } = point;
      const setup = startMiniBridge({ deal: dealFromSeed(seed, 1), learnerSide: 'northSouth',
        targetDeclaringSide: role === 'declarer' ? 'northSouth' : 'eastWest' });
      while (setup.seatView('south').step !== 'contract-choice') setup.advance();
      const contractEntry = decision.positionKey.setup.find(e => e.kind === 'contract-choice')!;
      expect(contractEntry.kind).toBe('contract-choice');
      if (contractEntry.kind !== 'contract-choice') throw new Error('Missing contract');
      expect(setup.submit(contractEntry.seat, contractEntry.controller, contractEntry.action, contractEntry.provenance).kind).toBe('accepted');
      expect(setup.record().setupEvents).toEqual(decision.positionKey.setup);
      const table = setup.playthrough()!;
      expect(table.record().deal.dealId).toBe(decision.dealId);
      expect(table.record().deal.origin).toEqual(decision.origin);
      for (const a of decision.positionKey.actions) {
        expect(table.submit(a.seat, a.controller, a.action, a.provenance).kind).toBe('accepted');
      }
      expect(table.controllerOf(decision.seatToAct)).toBe('learner');
      const view = table.seatView(role === 'declarer' ? decision.contract.declarer : 'south');
      expect(view.turn).toBe(decision.seatToAct);
      expect(view).toEqual(point.view);
      expect(visibleClasses(view, table.legalActions(view.turn!).map(a => a.card)))
        .toEqual(decision.candidates.map(c => c.cards));
      const sheet = blindSection(view, decision, 1);
      const visibleCards = [...view.hand, ...(view.dummy ?? []), ...view.tricks.flatMap(t => t.cards.map(p => p.card)), ...view.currentTrick.map(p => p.card)].map(cardName);
      for (const suit of SUITS) for (const rank of RANKS) {
        const name = cardName({ suit, rank });
        expect(sheet.includes(name), name).toBe(visibleCards.includes(name));
      }
      const hiddenSeats = SEATS.filter(s => s !== view.seat && s !== SEATS[(SEATS.indexOf(view.contract.declarer) + 2) % 4]);
      expect(hiddenSeats.length).toBe(2);
      expect(sheet).not.toMatch(/correct-play-loses|sampled|doubleDummy|Category:/);
      expect(point.sampleCount).toBeGreaterThanOrEqual(50);
    }
    const files = render(points, 2);
    expect(files).toEqual(render(points, 2));
    for (const decision of JSON.parse(files['f4-decisions.json'])) {
      expect(decision.graders).toEqual([null, null]);
      expect(decision.resolution).toBeNull();
      expect(decision).not.toHaveProperty('category');
      expect(decision).not.toHaveProperty('metrics');
      for (const c of decision.candidates) expect(c.labels).toEqual({ teacherA: null, teacherB: null });
    }
  }, 30_000);
});
