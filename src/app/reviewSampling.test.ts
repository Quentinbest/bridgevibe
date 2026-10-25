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
