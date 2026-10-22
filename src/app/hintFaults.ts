import { unavailable, type HintResult } from '../analysis/hintResult';
import { configuredEngine } from '../analysis/solverSelection';
import { sampler } from '../information/parameters';
import { runHint, type HintRunner, type HintWorker } from './hintClient';
import { HINT_PROTOCOL_VERSION, type HintResponse } from './hintProtocol';

// US-45.1, CI-4: exercise the hint client's real timeout, protocol and crash paths.
export type HintFault = 'timeout' | 'no-layout' | 'low-confidence' | 'error' | 'worker-crash' | 'protocol-mismatch';
export function faultHintRunner(fault: HintFault): HintRunner {
  return (view, candidates, done) => runHint(view, candidates, done, () => {
    const worker: HintWorker = {
      onmessage: null, onerror: null, terminate() { clearTimeout(timer); },
      postMessage() {
        if (fault === 'timeout') return;
        const result: HintResult = fault === 'no-layout' || fault === 'low-confidence'
          ? { abstention: { reason: 'uncertain', cause: 'constraints' }, sampleCount: 0, enumerated: false }
          : unavailable('error');
        worker.onmessage?.({ data: { type: 'result', requestId: 1, result, source: { engine: configuredEngine(), sampler } } } as MessageEvent<HintResponse>);
      },
    };
    const timer = setTimeout(() => {
      if (fault === 'worker-crash') worker.onerror?.({} as ErrorEvent);
      else worker.onmessage?.({ data: { type: 'hello', protocolVersion: fault === 'protocol-mismatch' ? -1 : HINT_PROTOCOL_VERSION } } as MessageEvent<HintResponse>);
    }, 0);
    return worker;
  });
}
export function auditHintRunner(runner: HintRunner): HintRunner {
  if (typeof window === 'undefined') return runner;
  const fault = new URLSearchParams(window.location.search).get('hintFault');
  return ['timeout', 'no-layout', 'low-confidence', 'error', 'worker-crash', 'protocol-mismatch'].includes(fault ?? '') ? faultHintRunner(fault as HintFault) : runner;
}
