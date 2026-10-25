// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { exportReport, fallbackRates, newReport, recoverReport, stats, tinyConfiguration, validReport } from './report';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  vi.stubGlobal('crossOriginIsolated', false); vi.stubGlobal('isSecureContext', true);
  return newReport('Pixel 9', 'Fast 4G; cache disabled manually', tinyConfiguration);
}
test('nearest-rank percentiles preserve input and distinguish missing observations', () => {
  const input = [4, 1, 3, 2];
  expect(stats(input)).toEqual({ count: 4, p50: 2, p95: 4, max: 4 });
  expect(input).toEqual([4, 1, 3, 2]);
  expect(stats(Array.from({ length: 100 }, (_, i) => i + 1))).toEqual({ count: 100, p50: 50, p95: 95, max: 100 });
  expect(stats([])).toEqual({ count: 0, p50: null, p95: null, max: null });
  expect(stats([0])).toEqual({ count: 1, p50: 0, p95: 0, max: 0 });
  for (const invalid of [-1, NaN, Infinity]) expect(() => stats([invalid])).toThrow();
});
test('US-12.3 / US-43.2: count Deals, exclude hidden fallbacks of both kinds', () => {
  expect(fallbackRates([
    [{ reason: 'timeout', hidden: false }, { reason: 'timeout', hidden: false }, { reason: 'engine-failure', hidden: false }],
    [{ reason: 'timeout', hidden: true }, { reason: 'engine-failure', hidden: true }], [],
  ])).toEqual({ deals: 3, timeoutDeals: 1, timeoutDealShare: 1 / 3, engineFailureFallbacks: 1, excludedHiddenFallbacks: 2 });
  expect(fallbackRates([]).timeoutDealShare).toBeNull();
});
test('versioned export includes unavailable candidates and unsupported measurements honestly', () => {
  const report = fixture();
  expect(validReport(JSON.parse(exportReport(report)))).toBe(true);
  expect(report.candidates[3].status).toBe('not-available (#82)');
  expect(report.candidates[4].status).toBe('not-integrated');
  expect(report.candidates[0].P5.longestMs).toBeNull();
  expect(report.candidates[0].P6.peakBytes).toBeNull();
});
test('schema rejects missing fields, nonfinite numbers, inconsistent rates and fabricated unsupported zeroes', () => {
  for (const mutate of [
    (r: Record<string, unknown>) => { delete r.device; },
    (r: Record<string, unknown>) => { r.schemaVersion = 2; },
  ]) { const report = fixture(); mutate(report); expect(validReport(report)).toBe(false); }
  const badStats = fixture(); badStats.candidates[0].P2 = { count: 1, p50: NaN, p95: 2, max: 1 };
  expect(() => exportReport(badStats)).toThrow();
  const badZero = fixture(); badZero.candidates[0].P5.longestMs = 0; expect(validReport(badZero)).toBe(false);
  const badRate = fixture(); badRate.candidates[0].fallbacks.timeoutDealShare = .5; expect(validReport(badRate)).toBe(false);
  const duplicate = fixture(); duplicate.candidates[1].id = duplicate.candidates[0].id; expect(validReport(duplicate)).toBe(false);
});
test('NFR-P6: reload recovers unfinished progress as an interruption, not a confirmed crash', () => {
  const report = fixture(); report.candidates[0].status = 'running'; report.candidates[0].progress = 'F7:27/100';
  const recovered = recoverReport(exportReport(report))!;
  expect(recovered.candidates[0]).toMatchObject({ status: 'interrupted', progress: 'F7:27/100', P6: { interruption: true, crashes: [] } });
  expect(validReport(recovered)).toBe(true);
  expect(recoverReport(exportReport(recovered))).toEqual(recovered);
  expect(recoverReport('broken')).toBeNull(); expect(recoverReport(null)).toBeNull();
});
