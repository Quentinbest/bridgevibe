import { expect, test, vi } from 'vitest';
import { sampledPractice } from '../../test/sampledPractice';
import { f4Position, finish, points } from '../../test/f4/records';
import { assessDecisions, keyMoments } from '../coach/decisionAssessment';
import { samplingPositions, samplingOrder } from '../coach/sampledQuality';
import { createProvenanceLog } from '../coach/provenance';
import { trickCosts, type TrickCost } from '../coach/trickCost';
import { bridgeDdsAdapter } from '../analysis/bridgeDdsAdapter';
import { decodeSeatView, seatViewSeed } from '../table';
import { REVIEW_DEADLINE_MS } from '../information/parameters';
import { runReviewSampling, reviewSamplingClient, reviewSampling } from './reviewSampling';
import { handleHintRequest } from './hintWorker';
import { runHint, type HintWorker } from './hintClient';
import { HINT_PROTOCOL_VERSION, type HintRequest, type HintResponse } from './hintProtocol';
import { robotAudit } from './robotAudit';
import { text } from '../explanation';

const record = sampledPractice();
const source = { engine: { name: 'test', version: '1' }, sampler: { name: 'bv-layout', version: '1' } };
const costs: TrickCost[] = record.actions.map(entry => ({ positionIndex: entry.index, cost: 1, candidatesDiffered: true,
  statement: { id: `cost-${entry.index}`, playthroughId: record.playthroughId, positionIndex: entry.index, kind: 'statement', summary: 'cost',
    text: 'X-ray cost', informationMode: 'ALL_HANDS', at: '2026-10-25T00:00:00Z',
    provenance: { sourceKind: 'engine', name: 'test', version: '1', mode: 'ALL_HANDS', sampleCount: 0 } } }));
const decisions = assessDecisions(record, costs);

