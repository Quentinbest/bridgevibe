// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { dealFromSeed, startPlaythrough, encodeSeatView } from '../table';
import { runHint, type HintWorker } from './hintClient';
import { HINT_PROTOCOL_VERSION, type HintRequest, type HintResponse } from './hintProtocol';
const view = () => startPlaythrough({ deal: dealFromSeed('hint-worker', 1), contract: { level: 1, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' }).seatView('west');
function worker(): HintWorker { return { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }; }
const send = (owned: HintWorker, data: HintResponse) => owned.onmessage!({ data } as MessageEvent<HintResponse>);
const hello = (owned: HintWorker, protocolVersion = HINT_PROTOCOL_VERSION) => send(owned, { type: 'hello', protocolVersion });
// The view is deterministic, so its first card is always a valid candidate.
const success: HintResponse = { type: 'result', requestId: 1, result: { classes: [{ cards: [view().hand[0]], tricks: 3 }], sampleCount: 50, enumerated: false } };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
test('hello gates requests containing only encoded Seat View and candidates, and cancellation terminates', () => {
  vi.useFakeTimers(); const owned = worker(); const done = vi.fn(); const v = view();
  const cancel = runHint(v, v.hand, done, () => owned);
  expect(owned.postMessage).not.toHaveBeenCalled(); hello(owned);
  const request = vi.mocked(owned.postMessage).mock.calls[0][0] as HintRequest;
  expect(Object.keys(request).sort()).toEqual(['candidates', 'deadline', 'requestId', 'seed', 'type', 'view']);
  expect(request.view).toEqual(encodeSeatView(v)); expect(request).not.toHaveProperty('record');
  cancel(); vi.advanceTimersByTime(3001); expect(done).not.toHaveBeenCalled(); expect(owned.terminate).toHaveBeenCalledOnce();
});
test('a protocol mismatch reloads once before sending a request, then accepts the fresh worker result', () => {
  vi.useFakeTimers(); const first = worker(), second = worker(), done = vi.fn(); const v = view();
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  runHint(v, v.hand, done, factory);
  const stale = first.onmessage!;
  hello(first, 99);
  expect(first.terminate).toHaveBeenCalledOnce(); expect(first.postMessage).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
  stale({ data: success } as MessageEvent<HintResponse>); expect(done).not.toHaveBeenCalled();
  hello(second); expect(second.postMessage).toHaveBeenCalledOnce(); send(second, success);
  expect(factory).toHaveBeenCalledTimes(2); expect(done).toHaveBeenCalledExactlyOnceWith(success.type === 'result' && success.result, 0);
});
test('two protocol mismatches abstain with the distinct cause, without sending a request', () => {
  vi.useFakeTimers(); const first = worker(), second = worker(), done = vi.fn(); const v = view();
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  runHint(v, v.hand, done, factory); hello(first, 99); hello(second, 99);
  expect(factory).toHaveBeenCalledTimes(2); expect(first.terminate).toHaveBeenCalledOnce(); expect(second.terminate).toHaveBeenCalledOnce();
  expect(first.postMessage).not.toHaveBeenCalled(); expect(second.postMessage).not.toHaveBeenCalled();
  expect(done.mock.calls[0][0]).toMatchObject({ abstention: { reason: 'unavailable', cause: 'protocol-mismatch' }, sampleCount: 0 });
  vi.advanceTimersByTime(3001); expect(done).toHaveBeenCalledOnce();
});
test.each(['crash', 'timeout'] as const)('%s abstains with its cause and no partial result', fault => {
  vi.useFakeTimers(); const owned = worker(), done = vi.fn(); const v = view();
  runHint(v, v.hand, done, () => owned);
  if (fault === 'crash') owned.onerror!({} as ErrorEvent);
  vi.advanceTimersByTime(3001);
  expect(done).toHaveBeenCalledOnce(); expect(done.mock.calls[0][0]).toMatchObject({ abstention: { reason: 'unavailable', cause: fault === 'crash' ? 'worker-crash' : 'timeout' }, sampleCount: 0 });
  expect(owned.terminate).toHaveBeenCalledOnce();
});
test('visibility changes cancel and restart with a fresh window; latency excludes hidden time', () => {
  vi.useFakeTimers(); const first = worker(), second = worker(), done = vi.fn(); const v = view();
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  runHint(v, v.hand, done, factory); hello(first);
  const stale = first.onmessage!;
  vi.advanceTimersByTime(2000);
  visibility.mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange'));
  expect(first.terminate).toHaveBeenCalledOnce(); vi.advanceTimersByTime(10000);
  expect(done).not.toHaveBeenCalled(); expect(factory).toHaveBeenCalledOnce();
  visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange')); hello(second);
  const request = vi.mocked(second.postMessage).mock.calls[0][0] as HintRequest;
  expect(request.deadline).toBe(Date.now() + 3000);
  stale({ data: success } as MessageEvent<HintResponse>); expect(done).not.toHaveBeenCalled();
  vi.advanceTimersByTime(2000); send(second, success);
  expect(done).toHaveBeenCalledExactlyOnceWith(success.type === 'result' && success.result, 4000);
  document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(3001);
  expect(factory).toHaveBeenCalledTimes(2); expect(done).toHaveBeenCalledOnce();
});
test('a cancelled position never restarts after visibility returns, and initially hidden runs wait', () => {
  vi.useFakeTimers(); const v = view(), owned = worker(), done = vi.fn();
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const factory = vi.fn(() => owned);
  const cancel = runHint(v, v.hand, done, factory);
  vi.advanceTimersByTime(10000); expect(factory).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange')); hello(owned);
  visibility.mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); cancel();
  visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(10000);
  expect(factory).toHaveBeenCalledOnce(); expect(done).not.toHaveBeenCalled();
});
test.each([
  ['a missing result', { type: 'result', requestId: 1 }],
  ['an unknown type', { type: 'answer', requestId: 1, result: {} }],
  ['a card that is not a candidate', { type: 'result', requestId: 1, result: { classes: [{ cards: [{ suit: 'spades', rank: 'X' }], tricks: 3 }], sampleCount: 50, enumerated: false } }],
  ['non-finite tricks', { type: 'result', requestId: 1, result: { classes: [{ cards: [view().hand[0]], tricks: NaN }], sampleCount: 50, enumerated: false } }],
  ['no classes', { type: 'result', requestId: 1, result: { classes: [], sampleCount: 50, enumerated: false } }],
  ['an unknown abstention cause', { type: 'result', requestId: 1, result: { abstention: { reason: 'unavailable', cause: 'gremlins' }, sampleCount: 0, enumerated: false } }],
  ['an extra key', { type: 'result', requestId: 1, result: { classes: [{ cards: [view().hand[0]], tricks: 3 }], sampleCount: 50, enumerated: false, leak: [] } }],
])('US-12.5: %s becomes an unavailable abstention, never published advice', (_name, data) => {
  vi.useFakeTimers(); const owned = worker(), done = vi.fn(); const v = view();
  runHint(v, v.hand, done, () => owned); hello(owned);
  owned.onmessage!({ data } as MessageEvent<HintResponse>);
  expect(done).toHaveBeenCalledOnce();
  expect(done.mock.calls[0][0]).toMatchObject({ abstention: { reason: 'unavailable', cause: 'error' }, sampleCount: 0 });
  expect(owned.terminate).toHaveBeenCalledOnce();
});
