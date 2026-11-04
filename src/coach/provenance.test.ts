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
test('CI-4 / VAL-06: abstentions require valid cause and engine provenance; only their failure is accounted for', () => {
  const log = createProvenanceLog();
  const abstention: LogEntry = { ...entry(sources[2]), abstention: { reason: 'unavailable', cause: 'timeout' } };
  expect(validateEntry(abstention)).toEqual([]);
  for (const invalid of [{ reason: 'uncertain', cause: 'timeout' }, { reason: 'unavailable' }, { cause: 'error' }, { reason: 'unavailable', cause: 'connection' }, null]) {
    expect(validateEntry({ ...abstention, abstention: invalid })).toContain('abstention');
  }
  expect(validateEntry({ ...abstention, provenance: sources[0] })).toContain('abstention.provenance');
  log.analysisFailed(abstention.id); log.analysisFailed('unanswered');
  expect(log.counters().silentFallbacks).toBe(2);
  expect(() => log.record({ ...abstention, text: '' })).toThrow();
  expect(log.counters().silentFallbacks).toBe(2);
  log.record(abstention);
  expect(log.counters().silentFallbacks).toBe(1);
});

test('INV-7: a not-covered hint template must carry its not-covered abstention', () => {
  const notCovered = { ...entry({ sourceKind: 'template', templateId: 'hint.not-covered' } as Provenance), summary: 'hint.not-covered' };
  expect(validateEntry(notCovered)).toContain('abstention.not-covered');
  expect(validateEntry({ ...notCovered, abstention: { reason: 'not-covered', cause: 'no-authored-hint' } })).toEqual([]);
});

test('INV-7: only the not-covered template may carry a not-covered abstention', () => {
  const forced = { ...entry({ sourceKind: 'template', templateId: 'hint.forced-card' } as Provenance), summary: 'hint.forced-card',
    abstention: { reason: 'not-covered' as const, cause: 'no-authored-hint' as const } };
  expect(validateEntry(forced)).toContain('abstention.provenance');
});

test('US-14.11: an engine-backed entry can never be recorded as not covered', () => {
  const engine = { ...entry({ sourceKind: 'engine', name: 'test', version: '1', mode: 'VISIBLE', sampleCount: 50,
    hint: { sampler: 'bv-layout', samplerVersion: '1', enumerated: false, templateId: 'hint.advice', durationMs: 1, exceededTarget: false } } as Provenance),
    summary: 'hint.advice', abstention: { reason: 'not-covered' as const, cause: 'no-authored-hint' as const } };
  expect(validateEntry(engine)).toContain('abstention.provenance');
  expect(validateEntry({ ...engine, abstention: { reason: 'unavailable', cause: 'timeout' } })).not.toContain('abstention.provenance');
});

test('US-14.11: forced-play templates are never recorded with engine provenance', () => {
  for (const summary of ['hint.forced-card', 'hint.forced-class']) {
    const engine = { ...entry({ sourceKind: 'engine', name: 'test', version: '1', mode: 'VISIBLE', sampleCount: 50,
      hint: { sampler: 'bv-layout', samplerVersion: '1', enumerated: false, templateId: summary, durationMs: 1, exceededTarget: false } } as Provenance), summary };
    expect(validateEntry(engine)).toContain('provenance.template');
  }
});

test('I18N-20: optional stamps are paired nonempty strings and never belong to robot actions', () => {
  for (const stamp of [{ locale: 'en' }, { catalogueVersion: 'abc' }, { locale: '', catalogueVersion: 'abc' },
    { locale: 'en', catalogueVersion: ' ' }, { locale: 42, catalogueVersion: 'abc' }, { locale: undefined }]) {
    expect(validateEntry({ ...entry(), ...stamp }).length).toBeGreaterThan(0);
  }
  expect(validateEntry({ ...entry(), locale: 'en', catalogueVersion: 'abc' })).toEqual([]);
  expect(validateEntry({ ...entry(sources[6]), locale: 'en', catalogueVersion: 'abc' })).toContain('locale.kind');
});
test('E-16, E-17: stamps text at record time, leaves robots untouched and rejects a conflicting locale', () => {
  const stamp = { locale: 'en', catalogueVersion: '0123456789ab' };
  const log = createProvenanceLog('test', () => stamp);
  const original = entry();
  log.record(original);
  expect(original.locale).toBeUndefined();
  expect(log.entries()[0]).toEqual({ ...original, ...stamp });
  const robot = { ...entry(sources[6]), id: 'robot', text: undefined };
  log.record(robot);
  expect(log.entries()[1]).toEqual(robot);
  expect(log.entries()[1]).not.toHaveProperty('locale');
  expect(log.entries()[1]).not.toHaveProperty('catalogueVersion');
  expect(() => log.record({ ...entry(), id: 'conflict', locale: 'es' })).toThrow('locale mismatch');
  expect(log.entries()).toHaveLength(2);
  const unstamped = createProvenanceLog(); unstamped.record(original);
  expect(unstamped.entries()).toEqual([original]);
  expect(() => createProvenanceLog('test', () => ({ locale: '', catalogueVersion: '' })).record(original)).toThrow('Incomplete provenance');
});
