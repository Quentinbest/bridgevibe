import { expect, test, vi } from 'vitest';
import { completedRecord, startPlaythrough, type Card } from '../table';
import { bridgeDdsEngine, positionAt, type SolverPort } from '../analysis';
import { completeFixedDeal } from '../../test/strategy';
import { createProvenanceLog, validateEntry } from './provenance';
import { trickCosts, type TrickCost } from './trickCost';

const words = (cost: number, name: string, version: string) => `X-ray view: with all cards visible. ${cost}; ${name} ${version}`;
function completed(chooseQueen = false, declarer: 'south' | 'west' = 'south') {
  const base = completeFixedDeal();
  const table = startPlaythrough({ deal: base.deal, contract: { ...base.contract, declarer }, learnerSide: 'northSouth' });
  while (table.seatView('south').turn) {
    const seat = table.seatView('south').turn!;
    const legal = table.legalActions(seat);
    const action = chooseQueen && seat === 'north' && legal[0].card.suit === 'diamonds'
      ? legal.find(a => a.card.rank === 'Q') ?? legal[0] : legal[0];
    table.submit(seat, table.controllerOf(seat), action, { kind: 'imported', format: 'pbn' });
  }
  return table.completedRecord();
}
test('US-17: costly/zero/equivalent plays, forced plays, both declaring hands and provenance', async () => {
  for (const record of [completed(), completed(true), completed(false, 'west')]) {
    const positions = record.actions.map(entry => positionAt(record, entry.index));
    const solvePosition = vi.fn<SolverPort['solvePosition']>(async layout => {
      const index = 52 - Object.values(layout).reduce((n, cards) => n + cards.length, 0);
      const legal = positions[index].legalCards;
      const equivalent = legal.filter(card => card.suit === 'diamonds' && ['K', 'Q'].includes(card.rank));
      const others = legal.filter(card => !equivalent.includes(card));
      return { ...bridgeDdsEngine, classes: [
        ...(equivalent.length ? [{ cards: equivalent, tricks: 4 }] : []),
        ...others.map(card => ({ cards: [card], tricks: 6 })),
      ] };
    });
    const log = createProvenanceLog(); const results: TrickCost[] = [];
    await trickCosts(record, { ...bridgeDdsEngine, solvePosition, solveTable: vi.fn() }, log, words, result => results.push(result));
    expect(results.some(result => result.cost === 0)).toBe(true);
    for (const result of results) {
      expect(record.actions[result.positionIndex].controller).toBe('learner');
      expect(positions[result.positionIndex].legalCards.length).toBeGreaterThan(1);
      expect(validateEntry(result.statement)).toEqual([]);
      expect(result.statement).toMatchObject({ informationMode: 'ALL_HANDS', provenance: { ...bridgeDdsEngine, sourceKind: 'engine', mode: 'ALL_HANDS', sampleCount: 0 } });
      expect(result.statement.text).toContain('with all cards visible');
    }
    expect(log.entries()).toEqual(results.map(result => result.statement));
    expect(solvePosition).toHaveBeenCalledTimes(record.actions.filter(entry => entry.controller === 'learner' && positions[entry.index].legalCards.length > 1).length);
    if (record.contract.declarer === 'south') {
      expect(new Set(results.map(result => record.actions[result.positionIndex].seat))).toEqual(new Set(['north', 'south']));
      const target = results.find(result => {
        const card: Card = record.actions[result.positionIndex].action.card;
        return record.actions[result.positionIndex].seat === 'north' && card.suit === 'diamonds' && ['K', 'Q'].includes(card.rank);
      });
      expect(target?.cost).toBe(2);
    } else expect(new Set(results.map(result => record.actions[result.positionIndex].seat))).toEqual(new Set(['south']));
  }
});
test('US-17.2: only equivalent actions remain; no badge or statement, even with several legal cards', async () => {
  const log = createProvenanceLog(); const arrive = vi.fn();
  await trickCosts(completedRecord(completeFixedDeal()), { ...bridgeDdsEngine, solveTable: vi.fn(),
    solvePosition: async layout => ({ ...bridgeDdsEngine, classes: [{ cards: layout.south, tricks: 3 }] }),
  }, log, words, arrive);
  expect(arrive).not.toHaveBeenCalled(); expect(log.entries()).toEqual([]);
});
test('US-17: a failed solve leaves no invented cost and subsequent decisions continue (#21)', async () => {
  const record = completed(); const log = createProvenanceLog(); const arrive = vi.fn();
  const solvePosition = vi.fn<SolverPort['solvePosition']>().mockRejectedValue(new Error('solver failure'));
  await trickCosts(record, { ...bridgeDdsEngine, solvePosition, solveTable: vi.fn() }, log, words, arrive);
  expect(solvePosition.mock.calls.length).toBeGreaterThan(1);
  expect(arrive).not.toHaveBeenCalled(); expect(log.entries()).toEqual([]);
});

test('US-17: the completed fixed Deal produces progressive, logged results from the real adapter', async () => {
  const { bridgeDdsAdapter } = await import('../analysis/bridgeDdsAdapter');
  const record = completedRecord(completeFixedDeal()); const log = createProvenanceLog(); const results: TrickCost[] = [];
  await trickCosts(record, bridgeDdsAdapter, log, words, cost => results.push(cost));
  expect(results.filter(result => result.positionIndex < 4)).toHaveLength(2);
  expect(results.some(result => result.cost > 0)).toBe(true);
  expect(results.every(result => validateEntry(result.statement).length === 0)).toBe(true);
  expect(results.every(result => Number.isInteger(result.cost) && result.cost >= 0)).toBe(true);
  expect(log.entries()).toHaveLength(results.length);
});
