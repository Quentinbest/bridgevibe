import { afterEach, expect, test, vi } from 'vitest';
import { completedRecord, startPlaythrough } from '../table';
import { completeFixedDeal } from '../../test/strategy';
import { positionAt } from '../analysis';
import { analysisClient, type AnalysisWorker } from './analysisClient';
import { ANALYSIS_PROTOCOL_VERSION, type AnalysisMessage, type AnalysisRequest, type AnalysisResponse } from './analysisProtocol';

afterEach(() => { vi.useRealTimers(); });
class FakeWorker implements AnalysisWorker {
  onmessage: AnalysisWorker['onmessage'] = null;
  onerror: AnalysisWorker['onerror'] = null;
  posted: AnalysisRequest[] = [];
  terminated = false;
  constructor(version: number | null = ANALYSIS_PROTOCOL_VERSION) {
    if (version !== null) queueMicrotask(() => this.emit({ type: 'hello', protocolVersion: version }));
  }
  cancelled: string[] = [];
  postMessage(message: AnalysisMessage) { if (message.type === 'cancel') this.cancelled.push(message.cancellationId); else this.posted.push(message); }
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
  expect(workers[0].posted).toEqual([expect.objectContaining({ type: 'solve', requestId: 1, record, index: 1, playthroughId: record.playthroughId, positionKey: expect.stringMatching(/^[0-9a-f]{16}$/), deadline: Date.now() + 30000, cancellationId: 'auto:1' })]);
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
  worker.emit({ ...worker.posted[0], type: 'result', requestId: 99, result: { ...result, version: 'stale' } });
  worker.emit({ ...worker.posted[0], type: 'result', result });
  await expect(pending).resolves.toEqual(result);
});
test('US-41.3: a worker with another protocol version is reloaded before any request, then given up', async () => {
  const mismatched: FakeWorker[] = [];
  const reloaded = analysisClient(record, () => { const worker = new FakeWorker(mismatched.length ? ANALYSIS_PROTOCOL_VERSION : 999); mismatched.push(worker); return worker; });
  const pending = reloaded.solver.solvePosition(layout, position);
  await vi.waitFor(() => expect(mismatched[1]?.posted).toHaveLength(1));
  expect(mismatched[0].terminated).toBe(true);
  expect(mismatched[0].posted).toEqual([]);
  mismatched[1].emit({ ...mismatched[1].posted[0], type: 'result', result: { name: 'bridge-dds', version: '1.4.0', classes: [] } });
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

// US-14.12: identity guards apply to errors too; stale data must not fail a current solve.
test.each(['playthroughId', 'positionKey'] as const)('§4.3.6: discards a mismatched %s with the right request ID', async field => {
  const worker = new FakeWorker();
  const client = analysisClient(record, () => worker);
  const settled = vi.fn();
  const pending = client.solver.solvePosition(layout, position);
  void pending.then(settled, settled);
  await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
  const request = worker.posted[0];
  const result = { name: 'test', version: '1', classes: [] };
  worker.emit({ ...request, type: 'result', [field]: 'stale', result });
  worker.emit({ ...request, type: 'error', [field]: 'stale' });
  await Promise.resolve(); expect(settled).not.toHaveBeenCalled();
  worker.emit({ ...request, type: 'result', result });
  await expect(pending).resolves.toEqual(result);
  client.close();
});
test('§4.3.6: targeted cancellation preserves concurrent requests and the same worker', async () => {
  const worker = new FakeWorker(); const factory = vi.fn(() => worker);
  const client = analysisClient(record, factory);
  client.at(1); const first = client.solver.solvePosition(layout, position, 'caller-first');
  const cancelled = expect(first).rejects.toThrow('AnalysisCancelled');
  client.at(2); const second = client.solver.solvePosition(layout, position, 'caller-second');
  await vi.waitFor(() => expect(worker.posted).toHaveLength(2));
  const [a, b] = worker.posted;
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide });
  for (const [i, entry] of record.actions.slice(0, 2).entries()) {
    expect(table.submit(entry.seat, entry.controller, entry.action, entry.provenance).kind).toBe('accepted');
    expect(worker.posted[i].positionKey).toBe(table.positionKey());
  }
  client.cancel('caller-first'); await cancelled;
  expect(worker.cancelled).toEqual(['caller:caller-first']); expect(worker.terminated).toBe(false);
  const result = { name: 'test', version: '1', classes: [] };
  worker.emit({ ...a, type: 'result', result });
  worker.emit({ ...b, type: 'result', result });
  await expect(second).resolves.toEqual(result);
  const third = client.solver.solvePosition(layout, position);
  await vi.waitFor(() => expect(worker.posted).toHaveLength(3));
  worker.emit({ ...worker.posted[2], type: 'result', result }); await third;
  expect(factory).toHaveBeenCalledOnce(); client.close();
});

