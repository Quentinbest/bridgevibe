import { expect, test } from 'vitest';
import { createProvenanceLog, validateEntry, type LogEntry, type Provenance } from './provenance';
const sources: Provenance[] = [
  { sourceKind: 'authored', contentId: 'lesson-1', version: '1' },
  { sourceKind: 'bidding-rule', ruleId: 'open-1nt', profileVersion: '1' },
  { sourceKind: 'engine', name: 'solver', version: '1', mode: 'VISIBLE', sampleCount: 50 },
  { sourceKind: 'template', templateId: 'reason.not-your-turn' },
  { sourceKind: 'table', rulesCoreVersion: '1' },
  { sourceKind: 'table', reasonCode: 'not-your-turn' },
  { sourceKind: 'robot', kind: 'robot', policy: 'bv-basic', version: '1', durationMs: 10 },
];
function entry(provenance = sources[0]): LogEntry {
  return { id: 'entry-1', playthroughId: 'playthrough-1', positionIndex: 0,
    kind: provenance.sourceKind === 'robot' ? 'robot-action' : 'statement', summary: 'test', text: 'Rendered statement',
    informationMode: 'VISIBLE', provenance, at: '2026-10-20T00:00:00.000Z' };
}
for (const provenance of sources) test(`US-40.1: ${JSON.stringify(provenance)} requires every source field`, () => {
  expect(validateEntry(entry(provenance))).toEqual([]);
  for (const key of Object.keys(provenance)) {
    const incomplete: Record<string, unknown> = { ...provenance }; delete incomplete[key];
    expect(validateEntry({ ...entry(provenance), provenance: incomplete })).not.toEqual([]);
  }
});
test('US-40.1: common fields, kinds, numeric fields and modes are checked', () => {
  for (const key of Object.keys(entry())) {
    const incomplete: Record<string, unknown> = { ...entry() }; delete incomplete[key];
    expect(validateEntry(incomplete), key).not.toEqual([]);
  }
  for (const bad of [null, [], { ...entry(), informationMode: 'RULE' }, { ...entry(), positionIndex: -1 },
    { ...entry(), kind: 'hint' }, { ...entry(), at: 'yesterday' }, { ...entry(), provenance: { sourceKind: 'unknown' } },
    entry({ ...sources[2], sampleCount: NaN } as Provenance),
    entry({ ...sources[6], durationMs: -1 } as Provenance),
    { ...entry(sources[6]), kind: 'statement' }]) expect(validateEntry(bad)).not.toEqual([]);
  expect(validateEntry({ ...entry(sources[2]), informationMode: 'ALL_HANDS' })).not.toEqual([]);
  expect(validateEntry(entry({ sourceKind: 'engine', name: 'solver', version: '1', sampleCount: 0, mode: 'ALL_HANDS' })).length).toBeGreaterThan(0);
  expect(validateEntry({ ...entry(), informationMode: 'ALL_HANDS' })).toEqual([]);
});
test('US-40.1–3: recording rejects incomplete entries and exports isolated F5 grading documents', () => {
  const log = createProvenanceLog('1.2.3');
  expect(() => log.record({ ...entry(), summary: '' })).toThrow('Incomplete provenance');
  expect(log.entries()).toEqual([]);
  const original = entry(); log.record(original);
  original.summary = 'changed'; log.entries()[0].summary = 'changed';
  const exported = log.export();
  expect(exported).toEqual({ schemaVersion: 1, format: 'bridgevibe-f5', appVersion: '1.2.3', exportedAt: expect.any(String),
    entries: [{ ...entry(), grade: null, graderNote: null }] });
  expect(Number.isFinite(Date.parse(exported.exportedAt))).toBe(true);
  exported.entries[0].summary = 'changed'; expect(log.entries()).toEqual([entry()]);
  expect(() => log.record(entry())).toThrow('Duplicate');
});
test('CI-5: only unmarked fallback actions increment the silent counter', () => {
  const log = createProvenanceLog();
  for (const [index, fallback] of [undefined, 'timeout', 'engine-failure'].entries()) {
    log.record({ ...entry({ sourceKind: 'robot', kind: 'robot', policy: 'bv-fallback', version: '1', durationMs: 1,
      fallback: fallback as 'timeout' | 'engine-failure' | undefined }), id: `${index}` });
  }
  log.hiddenCardFound();
  expect(log.counters()).toEqual({ hiddenCardsInVisibleInputs: 1, silentFallbacks: 1 });
  expect(createProvenanceLog().counters()).toEqual({ hiddenCardsInVisibleInputs: 0, silentFallbacks: 0 });
});

test('§4.3.3, CI-5: robot rule IDs are optional, nonempty when present, and retained in the log', () => {
  const provenance = { sourceKind: 'robot', kind: 'robot', policy: 'bv-contract-placeholder', version: '0',
    ruleId: 'placeholder-dep-02', durationMs: 1 } as const;
  expect(validateEntry(entry(provenance))).toEqual([]);
  for (const ruleId of ['', ' ', 42, null]) {
    expect(validateEntry({ ...entry(provenance), provenance: { ...provenance, ruleId } })).toContain('provenance.ruleId');
  }
  const log = createProvenanceLog(); log.record(entry(provenance));
  expect(log.entries()[0].provenance).toEqual(provenance);
});
