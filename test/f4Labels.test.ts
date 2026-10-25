import { expect, test } from 'vitest';
import decisions from '../docs/domain/f4-draft/f4-decisions.json';
import labels from '../docs/domain/f4-draft/f4-labels.json';

// PRD D10, US-18.5: every F4 candidate has both graders' labels with a declared source, and
// every disagreement without a resolution is listed as unresolved (excluded from VAL-07).
test('F4 labels cover every candidate in order, with sourced graders and listed disagreements', () => {
  const expected = decisions.flatMap((decision, d) => decision.candidates.map((candidate, c) => ({
    ref: `D${String(d + 1).padStart(2, '0')}-C${String(c + 1).padStart(2, '0')}`, dealId: decision.dealId, cards: candidate.cards })));
  expect(labels.labels.map(l => ({ ref: l.ref, dealId: l.dealId, cards: l.cards }))).toEqual(expected);
  for (const grader of ['A', 'B'] as const) expect(['ai', 'teacher']).toContain(labels.graders[grader].source);
  for (const label of labels.labels) for (const grader of ['A', 'B'] as const) expect(typeof label[grader].acceptable).toBe('boolean');
  const unresolved = labels.labels.filter(l => l.A.acceptable !== l.B.acceptable && !l.resolution).map(l => l.ref);
  expect(labels.summary.unresolved).toEqual(unresolved);
  expect(labels.summary).toMatchObject({ candidates: expected.length, disagreed: unresolved.length, agreed: expected.length - unresolved.length });
});
