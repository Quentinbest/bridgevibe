import { bridgeDdsEngine, type PositionResult, type SolverPort } from '../analysis';
import { type CompletedPlaythroughRecord } from '../table';
// §4.7: imported at completion; the solver is bundled exclusively in this worker.
export function analysisClient(record: CompletedPlaythroughRecord) {
  let worker: Worker | undefined;
  let index = 0;
  let failed = false;
  const solver: SolverPort = { ...bridgeDdsEngine,
    solveTable: async () => { throw new Error('ReviewUsesPositions'); },
    solvePosition: () => new Promise<PositionResult>((resolve, reject) => {
      if (failed) { reject(new Error('AnalysisUnavailable')); return; }
      worker ??= new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { failed = true; worker?.terminate(); worker = undefined; reject(new Error('AnalysisTimeout')); }, 30000);
      const finish = () => clearTimeout(timer);
      worker.onmessage = ({ data }: MessageEvent<{ result?: PositionResult }>) => {
        finish(); if (data.result) resolve(data.result); else reject(new Error('AnalysisFailed'));
      };
      worker.onerror = () => { finish(); failed = true; worker?.terminate(); worker = undefined; reject(new Error('AnalysisFailed')); };
      worker.postMessage({ record, index });
    }),
  };
  return { solver, at(value: number) { index = value; }, close() { worker?.terminate(); } };
}
