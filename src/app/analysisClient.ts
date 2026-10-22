import { bridgeDdsEngine, type Layout, type Position, type PositionResult, type SolverPort } from '../analysis';
import { completedRecord, startPlaythrough, type CompletedPlaythroughRecord } from '../table';
import { ANALYSIS_PROTOCOL_VERSION, type AnalysisRequest, type AnalysisResponse } from './analysisProtocol';

// §4.3.6: callers may own cancellation without inspecting transport-generated IDs.
export type AnalysisSolver = Omit<SolverPort, 'solvePosition'> & {
  solvePosition(layout: Layout, position: Position, cancellationId?: string): Promise<PositionResult>;
};
export type AnalysisWorker = Pick<Worker, 'postMessage' | 'terminate'> & {
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
export const defaultWorker = (): AnalysisWorker => new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });

// §4.7: imported at completion; the solver is bundled exclusively in this worker.
export function analysisClient(record: CompletedPlaythroughRecord, createWorker: () => AnalysisWorker = defaultWorker, timeoutMs = 30000) {
  completedRecord(record);
  // §4.3.6: obtain each historical key from the Table, never from an action-list encoding.
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide,
    gameFormat: record.gameFormat, setupEvents: record.setupEvents });
  const keys = [table.positionKey()];
  for (const entry of record.actions) {
    if (table.submit(entry.seat, entry.controller, entry.action, entry.provenance).kind === 'rejected') throw new Error('InvalidAnalysisRecord');
    keys.push(table.positionKey());
  }
  const pending = new Map<number, { request: AnalysisRequest; resolve: (result: PositionResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let worker: AnalysisWorker | undefined;
  let ready: Promise<AnalysisWorker> | undefined;
  let index = 0;
  let sequence = 0;
  let failed = false;
  let reloads = 0;
  const fail = (message = 'AnalysisUnavailable') => {
    failed = true; worker?.terminate(); worker = undefined; ready = undefined;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error(message)); }
    pending.clear();
  };
  function receive({ data }: MessageEvent<AnalysisResponse>) {
    if (data.type === 'hello') return;
    const item = pending.get(data.requestId);
    // §4.3.6: stale results and errors neither settle a request nor clear its deadline.
    if (!item || data.playthroughId !== item.request.playthroughId || data.positionKey !== item.request.positionKey) return;
    pending.delete(data.requestId); clearTimeout(item.timer);
    if (data.type === 'result') item.resolve(data.result); else item.reject(new Error('AnalysisFailed'));
  }
  // US-41.3: wait for the worker's protocol version; on a mismatch reload it once before any request.
  function connect(): Promise<AnalysisWorker> {
    ready ??= new Promise<AnalysisWorker>((resolve, reject) => {
      const owned = worker = createWorker();
      // A worker that never says hello must not hang the review (#21 owns the failure display).
      const timer = setTimeout(() => { fail(); reject(new Error('AnalysisTimeout')); }, timeoutMs);
      owned.onerror = () => { clearTimeout(timer); fail(); reject(new Error('AnalysisWorkerCrash')); };
      owned.onmessage = ({ data }) => {
        if (data.type !== 'hello') return;
        clearTimeout(timer);
        if (data.protocolVersion === ANALYSIS_PROTOCOL_VERSION) { owned.onmessage = receive; owned.onerror = () => fail('AnalysisWorkerCrash'); resolve(owned); return; }
        owned.terminate(); worker = undefined; ready = undefined;
        if (++reloads > 1) { failed = true; reject(new Error('AnalysisProtocolMismatch')); return; }
        connect().then(resolve, reject);
      };
    });
    return ready;
  }
  const solver: AnalysisSolver = { ...bridgeDdsEngine,
    solveTable: async () => { throw new Error('ReviewUsesPositions'); },
    solvePosition: async (_layout, _position, cancellationId) => {
      if (failed) throw new Error('AnalysisUnavailable');
      const requestedIndex = index;
      if (!Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex >= record.actions.length) throw new Error('InvalidAnalysisPosition');
      const connected = await connect();
      if (failed) throw new Error('AnalysisUnavailable');
      const requestId = ++sequence;
      const request: AnalysisRequest = { type: 'solve', requestId, record, index: requestedIndex,
        playthroughId: record.playthroughId, positionKey: keys[requestedIndex], deadline: Date.now() + timeoutMs,
        cancellationId: cancellationId ?? `analysis-${requestId}` };
      return new Promise<PositionResult>((resolve, reject) => {
        const timer = setTimeout(() => fail('AnalysisTimeout'), timeoutMs);
        pending.set(requestId, { request, resolve, reject, timer });
        try { connected.postMessage(request); } catch { fail('AnalysisFailed'); }
      });
    },
  };
  return { solver, at(value: number) { index = value; },
    cancel(cancellationId: string) {
      for (const [id, item] of pending) {
        if (item.request.cancellationId !== cancellationId) continue;
        pending.delete(id); clearTimeout(item.timer);
        worker?.postMessage({ type: 'cancel', cancellationId });
        item.reject(new Error('AnalysisCancelled'));
      }
    },
    close() { fail(); } };

}
