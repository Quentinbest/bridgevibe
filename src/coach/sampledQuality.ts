import { sameCard, SEATS, startPlaythrough, type Card, type CompletedPlaythroughRecord, type SeatView } from '../table';
import type { HintResult } from '../analysis/hintResult';
import { REVIEW_SAMPLE_COUNT, REVIEW_TOLERANCE } from '../information/parameters';
import { decisionVerdict, type DecisionAssessment } from './decisionAssessment';
import type { LogEntry } from './provenance';

// §4.6.5 step 3: outcome only orders work; it never establishes VISIBLE quality.
export function samplingOrder(decisions: readonly DecisionAssessment[]) {
  return decisions.filter(d => !d.labelled && d.qualitySource !== 'teacher-label' && d.outcome
    && (d.outcome.cost > 0 || d.outcome.candidatesDiffered))
    .sort((a, b) => Number(b.outcome!.cost > 0) - Number(a.outcome!.cost > 0)
      || a.trick - b.trick || a.positionIndex - b.positionIndex);
}
export type SamplingPosition = { decision: DecisionAssessment; view: SeatView; candidates: readonly Card[] };
// ADR-0001: rebuild the historical Table view, including Declarer's view when playing Dummy.
export function samplingPositions(record: CompletedPlaythroughRecord, decisions: readonly DecisionAssessment[]): SamplingPosition[] {
  const ordered = samplingOrder(decisions);
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide,
    gameFormat: record.gameFormat, setupEvents: record.setupEvents });
  const dummy = SEATS[(SEATS.indexOf(record.contract.declarer) + 2) % 4];
  const positions = new Map<number, SamplingPosition>();
  for (const entry of record.actions) {
    const decision = ordered.find(d => d.positionIndex === entry.index);
    if (decision) positions.set(entry.index, { decision,
      view: table.seatView(entry.seat === dummy ? record.contract.declarer : entry.seat),
      candidates: table.legalActions(entry.seat).map(action => action.card) });
    if (table.submit(entry.seat, entry.controller, entry.action, entry.provenance).kind !== 'accepted') throw new Error('Invalid review record');
  }
  return ordered.map(d => positions.get(d.positionIndex)!);
}
// US-18.8: only a displayed tier (c) statement is evidence of advice, never speculative work.
export function followedHint(decision: DecisionAssessment, playthroughId: string, entries: readonly LogEntry[]) {
  return entries.some(entry => entry.playthroughId === playthroughId && entry.positionIndex === decision.positionIndex
    && entry.summary === 'hint.advice' && entry.informationMode === 'VISIBLE' && !entry.abstention
    && entry.provenance.sourceKind === 'engine'
    && entry.provenance.hint?.advisedClass?.some(card => sameCard(card, decision.card)));
}
export function sampledQuality(decision: DecisionAssessment, result: HintResult,
  sampling: NonNullable<DecisionAssessment['sampling']>, hintFollowed: boolean): DecisionAssessment {
  if (decision.labelled || decision.qualitySource === 'teacher-label') return decision;
  const chosen = 'classes' in result ? result.classes.find(group => group.cards.some(card => sameCard(card, decision.card))) : undefined;
  let acceptable: boolean | null = chosen && 'classes' in result && (result.enumerated || result.sampleCount >= REVIEW_SAMPLE_COUNT)
    ? Math.max(...result.classes.map(group => group.tricks)) - chosen.tricks <= REVIEW_TOLERANCE : null;
  const close = acceptable === false && hintFollowed;
  if (close) acceptable = null;
  return { ...decision, qualitySource: 'sampled', sampling, hintFollowed: close,
    quality: acceptable === null ? 'uncertain' : acceptable ? 'acceptable' : 'not-acceptable',
    verdict: decisionVerdict(acceptable, decision.outcome?.cost),
    alternative: acceptable === false && 'classes' in result
      ? result.classes.reduce((a, b) => a.tricks >= b.tricks ? a : b).cards[0] : undefined };
}
export function qualityTemplate(decision: DecisionAssessment) {
  return decision.hintFollowed ? 'moment.hint-close' as const : `moment.sampled-${decision.quality}` as const;
}
// CI-5: log each displayed quality once, separately from ALL_HANDS outcome sentences.
export function sampledQualityEntry(decision: DecisionAssessment, playthroughId: string, words: string): LogEntry | undefined {
  if (!decision.sampling) return undefined;
  const templateId = qualityTemplate(decision);
  return { id: `sampled-quality-${playthroughId}-${decision.positionIndex}`, playthroughId, positionIndex: decision.positionIndex,
    kind: 'statement', summary: templateId, text: words, informationMode: 'VISIBLE', provenance: decision.sampling,
    ...(decision.quality === 'uncertain' ? { abstention: { reason: 'uncertain', cause: decision.hintFollowed ? 'hint-conflict' : 'sample-confidence' } as const } : {}),
    at: decision.outcome!.statement.at };
}
