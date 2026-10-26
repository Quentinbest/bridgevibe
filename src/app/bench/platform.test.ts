// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { monitor, visibility, visible } from './platform';
import { newReport, tinyConfiguration } from './report';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
test('US-43.2: a hidden interval remains excluded after returning to foreground', async () => {
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const state = visibility(), stamp = state.stamp();
  expect(state.hiddenSince(stamp)).toBe(false);
  hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
  let resumed = false;
  const wait = visible(new AbortController().signal).then(() => { resumed = true; });
  await Promise.resolve(); expect(resumed).toBe(false);
  hidden.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange')); await wait;
  expect(state.hiddenSince(stamp)).toBe(true);
  expect(state.hiddenSince(state.stamp())).toBe(false);
  state.stop();
});
test('hidden wait can be cancelled without leaving a pending run', async () => {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  const controller = new AbortController();
  const wait = visible(controller.signal); controller.abort();
  await expect(wait).rejects.toThrow('cancelled');
});
test('Safari-like unsupported APIs remain unsupported; JS heap samples retain their maximum', () => {
  vi.useFakeTimers(); vi.stubGlobal('PerformanceObserver', undefined);
  vi.stubGlobal('performance', {});
  const candidate = newReport('', '', tinyConfiguration).candidates[0];
  const stop = monitor(candidate); vi.advanceTimersByTime(2000); stop();
  expect(candidate.P5).toMatchObject({ status: 'unsupported', longestMs: null });
  expect(candidate.P6).toMatchObject({ status: 'unsupported', peakBytes: null });
  const memory = { usedJSHeapSize: 100 };
  vi.stubGlobal('performance', { memory });
  const stopHeap = monitor(candidate);
  memory.usedJSHeapSize = 300; vi.advanceTimersByTime(1000);
  memory.usedJSHeapSize = 200; stopHeap();
  expect(candidate.P6).toMatchObject({ status: 'measured', peakBytes: 300, method: 'performance.memory-main-JS-heap' });
});
