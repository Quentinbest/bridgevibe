import type { DecisionAssessment } from './decisionAssessment';
import type { LogEntry, Provenance } from './provenance';

type UncertainQualityEntry = LogEntry & {
  provenance: { sourceKind: 'template'; templateId: 'moment.uncertain';
    quality: { source: 'no-label' }; outcome: Provenance };
};
// US-18.4, CI-5: absence of a label is a VISIBLE abstention, not a solver judgement.
export function uncertainQualityEntry(decision: DecisionAssessment, playthroughId: string, words: string): UncertainQualityEntry | undefined {
  if (decision.quality !== 'uncertain' || !decision.outcome) return undefined;
  const provenance: UncertainQualityEntry['provenance'] = { sourceKind: 'template', templateId: 'moment.uncertain',
    quality: { source: 'no-label' }, outcome: decision.outcome.statement.provenance };
  return { id: JSON.stringify(['uncertain-quality', playthroughId, decision.positionIndex, provenance]),
    playthroughId, positionIndex: decision.positionIndex, kind: 'statement', summary: 'moment.uncertain', text: words,
    informationMode: 'VISIBLE', abstention: { reason: 'uncertain', cause: 'no-label' }, provenance,
    at: decision.outcome.statement.at };
}
