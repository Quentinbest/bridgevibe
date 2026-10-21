import { afterEach, expect, test, vi } from 'vitest';
import { completedRecord } from '../table';
import { completeFixedDeal } from '../../test/strategy';
import { positionAt } from '../analysis';
import { analysisClient } from './analysisClient';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
test('§4.7 / #21: worker requests contain completed records; a stalled worker is terminated and cannot hang later solves', async () => {
  vi.useFakeTimers();
  const postMessage = vi.fn(); const terminate = vi.fn();
  vi.stubGlobal('Worker', class { postMessage = postMessage; terminate = terminate; });
  const record = completedRecord(completeFixedDeal()); const client = analysisClient(record);
  const { layout, position } = positionAt(record, 1);
  client.at(1);
  const pending = client.solver.solvePosition(layout, position);
  const failed = expect(pending).rejects.toThrow('AnalysisTimeout');
  expect(postMessage).toHaveBeenCalledWith({ record, index: 1 });
  await vi.advanceTimersByTimeAsync(30000); await failed;
  expect(terminate).toHaveBeenCalledOnce();
  await expect(client.solver.solvePosition(layout, position)).rejects.toThrow('AnalysisUnavailable');
  expect(postMessage).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
