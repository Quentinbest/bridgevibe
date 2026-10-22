import { encodeSeatView, seatViewSeed, type SeatView, type Card } from '../table';
import { unavailable, type HintResult } from '../analysis/hintResult';
import { HINT_DEADLINE_MS } from '../information/parameters';
import { HINT_PROTOCOL_VERSION, type HintRequest, type HintResponse } from './hintProtocol';
export type HintWorker = Pick<Worker, 'postMessage' | 'terminate'> & { onmessage: ((event: MessageEvent<HintResponse>) => void) | null; onerror: ((event: ErrorEvent) => void) | null };
export type HintRunner = (view: SeatView, candidates: readonly Card[], done: (result: HintResult, durationMs: number) => void) => () => void;
// U-01, US-14.12: the caller cancels this position's run on an action, toggle or teardown.
export const runHint = (view: SeatView, candidates: readonly Card[], done: (result: HintResult, durationMs: number) => void, createWorker: () => HintWorker = () => new Worker(new URL('./hintWorker.ts', import.meta.url), { type: 'module' })) => {
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
  function finish(result: HintResult) {
    if (finished) return;
    finished = true; cleanup();
    done(result, visibleDuration + Date.now() - start);
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
            owned.postMessage({ type: 'hint', requestId: 1, view: encodeSeatView(view), candidates, seed: seatViewSeed(view), deadline: start + HINT_DEADLINE_MS } satisfies HintRequest);
          } catch { finish(unavailable()); }
        } else if (ready && data.requestId === 1) finish(Date.now() > start + HINT_DEADLINE_MS ? unavailable('timeout') : data.result);
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
