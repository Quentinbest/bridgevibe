import { bridgeDdsEngine, type SolverPort } from '../analysis';
import { trickCosts, TrickCostFailure, type TrickCost } from '../coach/trickCost';
import { type LogEntry, type AnalysisCause, type createProvenanceLog } from '../coach/provenance';
import { completedRecord, type CompletedPlaythroughRecord } from '../table';
import { text } from '../explanation';

export type AnalysisState = { running: boolean; costs: readonly TrickCost[]; abstention?: LogEntry };
const empty: AnalysisState = { running: false, costs: [] };
const keyOf = (record: CompletedPlaythroughRecord, engine: { name: string; version: string }) =>
  JSON.stringify([record.playthroughId, record.engineVersions, engine.name, engine.version]);
export function createAnalysisHost(createClient?: (record: CompletedPlaythroughRecord) => ReturnType<typeof import('./analysisClient').analysisClient>) {
  const cache = new Map<string, AnalysisState>();
  let attempt = 0;
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot(record: CompletedPlaythroughRecord | null, engine: { name: string; version: string } = bridgeDdsEngine): AnalysisState { return record ? cache.get(keyOf(record, engine)) ?? empty : empty; },
    retry(record: CompletedPlaythroughRecord, log: ReturnType<typeof createProvenanceLog>, fake?: SolverPort) {
      const key = keyOf(record, fake ?? bridgeDdsEngine);
      if (!cache.get(key)?.abstention) return () => {};
      cache.delete(key);
      return this.start(record, log, fake);
    },
    // Returns a cancel function: a replaced deal stops its analysis and frees the worker.
    start(record: CompletedPlaythroughRecord, log: ReturnType<typeof createProvenanceLog>, fake?: SolverPort): () => void {
      completedRecord(record);
      const key = keyOf(record, fake ?? bridgeDdsEngine);
      if (cache.has(key)) return () => {};
      // VAL-06: one identity per run, independent of interleaved provenance writes.
      const attemptId = `analysis-${record.playthroughId}-${++attempt}`;
      const failureId = `${attemptId}-failure`;
      cache.set(key, { running: true, costs: [] }); publish();
      let cancelled = false;
      let close = () => {};
      void (async () => {
        try {
          let client = fake ? undefined : createClient ? createClient(record) : (await import('./analysisClient')).analysisClient(record);
          let port = fake ?? client!.solver;
          if (!fake && (import.meta.env.MODE === 'internal' || import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'development')) {
            const { auditAnalysis } = await import('./analysisFaults');
            const injected = auditAnalysis(record, client!);
            client = injected;
            port = injected.solver;
            close = injected.close;
          } else close = () => client?.close();
          if (cancelled) { close(); return; }
          // US-17: worker requests reference positions in the completed record only.
          const solver: SolverPort = { ...port, async solvePosition(layout, position) {
            client?.at(52 - Object.values(layout).reduce((sum, cards) => sum + cards.length, 0));
            try { return await port.solvePosition(layout, position); }
            catch (error) {
              // VAL-06: observe at the adapter seam, even if a consumer were to swallow the error.
              if (!cancelled) log.analysisFailed(failureId);
              throw error;
            }
          } };
          await trickCosts(record, solver, log, attemptId, (cost, name, version) => text('review.cost-description', { cost, name, version }), result => {
            if (!cancelled) { cache.set(key, { running: true, costs: [...cache.get(key)!.costs, result] }); publish(); }
          }, () => cancelled);
        } catch (error) {
          if (cancelled) return;
          const failure = error instanceof TrickCostFailure ? error : undefined;
          const causeError = failure?.cause ?? error;
          const causes: Record<string, AnalysisCause> = { AnalysisTimeout: 'timeout', AnalysisWorkerCrash: 'worker-crash', AnalysisProtocolMismatch: 'protocol-mismatch' };
          const cause = causeError instanceof Error ? causes[causeError.message] ?? 'error' : 'error';
          log.analysisFailed(failureId);
          const abstention: LogEntry = { id: failureId, playthroughId: record.playthroughId, positionIndex: failure?.positionIndex ?? 0,
            kind: 'statement', summary: JSON.stringify({ reason: 'unavailable', cause }), abstention: { reason: 'unavailable', cause },
            text: text('review.unavailable'), informationMode: 'ALL_HANDS', at: new Date().toISOString(),
            provenance: { sourceKind: 'engine', name: (fake ?? bridgeDdsEngine).name, version: (fake ?? bridgeDdsEngine).version, mode: 'ALL_HANDS', sampleCount: 0 } };
          log.record(abstention);
          cache.set(key, { ...cache.get(key)!, abstention });
        }
        finally { close(); if (!cancelled) { cache.set(key, { ...cache.get(key)!, running: false }); publish(); } }
      })();
      return () => {
        if (cancelled || !cache.get(key)?.running) return;
        // An unfinished analysis is dropped, not cached half-done.
        cancelled = true; close(); cache.delete(key); publish();
      };
    },
  };
}
export const analysisHost = createAnalysisHost();
