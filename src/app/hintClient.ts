import { encodeSeatView, seatViewSeed, type SeatView, type Card } from '../table';
import { unavailable, type HintResult } from '../analysis/hintResult';
import { HINT_DEADLINE_MS } from '../information/parameters';
import { HINT_PROTOCOL_VERSION, type HintRequest, type HintResponse } from './hintProtocol';
export type HintWorker = Pick<Worker, 'postMessage' | 'terminate'> & { onmessage: ((event: MessageEvent<HintResponse>) => void) | null; onerror: ((event: ErrorEvent) => void) | null };
export type HintRunner = (view: SeatView, candidates: readonly Card[], done: (result: HintResult, durationMs: number) => void) => () => void;
// U-01, US-14.12: terminate on action or deadline, including a synchronous solver that cannot yield.
export const runHint = (view: SeatView, candidates: readonly Card[], done: (result: HintResult, durationMs: number) => void, createWorker: () => HintWorker = () => new Worker(new URL('./hintWorker.ts', import.meta.url), { type: 'module' })) => {
  const start = Date.now();
  let worker: HintWorker | undefined;
  let finished = false;
  const finish = (result: HintResult) => { if (finished) return; finished = true; clearTimeout(timer); worker?.terminate(); done(result, Date.now() - start); };
  const timer = setTimeout(() => finish(unavailable('timeout')), HINT_DEADLINE_MS);
  try {
    worker = createWorker();
    worker.onerror = () => finish(unavailable());
    worker.onmessage = ({ data }) => {
      if (data.type === 'hello') {
        if (data.protocolVersion !== HINT_PROTOCOL_VERSION) { finish(unavailable()); return; }
        worker!.postMessage({ type: 'hint', requestId: 1, view: encodeSeatView(view), candidates, seed: seatViewSeed(view), deadline: start + HINT_DEADLINE_MS } satisfies HintRequest);
      } else if (data.requestId === 1) finish(Date.now() > start + HINT_DEADLINE_MS ? unavailable('timeout') : data.result);
    };
  } catch { finish(unavailable()); }
  return () => { finished = true; clearTimeout(timer); worker?.terminate(); };
};
