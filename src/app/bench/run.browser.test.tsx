import { expect, test } from 'vitest';
import { runBench } from './run';
import { exportReport, newReport, recoverReport, tinyConfiguration, validReport } from './report';

test('US-43: real solver and robot workers complete two F2 positions and two seeded MiniBridge Deals', async () => {
  const report = newReport('Chromium verification', 'desktop; warm-cache', tinyConfiguration);
  const checkpoints: string[] = [];
  // NFR-P1 loads ?lesson=follow-suit in an iframe; inside the Vitest runner that URL is the runner, not the app,
  // so P1 is a stand-in here. The real path is exercised on the internal build (?bench=1) and on the phones.
  await runBench(report, ['bridge-dds'], new AbortController().signal, () => {}, { setItem: (_key, json) => checkpoints.push(json) },
    async () => 1);
  const json = JSON.parse(exportReport(report));
  expect(validReport(json)).toBe(true);
  const candidate = report.candidates[0];
  expect(candidate.errors).toEqual([]);
  expect(candidate.status).toBe('complete');
  expect(candidate.completedDeals).toBe(2);
  expect(candidate.P1.count).toBe(1); expect(candidate.P1.max).toBeGreaterThan(0);
  expect(candidate.P2.count).toBe(2); expect(candidate.P2.max).toBeGreaterThan(0);
  expect(candidate.P3.count).toBe(1); expect(candidate.P3.max).toBeGreaterThan(0);
  expect(candidate.P4.count).toBe(106); expect(candidate.P4.max).toBeGreaterThan(0);
  expect(candidate.perLayoutMs.count).toBe(2); expect(candidate.layoutSamples).toBeGreaterThanOrEqual(2);
  expect(candidate.P5.status).toBe('measured'); expect(candidate.P5.longestMs).toBeGreaterThanOrEqual(0);
  expect(candidate.P6.crashes).toEqual([]); expect(candidate.P6.interruption).toBe(false);
  expect(candidate.P6.status === 'unsupported' ? candidate.P6.peakBytes === null : candidate.P6.peakBytes! > 0).toBe(true);
  expect(candidate.fallbacks.deals).toBe(2); expect(candidate.fallbacks.timeoutDealShare).toBeGreaterThanOrEqual(0);
  expect(candidate.fallbacks.timeoutDealShare).toBeLessThanOrEqual(1);
  expect(candidate.policyFallbacks).toHaveLength(2);
  expect(checkpoints.some(value => recoverReport(value)?.candidates[0].status === 'interrupted')).toBe(true);
  expect(JSON.parse(checkpoints.at(-1)!)).toEqual(json);
}, 120000);
