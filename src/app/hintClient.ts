import { encodeSeatView, seatViewSeed, type SeatView, type Card } from '../table';
import { unavailable, type HintResult } from '../analysis/hintResult';
import { HINT_DEADLINE_MS } from '../information/parameters';
import { HINT_PROTOCOL_VERSION, validHintResponse, validHintEnvelope, type HintIdentity, type HintRequest, type HintResponse, type HintSource } from './hintProtocol';
export type HintWorker = Pick<Worker, 'postMessage' | 'terminate'> & { onmessage: ((event: MessageEvent<HintResponse>) => void) | null; onerror: ((event: ErrorEvent) => void) | null };
// `source` is present only for a result the worker produced; client-side failures have none.
export type HintRunner = (view: SeatView, candidates: readonly Card[], done: (result: HintResult, durationMs: number, source?: HintSource) => void, identity: HintIdentity) => () => void;
let sequence = 0;
// U-01, US-14.12: the caller cancels this position's run on an action, toggle or teardown.
export const runHint = (view: SeatView, candidates: readonly Card[], done: (result: HintResult, durationMs: number, source?: HintSource) => void, identity: HintIdentity, createWorker: () => HintWorker = () => new Worker(new URL('./hintWorker.ts', import.meta.url), { type: 'module' })) => {
  let start = 0;
  let visibleDuration = 0;
  let worker: HintWorker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let reloads = 0;
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  function terminate() {
    clearTimeout(timer);
    const owned = worker; worker = undefined;
    if (owned) { owned.onmessage = null; owned.onerror = null; owned.terminate(); }
  }
  function cleanup() {
    terminate();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibilityChanged);
  }
  function finish(result: HintResult, source?: HintSource) {
    if (finished) return;
    finished = true; cleanup();
    done(result, visibleDuration + Date.now() - start, source);
  }
  function connect() {
    try {
      const owned = worker = createWorker();
      let ready = false;
      owned.onerror = () => {
        if (worker !== owned || finished) return;
        if (hidden()) visibilityChanged(); else finish(unavailable('worker-crash'));
      };
      owned.onmessage = ({ data }) => {
        if (worker !== owned || finished) return;
        if (hidden()) { visibilityChanged(); return; }
        // US-14.12: stale advice need not belong to this position's candidates.
        if (validHintEnvelope(data) && (data.requestId !== 1 || data.playthroughId !== identity.playthroughId || data.positionKey !== identity.positionKey)) return;
        if (!validHintResponse(data, candidates)) { finish(unavailable('error')); return; }
        if (data.type === 'hello') {
          if (ready) return;
          if (data.protocolVersion !== HINT_PROTOCOL_VERSION) {
            // US-41.3: replace a stale worker once, before sending any request.
            terminate();
            if (++reloads > 1) finish(unavailable('protocol-mismatch'));
            else { armDeadline(); connect(); }
            return;
          }
          ready = true;
          try {
            owned.postMessage({ type: 'hint', requestId: 1, ...identity, cancellationId: `hint-${++sequence}`, view: encodeSeatView(view), candidates, seed: seatViewSeed(view), deadline: start + HINT_DEADLINE_MS } satisfies HintRequest);
          } catch { finish(unavailable()); }
        } else if (ready && data.requestId === 1 && data.playthroughId === identity.playthroughId && data.positionKey === identity.positionKey) {
          if (Date.now() > start + HINT_DEADLINE_MS) finish(unavailable('timeout')); else finish(data.result, data.source);
        }
      };
    } catch { finish(unavailable()); }
  }
  function armDeadline() {
    timer = setTimeout(() => { if (hidden()) visibilityChanged(); else finish(unavailable('timeout')); }, Math.max(0, start + HINT_DEADLINE_MS - Date.now()));
  }
  function begin() {
    if (finished || hidden()) return;
    start = Date.now(); armDeadline(); connect();
  }
  function visibilityChanged() {
    if (finished) return;
    if (hidden()) {
      // §4.7: discard synchronous work while hidden; latency sums visible attempts only.
      if (worker) visibleDuration += Date.now() - start;
      terminate();
    } else if (!worker) begin();
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibilityChanged);
  begin();
  return () => { finished = true; cleanup(); };
};
