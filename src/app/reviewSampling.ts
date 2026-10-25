import { encodeSeatView, seatViewSeed, type CompletedPlaythroughRecord } from '../table';
import { REVIEW_DEADLINE_MS } from '../information/parameters';
import { followedHint, sampledQuality, samplingPositions } from '../coach/sampledQuality';
import type { DecisionAssessment } from '../coach/decisionAssessment';
import type { LogEntry } from '../coach/provenance';
import { HINT_PROTOCOL_VERSION, validHintResponse, validHintEnvelope, type HintRequest, type HintResponse } from './hintProtocol';
import type { HintWorker } from './hintClient';
import type { RobotHostOptions } from './robotHost';
import { browserRobotAudit, robotAudit } from './robotAudit';

type Result = Extract<HintResponse, { type: 'result' }>;
type Estimate = (request: HintRequest) => Promise<Result | undefined>;
// US-18.4, §4.7: the queue and worker share a deadline that shifts by hidden time.
export async function runReviewSampling(record: CompletedPlaythroughRecord, decisions: readonly DecisionAssessment[],
  entries: readonly LogEntry[], estimate: Estimate, deadline: number | (() => number), now = Date.now,
  audit?: (request: HintRequest, positionIndex: number) => void): Promise<DecisionAssessment[]> {
  const expires = typeof deadline === 'number' ? () => deadline : deadline;
  const result = [...decisions];
  for (const { decision, view, candidates } of samplingPositions(record, decisions)) {
    if (now() >= expires()) break;
    const seed = seatViewSeed(view);
    const request: HintRequest = { type: 'review', requestId: decision.positionIndex + 1,
      playthroughId: record.playthroughId, positionKey: seed, view: encodeSeatView(view), candidates,
      seed, deadline: expires(), cancellationId: `review-${decision.positionIndex}` };
    audit?.(request, decision.positionIndex);
    const response = await estimate(request);
    if (now() >= expires()) break;
    if (!response || !validHintResponse(response, candidates) || response.requestId !== request.requestId
      || response.playthroughId !== request.playthroughId || response.positionKey !== seed) continue;
    const sampling = { sourceKind: 'engine' as const, ...response.source.engine, mode: 'VISIBLE' as const,
      sampleCount: response.result.sampleCount, sampled: { qualitySource: 'sampled' as const, seed,
        seedDerivation: 'seatViewSeed' as const, sampler: response.source.sampler.name,
        samplerVersion: response.source.sampler.version, enumerated: response.result.enumerated } };
    result[result.findIndex(d => d.positionIndex === decision.positionIndex)] = sampledQuality(decision, response.result,
      sampling, followedHint(decision, record.playthroughId, entries));
  }
  return result;
}
// §4.7: use the same document visibility events and worker ownership checks as hintClient.
export function reviewSamplingClient(deadline: number,
  createWorker: () => HintWorker = () => new Worker(new URL('./hintWorker.ts', import.meta.url), { type: 'module' }),
  options: Pick<RobotHostOptions, 'clock' | 'visibility'> = {}) {
  const clock = options.clock ?? { now: () => Date.now(), setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: timer => clearTimeout(timer) };
  const visibility = options.visibility ?? {
    hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    subscribe: (callback: () => void) => {
      if (typeof document === 'undefined') return () => {};
      document.addEventListener('visibilitychange', callback);
      return () => document.removeEventListener('visibilitychange', callback);
    },
  };
  let remaining = Math.max(0, deadline - clock.now());
  let paused = true;
  let closed = false;
  let worker: HintWorker | undefined;
  let ready = false;
  let sent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { request: HintRequest; resolve: (result: Result | undefined) => void } | undefined;
  let unsubscribe = () => {};
  const expires = () => paused ? clock.now() + remaining : deadline;
  function terminate() {
    clock.clearTimeout(timer);
    const owned = worker; worker = undefined; ready = false; sent = false;
    if (owned) { owned.onmessage = null; owned.onerror = null; owned.terminate(); }
  }
  function close() {
    if (closed) return;
    closed = true; remaining = 0; deadline = clock.now();
    terminate(); unsubscribe();
    const owned = pending; pending = undefined; owned?.resolve(undefined);
  }
  function post() {
    if (closed || paused || !ready || !pending || sent) return;
    if (visibility.hidden()) { visibilityChanged(); return; }
    if (clock.now() >= deadline) { close(); return; }
    sent = true;
    try { worker!.postMessage({ ...pending.request, deadline }); } catch { close(); }
  }
  function visibilityChanged() {
    if (closed) return;
    if (visibility.hidden()) {
      if (!paused) { remaining = Math.max(0, deadline - clock.now()); paused = true; terminate(); }
      if (remaining === 0) close();
    } else if (paused) {
      if (remaining === 0) { close(); return; }
      paused = false; deadline = clock.now() + remaining;
      timer = clock.setTimeout(() => { if (visibility.hidden()) visibilityChanged(); else close(); }, remaining);
      try {
        const owned = worker = createWorker();
        owned.onerror = () => {
          if (worker !== owned || closed) return;
          if (visibility.hidden()) visibilityChanged(); else close();
        };
        owned.onmessage = ({ data }) => {
          if (worker !== owned || closed) return;
          if (visibility.hidden()) { visibilityChanged(); return; }
          if (clock.now() >= deadline) { close(); return; }
          if (!data || typeof data !== 'object') { close(); return; }
          if (data.type === 'hello') {
            if (data.protocolVersion !== HINT_PROTOCOL_VERSION) close();
            else { ready = true; post(); }
          } else if (!validHintEnvelope(data)) close();
          else if (sent && pending && data.requestId === pending.request.requestId
            && data.playthroughId === pending.request.playthroughId && data.positionKey === pending.request.positionKey) {
            const owned = pending; pending = undefined; sent = false; owned.resolve(data);
          }
        };
      } catch { close(); }
    }
  }
  const estimate: Estimate = request => {
    if (closed) return Promise.resolve(undefined);
    return new Promise(resolve => { pending = { request, resolve }; post(); });
  };
  unsubscribe = visibility.subscribe(visibilityChanged);
  visibilityChanged();
  return { estimate, close, deadline: expires };
}
// U-14: reopening review (including StrictMode remounts) never starts a second sampling run.
const runs = new WeakMap<CompletedPlaythroughRecord, Promise<DecisionAssessment[]>>();
export function reviewSampling(record: CompletedPlaythroughRecord, decisions: readonly DecisionAssessment[], entries: readonly LogEntry[], hiddenCardFound?: () => void, createClient = reviewSamplingClient) {
  let run = runs.get(record);
  if (!run) {
    const deadline = Date.now() + REVIEW_DEADLINE_MS;
    const client = createClient(deadline);
    run = runReviewSampling(record, decisions, entries, client.estimate, client.deadline, Date.now, (request, index) => {
      if (import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'test' || import.meta.env.MODE === 'internal' || import.meta.env.MODE === 'development') {
        // ADR-0001: audit against the history at the requested position, never completed visibility.
        const history = () => ({ ...record, actions: record.actions.slice(0, index) });
        const inspect = import.meta.env.MODE === 'audit' ? browserRobotAudit(history, hiddenCardFound) : robotAudit(history, hiddenCardFound);
        inspect(request, request.view.seat);
      }
    }).finally(client.close);
    runs.set(record, run);
  }
  return run;
}
