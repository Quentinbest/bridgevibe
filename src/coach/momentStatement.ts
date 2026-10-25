import type { DecisionAssessment } from './decisionAssessment';

// CI-3, INV-5: the combined sentence depends on outcome, so it is always hindsight.
export function momentStatement(decision: DecisionAssessment) {
  if (!decision.verdict || !decision.outcome || (!decision.labelRef && !decision.sampling)) return undefined;
  return { templateId: `moment.${decision.verdict}-sentence` as const, informationMode: 'ALL_HANDS' as const,
    hindsightLabel: true as const, provenance: {
      quality: decision.sampling ? { ...decision.sampling, source: undefined }
        : { sourceKind: 'authored' as const, contentId: decision.labelRef!, version: 'f4-draft', source: decision.labelSource },
      outcome: decision.outcome.statement.provenance,
    } };
}

// CI-5: retain both inputs to the assessment alongside the rendered template.
export type MomentTemplate = `moment.${NonNullable<DecisionAssessment['verdict']>}`
  | `moment.${NonNullable<DecisionAssessment['verdict']>}-sentence` | 'moment.alternative' | 'review.cost-description';
export type MomentLogEntry = import('./provenance').LogEntry & {
  provenance: import('./provenance').Provenance & {
    templateId: MomentTemplate;
    quality: NonNullable<ReturnType<typeof momentStatement>>['provenance']['quality'];
    outcome: import('./provenance').Provenance;
  };
};
export function momentLogEntries(decision: DecisionAssessment, playthroughId: string,
  words: (templateId: MomentTemplate) => string): MomentLogEntry[] {
  const statement = momentStatement(decision);
  if (!statement) return [];
  const engine = statement.provenance.outcome;
  if (engine.sourceKind !== 'engine') throw new Error('Key moment requires engine provenance');
  const templates: MomentTemplate[] = [`moment.${decision.verdict!}`, statement.templateId,
    ...(decision.alternative ? ['moment.alternative' as const] : []), 'review.cost-description'];
  return templates.map(templateId => {
    const informationMode = templateId === 'moment.alternative' ? 'VISIBLE' : 'ALL_HANDS';
    const provenance = { ...(informationMode === 'ALL_HANDS' ? engine : statement.provenance.quality), templateId, ...statement.provenance };
    return { id: JSON.stringify(['key-moment', playthroughId, decision.positionIndex, templateId, provenance, decision.outcome!.cost]),
      playthroughId, positionIndex: decision.positionIndex, kind: 'statement', summary: templateId,
      text: words(templateId), informationMode, provenance, at: decision.outcome!.statement.at };
  });
}
