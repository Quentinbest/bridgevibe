import { afterEach, expect, test, vi } from 'vitest';
import { dealFromSeed, startPlaythrough, encodeSeatView } from '../table';
import { runHint, type HintWorker } from './hintClient';
import { HINT_PROTOCOL_VERSION, type HintRequest } from './hintProtocol';
const view = () => startPlaythrough({ deal: dealFromSeed('hint-worker', 1), contract: { level: 1, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' }).seatView('west');
function worker(): HintWorker { return { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }; }
afterEach(() => vi.useRealTimers());
test('hello gates requests containing only encoded Seat View and candidates, and cancellation terminates', () => {
  vi.useFakeTimers(); const owned = worker(); const done = vi.fn(); const v = view();
  const cancel = runHint(v, v.hand, done, () => owned);
  expect(owned.postMessage).not.toHaveBeenCalled();
  owned.onmessage!({ data: { type: 'hello', protocolVersion: HINT_PROTOCOL_VERSION } } as MessageEvent);
  const request = vi.mocked(owned.postMessage).mock.calls[0][0] as HintRequest;
  expect(Object.keys(request).sort()).toEqual(['candidates', 'deadline', 'requestId', 'seed', 'type', 'view']);
  expect(request.view).toEqual(encodeSeatView(v)); expect(request).not.toHaveProperty('record');
  cancel(); vi.advanceTimersByTime(3001); expect(done).not.toHaveBeenCalled(); expect(owned.terminate).toHaveBeenCalledOnce();
});
test('wrong handshake, crashes and a nonresponsive worker abstain; timeout never publishes a partial result', () => {
  vi.useFakeTimers();
  for (const fault of ['protocol', 'crash', 'timeout']) {
    const owned = worker(); const done = vi.fn(); const v = view(); runHint(v, v.hand, done, () => owned);
    if (fault === 'protocol') owned.onmessage!({ data: { type: 'hello', protocolVersion: 99 } } as MessageEvent);
    if (fault === 'crash') owned.onerror!({} as ErrorEvent);
    vi.advanceTimersByTime(3001);
    expect(done).toHaveBeenCalledOnce(); expect(done.mock.calls[0][0]).toMatchObject({ abstention: { reason: 'unavailable' }, sampleCount: 0 });
    expect(owned.terminate).toHaveBeenCalledOnce();
  }
});
