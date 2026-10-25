import { expect, test, vi } from 'vitest';
import { createHints } from './hints';
import { startPlaythrough, seatViewSeed } from '../table';
import { fixedDeal } from './fixture';
import { validateEntry, type LogEntry } from '../coach/provenance';

test('US-18.8: tier (c) snapshot and shown provenance retain the advised class at its position', () => {
  const table = startPlaythrough({ deal: fixedDeal, contract: { level: 1, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
  const view = table.seatView('west');
  const candidates = table.legalActions('west').map(a => a.card);
  const advisedClass = candidates.slice(0, 2);
  const entries: LogEntry[] = [];
  const hints = createHints(vi.fn(), (entry, positionIndex) => entries.push({ ...entry, positionIndex, id: 'hint', playthroughId: 'test', informationMode: 'VISIBLE', at: new Date().toISOString() }),
    (_view, _cards, done) => {
      done({ classes: [{ cards: advisedClass, tricks: 5 }], sampleCount: 50, enumerated: false }, 10);
      return () => {};
    });
  hints.sync(view, candidates, { playthroughId: 'test', positionKey: seatViewSeed(view) });
  expect(hints.snapshot()).toMatchObject({ advisedClass, positionIndex: 0 });
  expect(entries).toHaveLength(0);
  hints.show(); hints.show();
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ positionIndex: 0, summary: 'hint.advice', provenance: { hint: { advisedClass } } });
  expect(validateEntry(entries[0])).toEqual([]);
  const invalid = structuredClone(entries[0]);
  if (invalid.provenance.sourceKind === 'engine') delete invalid.provenance.hint!.advisedClass;
  expect(validateEntry(invalid)).toContain('provenance.advisedClass');
  hints.sync(null, [], null);
  expect(hints.snapshot().advisedClass).toBeUndefined();
});