test('§4.3.6: a caller cancels its own ID without inspecting any posted request', async () => {
  const worker: AnalysisWorker = { onmessage: null, onerror: null, terminate: vi.fn(), postMessage(message: AnalysisMessage) {
    if (message.type !== 'solve' || message.cancellationId === 'caller:owned-first') return;
    queueMicrotask(() => worker.onmessage?.(new MessageEvent<AnalysisResponse>('message', { data: { type: 'result', requestId: message.requestId,
      playthroughId: message.playthroughId, positionKey: message.positionKey, result: { name: 'test', version: '1', classes: [] } } })));
  } };
  queueMicrotask(() => worker.onmessage?.({ data: { type: 'hello', protocolVersion: ANALYSIS_PROTOCOL_VERSION } } as MessageEvent<AnalysisResponse>));
  const client = analysisClient(record, () => worker);
  const first = client.solver.solvePosition(layout, position, 'owned-first');
  const rejected = expect(first).rejects.toThrow('AnalysisCancelled');
  const second = client.solver.solvePosition(layout, position, 'owned-second');
  // Both solves are pending while the worker handshake completes.
  await second;
  client.cancel('owned-first'); await rejected;
  expect(worker.terminate).not.toHaveBeenCalled();
  await expect(client.solver.solvePosition(layout, position, 'owned-third')).resolves.toMatchObject({ name: 'test' });
  client.close();
});

test('§4.3.6: a cancellation made before the handshake completes is never posted', async () => {
  const worker = new FakeWorker(null);
  const client = analysisClient(record, () => worker);
  const owned = client.solver.solvePosition(layout, position, 'early');
  const rejected = expect(owned).rejects.toThrow('AnalysisCancelled');
  client.cancel('early');
  worker.emit({ type: 'hello', protocolVersion: ANALYSIS_PROTOCOL_VERSION });
  await rejected;
  expect(worker.posted).toEqual([]);
  // The client stays usable: a later request is posted and served normally.
  const later = client.solver.solvePosition(layout, position, 'later');
  await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
  worker.emit({ ...worker.posted[0], type: 'result', result: { name: 'test', version: '1', classes: [] } });
  await expect(later).resolves.toMatchObject({ name: 'test' });
  client.close();
});

test('US-45.1: a worker-side deadline error keeps its timeout cause', async () => {
  const worker = new FakeWorker(); const client = analysisClient(record, () => worker);
  const timedOut = client.solver.solvePosition(layout, position);
  await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
  worker.emit({ type: 'error', requestId: worker.posted[0].requestId, playthroughId: worker.posted[0].playthroughId, positionKey: worker.posted[0].positionKey, cause: 'timeout' });
  await expect(timedOut).rejects.toThrow('AnalysisTimeout');
  const failed = client.solver.solvePosition(layout, position);
  await vi.waitFor(() => expect(worker.posted).toHaveLength(2));
  worker.emit({ type: 'error', requestId: worker.posted[1].requestId, playthroughId: worker.posted[1].playthroughId, positionKey: worker.posted[1].positionKey });
  await expect(failed).rejects.toThrow('AnalysisFailed');
  client.close();
});

test('§4.3.6: caller and generated cancellation IDs never collide, and a duplicate caller ID is refused', async () => {
  const worker = new FakeWorker(); const client = analysisClient(record, () => worker);
  const owned = client.solver.solvePosition(layout, position, 'analysis-2');
  const generated = client.solver.solvePosition(layout, position);
  await vi.waitFor(() => expect(worker.posted).toHaveLength(2));
  expect(new Set(worker.posted.map(request => request.cancellationId)).size).toBe(2);
  await expect(client.solver.solvePosition(layout, position, 'analysis-2')).rejects.toThrow('DuplicateCancellationId');
  const result = { name: 'test', version: '1', classes: [] };
  for (const request of worker.posted) worker.emit({ ...request, type: 'result', result });
  await expect(owned).resolves.toEqual(result); await expect(generated).resolves.toEqual(result);
  client.close();
});

test('§4.3.6: an empty caller cancellation ID is refused, never sent as caller:', async () => {
  const worker = new FakeWorker(); const client = analysisClient(record, () => worker);
  await expect(client.solver.solvePosition(layout, position, '')).rejects.toThrow('InvalidCancellationId');
  expect(worker.posted).toEqual([]);
  client.close();
});
