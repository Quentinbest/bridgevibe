import { afterEach, expect, test, vi } from 'vitest';
import { completedRecord, encodeSeatView, seatViewSeed, startPlaythrough } from '../table';
import type { PositionResult, SolverPort } from '../analysis';
import { completeFixedDeal } from '../../test/strategy';
import { loadConfiguredSolver } from '../analysis/solverSelection';
import { createAnalysisHandler } from './analysisWorker';
import { handleHintRequest } from './hintWorker';
import { ANALYSIS_PROTOCOL_VERSION, type AnalysisRequest } from './analysisProtocol';
import { HINT_PROTOCOL_VERSION } from './hintProtocol';

vi.mock('../analysis/solverSelection', () => ({ loadConfiguredSolver: vi.fn(), configuredEngine: () => ({ name: 'test', version: '1' }) }));
vi.mock('../analysis/sampledEstimate', async importOriginal => ({ ...await importOriginal<object>(), sampledEstimate: vi.fn(async () => ({ abstention: { reason: 'uncertain', cause: 'constraints' }, sampleCount: 0, enumerated: false })) }));
afterEach(() => vi.resetAllMocks());
const record = completedRecord(completeFixedDeal());
const result: PositionResult = { name: 'test', version: '1', classes: [] };
const request = (requestId: number): AnalysisRequest => ({ type: 'solve', requestId, record, index: 0,
  playthroughId: record.playthroughId, positionKey: '0123456789abcdef', deadline: Date.now() + 30000, cancellationId: `analysis-${requestId}` });

test('US-41.3: analysis uses version 2; review sampling extends the hint protocol to version 3', () => {
  expect(ANALYSIS_PROTOCOL_VERSION).toBe(2); expect(HINT_PROTOCOL_VERSION).toBe(3);
});
test('§4.3.6: the analysis worker suppresses a cancelled result and serves other requests', async () => {
  let finish!: (value: PositionResult) => void;
  const solve = vi.fn().mockImplementationOnce(() => new Promise<PositionResult>(resolve => { finish = resolve; })).mockResolvedValue(result);
  vi.mocked(loadConfiguredSolver).mockResolvedValue({ name: 'test', version: '1', solvePosition: solve, solveTable: vi.fn() } satisfies SolverPort);
  const handle = createAnalysisHandler(), post = vi.fn();
  const first = handle(request(1), post);
  await vi.waitFor(() => expect(solve).toHaveBeenCalledOnce());
  await handle({ type: 'cancel', cancellationId: 'analysis-1' }, post);
  await handle(request(2), post);
  finish(result); await first;
  expect(post).toHaveBeenCalledExactlyOnceWith({ type: 'result', requestId: 2, playthroughId: record.playthroughId, positionKey: request(2).positionKey, result });
  await handle(request(3), post); expect(post).toHaveBeenCalledTimes(2);
});
test('§4.3.6: analysis errors echo identity and expired work never calls the solver', async () => {
  const handle = createAnalysisHandler(), post = vi.fn();
  const expired = { ...request(1), deadline: Date.now() - 1 };
  await handle(expired, post);
  expect(loadConfiguredSolver).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledExactlyOnceWith({ type: 'error', requestId: 1, playthroughId: expired.playthroughId, positionKey: expired.positionKey, cause: 'timeout' });
});
test.each([false, true])('ADR-0001, §4.3.6: hint worker echoes identity on success/error (error=%s)', async error => {
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide });
  const view = table.seatView('west');
  if (error) vi.mocked(loadConfiguredSolver).mockRejectedValue(new Error('solver'));
  else vi.mocked(loadConfiguredSolver).mockResolvedValue({ name: 'test', version: '1', solvePosition: vi.fn(), solveTable: vi.fn() });
  const post = vi.fn();
  await handleHintRequest({ type: 'hint', requestId: 1, playthroughId: record.playthroughId, positionKey: seatViewSeed(view), cancellationId: 'hint-1',
    view: encodeSeatView(view), candidates: view.hand, seed: 'test', deadline: Date.now() + 3000 }, post);
  expect(post).toHaveBeenCalledOnce();
  expect(post.mock.calls[0][0]).toMatchObject({ type: 'result', requestId: 1, playthroughId: record.playthroughId, positionKey: seatViewSeed(view),
    result: { abstention: { reason: error ? 'unavailable' : 'uncertain' } } });
});

test('§4.3.6: a solver load that exhausts the deadline never starts a synchronous solve', async () => {
  vi.useFakeTimers();
  try {
    const solvePosition = vi.fn();
    vi.mocked(loadConfiguredSolver).mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({ name: 'test', version: '1', solvePosition, solveTable: vi.fn() }), 30001);
    }));
    const data = request(1), post = vi.fn();
    const pending = createAnalysisHandler()(data, post);
    await vi.advanceTimersByTimeAsync(30001); await pending;
    expect(solvePosition).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledExactlyOnceWith({ type: 'error', requestId: 1, playthroughId: data.playthroughId, positionKey: data.positionKey, cause: 'timeout' });
  } finally { vi.useRealTimers(); }
});
