import { afterEach, expect, test, vi } from 'vitest';
import { completeFixedDeal } from '../../test/strategy';
import { completedRecord } from '../table';
import { createAnalysisHost } from './analysisHost';
import { createProvenanceLog } from '../coach/provenance';
import { configuredEngine, loadConfiguredSolver } from '../analysis/solverSelection';

afterEach(() => vi.unstubAllEnvs());

// US-41.1–2: the same host keys caches and reports failures using configuration alone.
test('switching VITE_SOLVER changes adapter identity, cache and failure provenance', async () => {
  const record = completedRecord(completeFixedDeal());
  const createClient = vi.fn(() => { throw new Error('AnalysisWorkerCrash'); });
  const host = createAnalysisHost(createClient);
  for (const value of ['bridge-dds', 'macroxue']) {
    vi.stubEnv('VITE_SOLVER', value);
    expect(host.snapshot(record).abstention).toBeUndefined();
    expect(await loadConfiguredSolver()).toMatchObject(configuredEngine());
    const log = createProvenanceLog();
    host.start(record, log);
    await vi.waitFor(() => expect(host.snapshot(record).abstention).toBeDefined());
    expect(host.snapshot(record).abstention?.provenance).toMatchObject(configuredEngine());
    host.start(record, log);
  }
  expect(createClient).toHaveBeenCalledTimes(2);
});

test('the default remains bridge-dds and unknown configuration fails', () => {
  vi.stubEnv('VITE_SOLVER', undefined);
  expect(configuredEngine().name).toBe('bridge-dds');
  vi.stubEnv('VITE_SOLVER', 'unknown');
  expect(() => configuredEngine()).toThrow('Invalid VITE_SOLVER');
});
