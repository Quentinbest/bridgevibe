import { type SolverPort } from '../analysis';
import { type CompletedPlaythroughRecord } from '../table';
import { analysisClient, defaultWorker, type AnalysisWorker } from './analysisClient';

// US-45.1: reusable adapter wrappers, loaded only by internal/audit/development builds.
export function faultSolver(port: SolverPort, fault: 'timeout' | 'error', timeoutMs = 10): SolverPort {
  const fail = () => fault === 'timeout'
    ? new Promise<never>((_, reject) => { setTimeout(() => reject(new Error('AnalysisTimeout')), timeoutMs); })
    : Promise.reject(new Error('AnalysisFailed'));
  return { ...port, solvePosition: fail, solveTable: fail };
}
export function faultWorker(createWorker: () => AnalysisWorker, fault: 'crash' | 'protocol-mismatch'): () => AnalysisWorker {
  return () => {
    const owned = createWorker();
    const wrapper: AnalysisWorker = {
      onmessage: null, onerror: null,
      postMessage: message => owned.postMessage(message),
      terminate: () => owned.terminate(),
    };
    owned.onerror = event => wrapper.onerror?.(event);
    owned.onmessage = event => {
      if (event.data.type !== 'hello') { wrapper.onmessage?.(event); return; }
      if (fault === 'crash') wrapper.onerror?.({} as ErrorEvent);
      else wrapper.onmessage?.({ data: { type: 'hello', protocolVersion: -1 } } as MessageEvent);
    };
    return wrapper;
  };
}
export function auditAnalysis(record: CompletedPlaythroughRecord, client: ReturnType<typeof analysisClient>) {
  const fault = new URLSearchParams(window.location.search).get('analysisFault');
  if (fault === 'timeout' || fault === 'error') return { ...client, solver: faultSolver(client.solver, fault) };
  if (fault === 'crash' || fault === 'protocol-mismatch') {
    client.close();
    return analysisClient(record, faultWorker(defaultWorker, fault));
  }
  return client;
}
