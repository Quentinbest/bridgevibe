import { completedRecord, sameCard, SEATS, startPlaythrough, type Card, type CompletedPlaythroughRecord } from '../table';
import { visibleClasses } from '../analysis/sampledEstimate';
import type { TrickCost } from './trickCost';
import { labelPositionKey } from './labelKey';
import { teacherLabels, type TeacherLabel, type LabelSource } from './teacherLabels';

export type Verdict = 'sound' | 'unlucky' | 'lucky' | 'mistake';
export type DecisionAssessment = {
  positionIndex: number; trick: number; card: Card;
  quality: 'acceptable' | 'not-acceptable' | 'uncertain';
  qualitySource?: 'teacher-label' | 'sampled'; labelled?: boolean;
  sampling?: Extract<import('./provenance').Provenance, { sourceKind: 'engine' }>; hintFollowed?: boolean; labelSource?: LabelSource; labelRef?: string;
  outcome?: TrickCost; verdict?: Verdict; alternative?: Card;
};
// INV-9, CI-3: missing quality OR outcome means no verdict.
export function decisionVerdict(acceptable: boolean | null, cost?: number): Verdict | undefined {
  if (acceptable === null || cost === undefined) return undefined;
  return acceptable ? cost > 0 ? 'unlucky' : 'sound' : cost > 0 ? 'mistake' : 'lucky';
}
export function assessDecisions(record: CompletedPlaythroughRecord, costs: readonly TrickCost[], labels: readonly TeacherLabel[] = teacherLabels): DecisionAssessment[] {
  completedRecord(record);
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide,
    gameFormat: record.gameFormat, setupEvents: record.setupEvents });
  const dummy = SEATS[(SEATS.indexOf(record.contract.declarer) + 2) % 4];
  const assessments: DecisionAssessment[] = [];
  for (const entry of record.actions) {
    const view = table.seatView(entry.seat === dummy ? record.contract.declarer : entry.seat);
    if (entry.controller === 'learner' && visibleClasses(view, table.legalActions(entry.seat).map(a => a.card)).length > 1) {
      const key = labelPositionKey(record.setupEvents ?? [], record.actions.slice(0, entry.index));
      const point = labels.find(label => label.dealId === record.deal.dealId && label.positionKey === key);
      const label = point?.candidates.find(candidate => candidate.cards.some(card => sameCard(card, entry.action.card)));
      const acceptable = label?.acceptable ?? null;
      const outcome = costs.find(cost => cost.positionIndex === entry.index);
      assessments.push({ positionIndex: entry.index, trick: Math.floor(entry.index / 4) + 1, card: entry.action.card,
        quality: acceptable === null ? 'uncertain' : acceptable ? 'acceptable' : 'not-acceptable',
        ...(acceptable !== null ? { qualitySource: 'teacher-label', labelSource: label!.source!, labelRef: label!.ref } as const : {}),
        ...(point ? { labelled: true } : {}),
        outcome, verdict: decisionVerdict(acceptable, outcome?.cost),
        alternative: acceptable === false ? point?.candidates.find(candidate => candidate.acceptable === true)?.cards[0] : undefined });
    }
    if (table.submit(entry.seat, entry.controller, entry.action, entry.provenance).kind !== 'accepted') throw new Error('Invalid review record');
  }
  return assessments;
}
// §4.6.5: practice supplies no teaching points. Stable action order breaks ties within a trick.
export function keyMoments(decisions: readonly DecisionAssessment[], teachingPoints: readonly number[] = []): DecisionAssessment[] {
  const priority: Record<Verdict, number> = { mistake: 0, unlucky: 1, lucky: 2, sound: 3 };
  return decisions.filter(d => d.verdict && (d.verdict !== 'sound' || teachingPoints.includes(d.positionIndex)))
    .sort((a, b) => priority[a.verdict!] - priority[b.verdict!] || b.outcome!.cost - a.outcome!.cost
      || a.trick - b.trick || a.positionIndex - b.positionIndex).slice(0, 3);
}
