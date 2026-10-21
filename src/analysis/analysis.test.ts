import { expect, test, vi } from 'vitest';
import { completedRecord, SEATS, SUITS, type CompletedPlaythroughRecord } from '../table';
import { completeFixedDeal, fixedPlaythrough } from '../../test/strategy';
import { bridgeDdsAdapter } from './bridgeDdsAdapter';
import { bridgeDdsEngine, doubleDummy, positionAt, type Layout } from './index';

const layout: Layout = {
  north: [{ suit: 'spades', rank: 'A' }, { suit: 'spades', rank: 'K' }],
  east: [{ suit: 'spades', rank: 'Q' }, { suit: 'spades', rank: 'J' }],
  south: [{ suit: 'spades', rank: '10' }, { suit: 'spades', rank: '9' }],
  west: [{ suit: 'spades', rank: '8' }, { suit: 'spades', rank: '7' }],
};
test('§4.3.2: the adapter groups equivalent cards and scores the side to act, including mid-trick', async () => {
  for (const strain of [...SUITS, 'no-trumps' as const]) {
    const lead = await bridgeDdsAdapter.solvePosition(layout, { strain, leader: 'north', currentTrick: [] });
    expect(lead).toEqual({ ...bridgeDdsEngine, classes: [{ cards: layout.north, tricks: 2 }] });
    for (let count = 1; count <= 3; count++) {
      const currentTrick = SEATS.slice(0, count).map(seat => ({ seat, card: layout[seat][0] }));
      const remaining = { ...layout };
      for (const seat of SEATS.slice(0, count)) remaining[seat] = layout[seat].slice(1);
      const result = await bridgeDdsAdapter.solvePosition(remaining, { strain, leader: 'north', currentTrick });
      expect(result).toEqual({ ...bridgeDdsEngine, classes: [{ cards: layout[SEATS[count]], tricks: count % 2 ? 0 : 2 }] });
    }
  }
});
test('§4.3.2: solve table has five strains, four declarers and engine provenance', async () => {
  const record = completedRecord(completeFixedDeal());
  const result = await bridgeDdsAdapter.solveTable(record.deal.hands);
  expect(result).toMatchObject(bridgeDdsEngine);
  expect(result.table).toHaveLength(5);
  for (const [s, strain] of [...SUITS, 'no-trumps' as const].entries()) {
    expect(result.table[s]).toHaveLength(4);
    for (const [d, declarer] of SEATS.entries()) {
      const lead = await bridgeDdsAdapter.solvePosition(record.deal.hands, { strain, leader: SEATS[(d + 1) % 4], currentTrick: [] });
      expect(13 - Math.max(...lead.classes.map(group => group.tricks)), declarer).toBe(result.table[s][d]);
    }
  }
}, 30000);
test('ADR-0001: double-dummy refuses a live record at type and runtime boundaries', () => {
  const solver = { ...bridgeDdsAdapter, solvePosition: vi.fn() };
  const live = fixedPlaythrough();
  // @ts-expect-error ADR-0001: a live record lacks the completion capability.
  expect(() => doubleDummy(solver, live.record(), 0)).toThrow(/completed/);
  expect(solver.solvePosition).not.toHaveBeenCalled();
  const record: CompletedPlaythroughRecord = completedRecord(completeFixedDeal());
  expect(positionAt(record, 1).position.currentTrick).toEqual([{ seat: record.actions[0].seat, card: record.actions[0].action.card }]);
  for (const index of [-1, 52, 0.5]) expect(() => positionAt(record, index)).toThrow(/index/);
});
