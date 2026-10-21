import { afterEach, expect, test, vi } from 'vitest';
import { completedRecord } from '../table';
import { completeFixedDeal } from '../../test/strategy';
import { positionAt } from '../analysis';
import { analysisClient, type AnalysisWorker } from './analysisClient';
import { ANALYSIS_PROTOCOL_VERSION, type AnalysisRequest, type AnalysisResponse } from './analysisProtocol';

afterEach(() => { vi.useRealTimers(); });
class FakeWorker implements AnalysisWorker {
  onmessage: AnalysisWorker['onmessage'] = null;
  onerror: AnalysisWorker['onerror'] = null;
  posted: AnalysisRequest[] = [];
  terminated = false;
  constructor(version: number | null = ANALYSIS_PROTOCOL_VERSION) {
    if (version !== null) queueMicrotask(() => this.emit({ type: 'hello', protocolVersion: version }));
  }
  postMessage(message: AnalysisRequest) { this.posted.push(message); }
  terminate() { this.terminated = true; }
  emit(data: AnalysisResponse) { this.onmessage?.({ data } as MessageEvent<AnalysisResponse>); }
}
const record = completedRecord(completeFixedDeal());
const { layout, position } = positionAt(record, 1);

test('§4.7 / #21: requests carry the completed record; a stalled worker is terminated and cannot hang later solves', async () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  const client = analysisClient(record, () => { const worker = new FakeWorker(); workers.push(worker); return worker; });
  client.at(1);
  const pending = client.solver.solvePosition(layout, position);
  const failed = expect(pending).rejects.toThrow('AnalysisTimeout');
  await vi.advanceTimersByTimeAsync(0);
  expect(workers[0].posted).toEqual([{ type: 'solve', requestId: 1, record, index: 1 }]);
  await vi.advanceTimersByTimeAsync(30000); await failed;
  expect(workers[0].terminated).toBe(true);
  await expect(client.solver.solvePosition(layout, position)).rejects.toThrow('AnalysisUnavailable');
  expect(workers).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});
test('§4.3.6: only the response with the request ID resolves the solve', async () => {
  const worker = new FakeWorker();
  const client = analysisClient(record, () => worker);
  const pending = client.solver.solvePosition(layout, position);
  await Promise.resolve(); await Promise.resolve();
  const result = { name: 'bridge-dds', version: '1.4.0', classes: [] };
  worker.emit({ type: 'result', requestId: 99, result: { ...result, version: 'stale' } });
  worker.emit({ type: 'result', requestId: worker.posted[0].requestId, result });
  await expect(pending).resolves.toEqual(result);
});
test('US-41.3: a worker with another protocol version is reloaded before any request, then given up', async () => {
  const mismatched: FakeWorker[] = [];
  const reloaded = analysisClient(record, () => { const worker = new FakeWorker(mismatched.length ? ANALYSIS_PROTOCOL_VERSION : 999); mismatched.push(worker); return worker; });
  const pending = reloaded.solver.solvePosition(layout, position);
  await vi.waitFor(() => expect(mismatched[1]?.posted).toHaveLength(1));
  expect(mismatched[0].terminated).toBe(true);
  expect(mismatched[0].posted).toEqual([]);
  mismatched[1].emit({ type: 'result', requestId: 1, result: { name: 'bridge-dds', version: '1.4.0', classes: [] } });
  await pending;
  const always: FakeWorker[] = [];
  const stale = analysisClient(record, () => { const worker = new FakeWorker(999); always.push(worker); return worker; });
  await expect(stale.solver.solvePosition(layout, position)).rejects.toThrow('AnalysisProtocolMismatch');
  expect(always).toHaveLength(2);
  expect(always.every(worker => worker.posted.length === 0)).toBe(true);
});
test('#21: a worker that never says hello times out instead of hanging', async () => {
  vi.useFakeTimers();
  const worker = new FakeWorker(null);
  const client = analysisClient(record, () => worker);
  const failed = expect(client.solver.solvePosition(layout, position)).rejects.toThrow('AnalysisTimeout');
  await vi.advanceTimersByTimeAsync(30000); await failed;
  expect(worker.terminated).toBe(true);
  expect(worker.posted).toEqual([]);
});
