import { expect, test } from 'vitest';
import { completedRecord, startPlaythrough } from '../table';
import { assessDecisions, decisionVerdict, keyMoments, type DecisionAssessment } from './decisionAssessment';
import { teacherLabels } from './teacherLabels';
import { labelPositionKey } from './labelKey';
import { momentStatement } from './momentStatement';
import { f4Position, finish, points } from '../../test/f4/records';
import type { TrickCost } from './trickCost';

export const costAt = (positionIndex: number, cost: number): TrickCost => ({ positionIndex, cost,
  statement: { id: `cost-${positionIndex}`, playthroughId: 'test', positionIndex, kind: 'statement', summary: 'cost',
    text: `Trick cost: ${cost}. X-ray view: with all cards visible`, informationMode: 'ALL_HANDS', at: '2026-10-25T00:00:00Z',
    provenance: { sourceKind: 'engine', name: 'test', version: '1', mode: 'ALL_HANDS', sampleCount: 0 } } });

test.each([
  [true, 0, 'sound'], [true, 2, 'unlucky'], [false, 0, 'lucky'], [false, 2, 'mistake'],
  [null, 0, undefined], [null, 2, undefined], [true, undefined, undefined], [false, undefined, undefined],
] as const)('CI-3: quality %s and cost %s give %s', (quality, cost, verdict) => {
  expect(decisionVerdict(quality, cost)).toBe(verdict);
});

test('US-18.9: exact setup/actions match; a different earlier line gives no label', () => {
  const point = points[0];
  const record = finish(f4Position(point), point.candidates[0].cards[0]);
  expect(assessDecisions(record, [costAt(3, 1)]).find(d => d.positionIndex === 3)).toMatchObject({ quality: 'acceptable', verdict: 'unlucky', labelSource: 'ai-adjudicator' });
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide,
    gameFormat: record.gameFormat, setupEvents: record.setupEvents });
  // US-18.9: a legal alternate opening lead preserves the action count, but not the position.
  expect(table.submit('west', 'robot', { kind: 'play-card', card: { suit: 'hearts', rank: '6' } },
    { kind: 'authored', contentId: 'alternate-line', version: 1 }).kind).toBe('accepted');
  const altered = finish(table, table.legalActions('north')[0].card);
  expect(assessDecisions(altered, [costAt(3, 1)]).every(d => d.quality === 'uncertain' && !d.verdict)).toBe(true);
  const changedSetup = completedRecord({ ...record, setupEvents: [] });
  expect(assessDecisions(changedSetup, [costAt(3, 1)]).find(d => d.positionIndex === 3)?.quality).toBe('uncertain');
  const reserialized = JSON.parse(JSON.stringify(record));
  reserialized.actions[0].provenance.durationMs = 27;
  expect(assessDecisions(completedRecord(reserialized), [costAt(3, 1)]).find(d => d.positionIndex === 3)?.verdict).toBe('unlucky');
});

test('US-18.1–4: forced plays, unresolved/missing labels, unavailable outcome and completion guard', () => {
  const record = finish(f4Position(points[0]), points[0].candidates[0].cards[0]);
  const labels = structuredClone(teacherLabels);
  labels[0].candidates[0].acceptable = null;
  labels[0].candidates[0].source = null;
  const uncertain = assessDecisions(record, [costAt(3, 2)], labels).find(d => d.positionIndex === 3)!;
  expect(uncertain).toMatchObject({ quality: 'uncertain', outcome: { cost: 2 } });
  expect(uncertain.verdict).toBeUndefined(); expect(momentStatement(uncertain)).toBeUndefined();
  const unavailable = assessDecisions(record, []).find(d => d.positionIndex === 3)!;
  expect(unavailable.quality).toBe('acceptable'); expect(unavailable.outcome).toBeUndefined(); expect(unavailable.verdict).toBeUndefined();
  expect(keyMoments([uncertain, unavailable])).toEqual([]);
  const allLabels = record.actions.map(entry => ({ ...labels[0], positionKey: labelPositionKey(record.setupEvents!, record.actions.slice(0, entry.index)),
    candidates: [{ ...labels[0].candidates[0], cards: [entry.action.card], acceptable: false }] }));
  const assessed = assessDecisions(record, record.actions.map(e => costAt(e.index, 1)), allLabels);
  expect(assessed.every(d => d.positionIndex < 48)).toBe(true);
  expect(assessed.every(d => record.actions[d.positionIndex].controller === 'learner')).toBe(true);
  expect(() => assessDecisions({ ...record, status: 'in-progress' } as never, [])).toThrow('completed');
});

test('§4.6.5: priority, cost, earlier trick, three maximum, lesson-only sound', () => {
  const decision = (verdict: DecisionAssessment['verdict'], index: number, cost: number): DecisionAssessment => ({
    positionIndex: index, trick: Math.floor(index / 4) + 1, card: { suit: 'hearts', rank: 'A' },
    quality: 'acceptable', labelRef: 'D01-C01', verdict, outcome: costAt(index, cost) });
  const sound = decision('sound', 0, 0), lucky = decision('lucky', 4, 0), unlucky = decision('unlucky', 8, 3);
  const early = decision('mistake', 12, 1), late = decision('mistake', 16, 1), costly = decision('mistake', 20, 2);
  expect(keyMoments([sound, unlucky, late, lucky, costly, early])).toEqual([costly, early, late]);
  expect(keyMoments([sound, lucky, unlucky])).toEqual([unlucky, lucky]);
  expect(keyMoments([sound, lucky, unlucky], [0])).toEqual([unlucky, lucky, sound]);
  expect(keyMoments([sound, early, lucky, unlucky], [0])).toEqual([early, unlucky, lucky]);
});