test('U-14: injected clock cuts off a decision and leaves it and every later decision uncertain', async () => {
  let now = 0;
  const requests: HintRequest[] = [];
  const assessed = await runReviewSampling(record, decisions, [], async request => {
    requests.push(request); now += 4000;
    return { requestId: request.requestId, playthroughId: request.playthroughId, positionKey: request.positionKey, result: { classes: [{ cards: request.candidates, tricks: 1 }], sampleCount: 50, enumerated: false }, source, type: 'result' };
  }, REVIEW_DEADLINE_MS, () => now);
  expect(requests).toHaveLength(2);
  expect(new Set(requests.map(r => r.deadline))).toEqual(new Set([8000]));
  expect(assessed[0].quality).toBe('acceptable');
  expect(assessed.slice(1).every(d => d.quality === 'uncertain' && d.verdict === undefined)).toBe(true);
  const unused = vi.fn();
  expect(await runReviewSampling(record, decisions, [], unused, 0, () => 0)).toEqual(decisions);
  expect(unused).not.toHaveBeenCalled();
});
test('ADR-0001: review payload audit uses historical visibility, not all cards played by completion', async () => {
  const positions = samplingPositions(record, decisions);
  const first = positions[0];
  const history = () => ({ ...record, actions: record.actions.slice(0, first.decision.positionIndex) });
  const inspect = robotAudit(history);
  const request = vi.fn(async (request: HintRequest) => {
    inspect(request, first.view.seat);
    expect(request).not.toHaveProperty('record'); expect(request).not.toHaveProperty('deal');
    const known = [...first.view.hand, ...(first.view.dummy ?? []), ...history().actions.map(a => a.action.card)];
    const hidden = Object.values(record.deal.hands).flat().find(c => !known.some(k => k.suit === c.suit && k.rank === c.rank))!;
    expect(() => inspect({ ...request, hidden }, first.view.seat)).toThrow('robot-audit-hidden-card');
    return undefined;
  });
  await runReviewSampling(record, [first.decision], [], request, Infinity);
  expect(request).toHaveBeenCalledOnce();
});
test('US-18.8: real hint client and review queue send identical first 50 layouts through the worker handler', async () => {
  const position = samplingPositions(record, decisions)[0];
  const layouts: unknown[][] = [[], []];
  const solve = (index: number) => async () => ({ ...bridgeDdsAdapter, async solvePosition(layout: Parameters<typeof bridgeDdsAdapter.solvePosition>[0]) {
    layouts[index].push(structuredClone(layout));
    return { ...bridgeDdsAdapter, classes: [{ cards: position.candidates, tricks: 1 }] };
  } });
  const worker: HintWorker = { onmessage: null, onerror: null, terminate() {}, postMessage(request: HintRequest) {
    void handleHintRequest(request, data => worker.onmessage?.({ data } as MessageEvent<HintResponse>), solve(0));
  } };
  const hinted = new Promise<void>(resolve => {
    runHint(position.view, position.candidates, result => { expect(result.sampleCount).toBe(50); resolve(); },
      { playthroughId: record.playthroughId, positionKey: seatViewSeed(position.view) }, () => worker);
  });
  worker.onmessage!({ data: { type: 'hello', protocolVersion: HINT_PROTOCOL_VERSION } } as MessageEvent<HintResponse>);
  await hinted;
  await runReviewSampling(record, [position.decision], [], request => new Promise(resolve => {
    expect(decodeSeatView(request.view)).toEqual(position.view);
    void handleHintRequest(request, response => { if (response.type === 'result') resolve(response); }, solve(1));
  }), Date.now() + 8000);
  expect(layouts[0]).toHaveLength(50);
  expect(layouts[1].slice(0, 50)).toEqual(layouts[0]);
});
test('U-14: client terminates a stalled worker at the shared deadline', async () => {
  vi.useFakeTimers();
  try {
    const worker: HintWorker = { onmessage: null, onerror: null, terminate: vi.fn(), postMessage: vi.fn() };
    const client = reviewSamplingClient(Date.now() + 8000, () => worker);
    const pending = runReviewSampling(record, decisions, [], client.estimate, Date.now() + 8000);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toEqual(decisions);
    expect(worker.postMessage).not.toHaveBeenCalled(); expect(worker.terminate).toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
test('U-14: reopening the same completed Playthrough reuses its one run, including while pending', async () => {
  let workers = 0, requests = 0;
  vi.stubGlobal('Worker', class {
    onmessage: HintWorker['onmessage'] = null;
    onerror = null;
    constructor() { workers++; queueMicrotask(() => this.onmessage?.({ data: { type: 'hello', protocolVersion: HINT_PROTOCOL_VERSION } } as MessageEvent<HintResponse>)); }
    terminate() {}
    postMessage(request: HintRequest) {
      requests++;
      queueMicrotask(() => this.onmessage?.({ data: { type: 'result', requestId: request.requestId, playthroughId: request.playthroughId,
        positionKey: request.positionKey, result: { classes: [{ cards: request.candidates, tricks: 1 }], sampleCount: 50, enumerated: false }, source } } as MessageEvent<HintResponse>));
    }
  });
  try {
    const first = reviewSampling(record, decisions, []);
    expect(reviewSampling(record, decisions, [])).toBe(first);
    await first;
    expect(reviewSampling(record, decisions, [])).toBe(first);
    expect(workers).toBe(1); expect(requests).toBe(samplingOrder(decisions).length);
  } finally { vi.unstubAllGlobals(); }
});

// §4.7: injected visibility uses the same hidden/subscribe contract as the robot host.
function visibilityHarness(initiallyHidden = false) {
  let hidden = initiallyHidden;
  const listeners = new Set<() => void>();
  const visibility = { hidden: () => hidden, subscribe(callback: () => void) {
    listeners.add(callback); return () => { listeners.delete(callback); };
  } };
  const clock = { now: () => Date.now(), setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
    clearTimeout: (timer: ReturnType<typeof setTimeout> | undefined) => clearTimeout(timer) };
  const workers: HintWorker[] = [], requests: HintRequest[] = [];
  const createWorker = () => {
    const worker: HintWorker = { onmessage: null, onerror: null, terminate: vi.fn(),
      postMessage(request: HintRequest) { requests.push(request); } };
    workers.push(worker); return worker;
  };
  const hello = () => workers.at(-1)!.onmessage!({ data: { type: 'hello', protocolVersion: HINT_PROTOCOL_VERSION } } as MessageEvent<HintResponse>);
  const reply = (request: HintRequest, receive = workers.at(-1)!.onmessage!, sampleCount = 50) => receive({ data: {
    type: 'result', requestId: request.requestId, playthroughId: request.playthroughId, positionKey: request.positionKey,
    result: { classes: [{ cards: request.candidates, tricks: 1 }], sampleCount, enumerated: false }, source,
  } } as MessageEvent<HintResponse>);
  return { clock, visibility, createWorker, workers, requests, listeners, hello, reply,
    change(value: boolean, notify = true) { hidden = value; if (notify) listeners.forEach(callback => callback()); } };
}
test('§4.7: hidden time preserves completed decisions and the cached run; stale replies never settle resumed work', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const h = visibilityHarness();
  let client: ReturnType<typeof reviewSamplingClient> | undefined;
  try {
    const fresh = sampledPractice();
    const selected = assessDecisions(fresh, costs).slice(0, 3);
    const factory = (deadline: number) => client = reviewSamplingClient(deadline, h.createWorker, h);
    const pending = reviewSampling(fresh, selected, [], undefined, factory);
    const settled = vi.fn(); void pending.then(settled);
    h.hello();
    await vi.advanceTimersByTimeAsync(1000);
    h.reply(h.requests[0]); await vi.advanceTimersByTimeAsync(0);
    expect(h.requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1000);
    const stale = h.workers[0].onmessage!;
    // A message can observe hidden visibility before the visibilitychange event is dispatched.
    h.change(true, false); h.reply(h.requests[1], stale, 99);
    expect(h.workers[0].terminate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(20000);
    h.change(true); h.reply(h.requests[1], stale, 99);
    expect(settled).not.toHaveBeenCalled(); expect(h.requests).toHaveLength(2);
    expect(reviewSampling(fresh, selected, [], undefined, factory)).toBe(pending);
    h.change(false); h.hello();
    expect(h.requests[2]).toEqual({ ...h.requests[1], deadline: 28000 });
    h.reply(h.requests[1], stale, 99);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.requests).toHaveLength(3);
    h.reply(h.requests[2]); h.reply(h.requests[2]); await vi.advanceTimersByTimeAsync(0);
    expect(h.requests).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(1000); h.reply(h.requests[3]);
    const assessed = await pending;
    expect(assessed.every(d => d.quality === 'acceptable' && d.sampling?.sampleCount === 50)).toBe(true);
    expect(h.requests.map(r => r.requestId)).toEqual([selected[0].positionIndex + 1, selected[1].positionIndex + 1,
      selected[1].positionIndex + 1, selected[2].positionIndex + 1]);
    expect(h.requests[3].deadline).toBe(28000);
    expect(settled).toHaveBeenCalledOnce(); expect(h.listeners.size).toBe(0);
    expect(reviewSampling(fresh, selected, [], undefined, factory)).toBe(pending);
    expect(h.workers).toHaveLength(2);
  } finally { client?.close(); vi.useRealTimers(); }
});
test('§4.7: initially hidden and interrupted handshake time pause; repeated hides cannot extend eight visible seconds', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const h = visibilityHarness(true);
  const client = reviewSamplingClient(8000, h.createWorker, h);
  try {
    const pending = runReviewSampling(record, decisions, [], client.estimate, client.deadline, h.clock.now);
    const settled = vi.fn(); void pending.then(settled);
    await vi.advanceTimersByTimeAsync(20000);
    expect(h.workers).toHaveLength(0); expect(settled).not.toHaveBeenCalled();
    h.change(false);
    await vi.advanceTimersByTimeAsync(2000); h.change(true);
    expect(h.requests).toHaveLength(0); expect(h.workers[0].terminate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10000); h.change(true);
    await vi.advanceTimersByTimeAsync(10000); h.change(false); h.hello();
    expect(h.requests[0].deadline).toBe(48000);
    const late = h.workers[1].onmessage!;
    await vi.advanceTimersByTimeAsync(5999); expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual(decisions);
    expect(h.workers[1].terminate).toHaveBeenCalledOnce();
    h.reply(h.requests[0], late); h.change(true); h.change(false);
    expect(settled).toHaveBeenCalledOnce(); expect(h.workers).toHaveLength(2);
    expect(h.requests).toHaveLength(1); expect(h.listeners.size).toBe(0);
  } finally { client.close(); vi.useRealTimers(); }
});
test('US-18.3 composition: unlabelled practice, real DDS and worker handler produce sampled verdicts; audit passes', async () => {
  const log = createProvenanceLog();
  const realCosts: TrickCost[] = [];
  await trickCosts(record, bridgeDdsAdapter, log, 'sampled',
    (cost, name, version) => text('review.cost-description', { cost, name, version }), cost => realCosts.push(cost));
  expect(realCosts.some(cost => cost.cost > 0)).toBe(true);
  expect(realCosts.every(cost => typeof cost.candidatesDiffered === 'boolean')).toBe(true);
  const initial = assessDecisions(record, realCosts);
  expect(initial.every(d => !d.labelled)).toBe(true);
  const requests: HintRequest[] = [];
  const sampled = await runReviewSampling(record, initial, [], request => new Promise(resolve => {
    requests.push(request);
    void handleHintRequest(request, response => { if (response.type === 'result') resolve(response); });
  }), Date.now() + REVIEW_DEADLINE_MS, Date.now, (request, positionIndex) => {
    robotAudit(() => ({ ...record, actions: record.actions.slice(0, positionIndex) }))(request, request.view.seat);
  });
  expect(requests.map(r => r.requestId - 1)).toEqual(samplingOrder(initial).slice(0, requests.length).map(d => d.positionIndex));
  expect(sampled.some(d => d.qualitySource === 'sampled' && d.verdict)).toBe(true);
  expect(sampled.filter(d => d.quality === 'uncertain').every(d => !d.verdict)).toBe(true);
}, 30000);
test('US-18.3: F4 labels take precedence through the real review queue', async () => {
  const point = points[1];
  const labelledRecord = finish(f4Position(point), point.candidates[3].cards[0]);
  const realCosts: TrickCost[] = [];
  await trickCosts(labelledRecord, bridgeDdsAdapter, createProvenanceLog(), 'labels',
    (cost, name, version) => text('review.cost-description', { cost, name, version }), cost => realCosts.push(cost));
  const initial = assessDecisions(labelledRecord, realCosts);
  const requested: number[] = [];
  const sampled = await runReviewSampling(labelledRecord, initial, [], request => new Promise(resolve => {
    requested.push(request.requestId - 1);
    void handleHintRequest(request, response => { if (response.type === 'result') resolve(response); });
  }), Date.now() + REVIEW_DEADLINE_MS);
  const labelled = initial.filter(d => d.labelled);
  expect(keyMoments(sampled).some(d => d.positionIndex === point.positionKey.actions.length)).toBe(true);
  expect(labelled.length).toBeGreaterThan(0);
  for (const decision of labelled) {
    expect(requested).not.toContain(decision.positionIndex);
    expect(sampled.find(d => d.positionIndex === decision.positionIndex)).toBe(decision);
  }
}, 30000);
