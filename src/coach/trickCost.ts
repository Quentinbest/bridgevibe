import { doubleDummy, positionAt, type SolverPort } from '../analysis';
import { completedRecord, sameCard, type CompletedPlaythroughRecord } from '../table';
import { type LogEntry, type createProvenanceLog } from './provenance';

export class TrickCostFailure extends Error {
  constructor(readonly positionIndex: number, cause: unknown) {
    super('AnalysisFailed', { cause });
  }
}
export type TrickCost = { positionIndex: number; cost: number; statement: LogEntry };
export type CostWords = (cost: number, name: string, version: string) => string;
// US-17, CI-1–3: an outcome in hindsight, never a judgement of the learner's decision.
export async function trickCosts(record: CompletedPlaythroughRecord, solver: SolverPort,
  log: ReturnType<typeof createProvenanceLog>, attemptId: string, words: CostWords, arrive: (cost: TrickCost) => void,
  isCancelled: () => boolean = () => false) {
  completedRecord(record);
  for (const entry of record.actions) {
    if (isCancelled()) return;
    if (entry.controller !== 'learner' || positionAt(record, entry.index).legalCards.length < 2) continue;
    try {
      const result = await doubleDummy(solver, record, entry.index);
      if (isCancelled()) return;
      // GLOSSARY Forced Play: only Equivalent Actions remain, so this is not a Decision (US-17.2).
      if (result.classes.length < 2) continue;
      const chosen = result.classes.find(group => group.cards.some(card => sameCard(card, entry.action.card)));
      if (!chosen) throw new Error('Solver omitted chosen card');
      const cost = Math.max(...result.classes.map(group => group.tricks)) - chosen.tricks;
      const statement: LogEntry = { id: `trick-cost-${record.playthroughId}-${entry.index}-${result.name}-${result.version}-${attemptId}`,
        playthroughId: record.playthroughId, positionIndex: entry.index, kind: 'statement', summary: JSON.stringify({ cost }),
        text: words(cost, result.name, result.version), informationMode: 'ALL_HANDS', at: new Date().toISOString(),
        provenance: { sourceKind: 'engine', name: result.name, version: result.version, mode: 'ALL_HANDS', sampleCount: 0 } };
      log.record(statement);
      arrive({ positionIndex: entry.index, cost, statement });
    } catch (cause) {
      if (isCancelled()) return;
      const failureId = `${attemptId}-failure`;
      log.analysisFailed(failureId);
      // CI-4, INV-7: composition must render an abstention; never silently omit a failed position.
      throw new TrickCostFailure(entry.index, cause);
    }
  }
}
