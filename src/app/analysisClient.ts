import { bridgeDdsEngine, type PositionResult, type SolverPort } from '../analysis';
import { type CompletedPlaythroughRecord } from '../table';
import { ANALYSIS_PROTOCOL_VERSION, type AnalysisRequest, type AnalysisResponse } from './analysisProtocol';

export type AnalysisWorker = Pick<Worker, 'postMessage' | 'terminate'> & {
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
const defaultWorker = (): AnalysisWorker => new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });

// §4.7: imported at completion; the solver is bundled exclusively in this worker.
export function analysisClient(record: CompletedPlaythroughRecord, createWorker: () => AnalysisWorker = defaultWorker) {
  let worker: AnalysisWorker | undefined;
  let ready: Promise<AnalysisWorker> | undefined;
  let index = 0;
  let sequence = 0;
  let failed = false;
  let reloads = 0;
  const fail = () => { failed = true; worker?.terminate(); worker = undefined; ready = undefined; };
  // US-41.3: wait for the worker's protocol version; on a mismatch reload it once before any request.
  function connect(): Promise<AnalysisWorker> {
    ready ??= new Promise<AnalysisWorker>((resolve, reject) => {
      const owned = worker = createWorker();
      // A worker that never says hello must not hang the review (#21 owns the failure display).
      const timer = setTimeout(() => { fail(); reject(new Error('AnalysisTimeout')); }, 30000);
      owned.onerror = () => { clearTimeout(timer); fail(); reject(new Error('AnalysisFailed')); };
      owned.onmessage = ({ data }) => {
        if (data.type !== 'hello') return;
        clearTimeout(timer);
        if (data.protocolVersion === ANALYSIS_PROTOCOL_VERSION) { resolve(owned); return; }
        owned.terminate(); worker = undefined; ready = undefined;
        if (++reloads > 1) { failed = true; reject(new Error('AnalysisProtocolMismatch')); return; }
        connect().then(resolve, reject);
      };
    });
    return ready;
  }
  const solver: SolverPort = { ...bridgeDdsEngine,
    solveTable: async () => { throw new Error('ReviewUsesPositions'); },
    solvePosition: async () => {
      if (failed) throw new Error('AnalysisUnavailable');
      const connected = await connect();
      const requestId = ++sequence;
      return new Promise<PositionResult>((resolve, reject) => {
        const timer = setTimeout(() => { fail(); reject(new Error('AnalysisTimeout')); }, 30000);
        connected.onmessage = ({ data }) => {
          // §4.3.6: only the response to this request counts.
          if (data.type === 'hello' || data.requestId !== requestId) return;
          clearTimeout(timer);
          if (data.type === 'result') resolve(data.result); else reject(new Error('AnalysisFailed'));
        };
        connected.onerror = () => { clearTimeout(timer); fail(); reject(new Error('AnalysisFailed')); };
        connected.postMessage({ type: 'solve', requestId, record, index } satisfies AnalysisRequest);
      });
    },
  };
  return { solver, at(value: number) { index = value; }, close() { fail(); } };
}
