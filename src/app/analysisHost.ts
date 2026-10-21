import { bridgeDdsEngine, type SolverPort } from '../analysis';
import { trickCosts, type TrickCost } from '../coach/trickCost';
import { type createProvenanceLog } from '../coach/provenance';
import { completedRecord, type CompletedPlaythroughRecord } from '../table';
import { text } from '../explanation';

export type AnalysisState = { running: boolean; costs: readonly TrickCost[] };
const empty: AnalysisState = { running: false, costs: [] };
const keyOf = (record: CompletedPlaythroughRecord, engine: { name: string; version: string }) =>
  JSON.stringify([record.playthroughId, record.engineVersions, engine.name, engine.version]);
export function createAnalysisHost() {
  const cache = new Map<string, AnalysisState>();
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot(record: CompletedPlaythroughRecord | null, engine: { name: string; version: string } = bridgeDdsEngine): AnalysisState { return record ? cache.get(keyOf(record, engine)) ?? empty : empty; },
    start(record: CompletedPlaythroughRecord, log: ReturnType<typeof createProvenanceLog>, fake?: SolverPort) {
      completedRecord(record);
      const key = keyOf(record, fake ?? bridgeDdsEngine);
      if (cache.has(key)) return;
      cache.set(key, { running: true, costs: [] }); publish();
      void (async () => {
        let close = () => {};
        try {
          const client = fake ? undefined : (await import('./analysisClient')).analysisClient(record);
          close = () => client?.close();
          const port = fake ?? client!.solver;
          // US-17: worker requests reference positions in the completed record only.
          const solver: SolverPort = { ...port, solvePosition(layout, position) {
            client?.at(52 - Object.values(layout).reduce((sum, cards) => sum + cards.length, 0));
            return port.solvePosition(layout, position);
          } };
          await trickCosts(record, solver, log, (cost, name, version) => text('review.cost-description', { cost, name, version }), result => {
            cache.set(key, { running: true, costs: [...cache.get(key)!.costs, result] }); publish();
          });
        } catch { /* US-17: TODO #21 — no permanent skeleton after worker startup failure. */ }
        finally { close(); cache.set(key, { ...cache.get(key)!, running: false }); publish(); }
      })();
    },
  };
}
export const analysisHost = createAnalysisHost();
