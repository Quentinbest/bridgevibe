import { encodeSeatView, seatViewSeed, type CompletedPlaythroughRecord } from '../table';
import { REVIEW_DEADLINE_MS } from '../information/parameters';
import { followedHint, sampledQuality, samplingPositions } from '../coach/sampledQuality';
import type { DecisionAssessment } from '../coach/decisionAssessment';
import type { LogEntry } from '../coach/provenance';
import { HINT_PROTOCOL_VERSION, validHintResponse, validHintEnvelope, type HintRequest, type HintResponse } from './hintProtocol';
import type { HintWorker } from './hintClient';
import { browserRobotAudit, robotAudit } from './robotAudit';

type Result = Extract<HintResponse, { type: 'result' }>;
type Estimate = (request: HintRequest) => Promise<Result | undefined>;
// US-18.4: initialization, all decisions and solver work share this wall-time deadline.
export async function runReviewSampling(record: CompletedPlaythroughRecord, decisions: readonly DecisionAssessment[],
  entries: readonly LogEntry[], estimate: Estimate, deadline: number, now = Date.now,
  audit?: (request: HintRequest, positionIndex: number) => void): Promise<DecisionAssessment[]> {
  const result = [...decisions];
  for (const { decision, view, candidates } of samplingPositions(record, decisions)) {
    if (now() >= deadline) break;
    const seed = seatViewSeed(view);
    const request: HintRequest = { type: 'review', requestId: decision.positionIndex + 1,
      playthroughId: record.playthroughId, positionKey: seed, view: encodeSeatView(view), candidates,
      seed, deadline, cancellationId: `review-${decision.positionIndex}` };
    audit?.(request, decision.positionIndex);
    const response = await estimate(request);
    if (now() >= deadline) break;
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
// §4.3.6: reuse the hint transport, with one worker and one deadline for the entire queue.
export function reviewSamplingClient(deadline: number,
  createWorker: () => HintWorker = () => new Worker(new URL('./hintWorker.ts', import.meta.url), { type: 'module' })) {
  let worker: HintWorker | undefined;
  let finish: ((result: Result | undefined) => void) | undefined;
  let ready: (() => void) | undefined;
  let failed = false;
  const close = () => { failed = true; worker?.terminate(); ready?.(); finish?.(undefined); clearTimeout(timer); };
  const timer = setTimeout(close, Math.max(0, deadline - Date.now()));
  const connected = new Promise<void>(resolve => {
    ready = resolve;
    try {
      worker = createWorker();
      worker.onerror = close;
      worker.onmessage = ({ data }) => {
        if (failed) return;
        if (!data || typeof data !== 'object') { close(); return; }
        if (data.type === 'hello') {
          if (data.protocolVersion !== HINT_PROTOCOL_VERSION) close(); else resolve();
        } else if (validHintEnvelope(data)) finish?.(data); else close();
      };
    } catch { close(); }
  });
  const estimate: Estimate = async request => {
    await connected;
    if (failed || Date.now() >= deadline) return undefined;
    return new Promise(resolve => {
      finish = data => {
        if (data && (data.requestId !== request.requestId || data.playthroughId !== request.playthroughId || data.positionKey !== request.positionKey)) return;
        finish = undefined; resolve(data);
      };
      try { worker!.postMessage(request); } catch { close(); }
    });
  };
  return { estimate, close };
}
// U-14: reopening review (including StrictMode remounts) never starts a second sampling run.
const runs = new WeakMap<CompletedPlaythroughRecord, Promise<DecisionAssessment[]>>();
export function reviewSampling(record: CompletedPlaythroughRecord, decisions: readonly DecisionAssessment[], entries: readonly LogEntry[], hiddenCardFound?: () => void) {
  let run = runs.get(record);
  if (!run) {
    const deadline = Date.now() + REVIEW_DEADLINE_MS;
    const client = reviewSamplingClient(deadline);
    run = runReviewSampling(record, decisions, entries, client.estimate, deadline, Date.now, (request, index) => {
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
