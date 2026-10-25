import { writeFileSync } from 'node:fs';
import { momentStatement } from '../src/coach/momentStatement';
import { expect, test } from 'vitest';
import { bridgeDdsAdapter } from '../src/analysis/bridgeDdsAdapter';
import { trickCosts, type TrickCost } from '../src/coach/trickCost';
import { assessDecisions } from '../src/coach/decisionAssessment';
import { teacherLabels } from '../src/coach/teacherLabels';
import { createProvenanceLog } from '../src/coach/provenance';
import { text } from '../src/explanation';
import { f4Position, finish, points } from './f4/records';

test('VAL-07: real F4 replay, principles robots, DDS and decision assessments', async () => {
  const started = performance.now();
  const excluded: string[] = [];
  let losing = 0, candidates = 0;
  const losingPoints = new Set<string>();
  for (const [index, point] of points.entries()) {
    const labels = teacherLabels[index];
    if (labels.candidates.some(c => c.acceptable === null)) { excluded.push(point.dealId); continue; }
    for (const candidate of labels.candidates) {
      const record = finish(f4Position(point), candidate.cards[0]);
      const log = createProvenanceLog();
      const costs: TrickCost[] = [];
      await trickCosts(record, bridgeDdsAdapter, log, 'val-07',
        (cost, name, version) => text('review.cost-description', { cost, name, version }), cost => costs.push(cost));
      const assessed = assessDecisions(record, costs).find(d => d.positionIndex === point.positionKey.actions.length)!;
      expect(assessed, candidate.ref).toBeDefined();
      expect(assessed.labelRef).toBe(candidate.ref);
      expect(assessed.outcome).toBeDefined();
      if (candidate.acceptable) {
        expect(assessed.verdict).not.toBe('mistake');
        if (assessed.outcome!.cost > 0) {
          expect(assessed.verdict).toBe('unlucky'); losing++; losingPoints.add(point.dealId);
        }
      }
      for (const statement of log.entries().filter(s => s.informationMode === 'ALL_HANDS')) expect(statement.text).toContain(text('review.hindsight'));
      const statement = momentStatement(assessed);
      if (statement) {
        expect(statement.informationMode).toBe('ALL_HANDS');
        expect(statement.hindsightLabel).toBe(true);
        expect(statement.provenance.quality.source).toBe(candidate.source);
        expect(text(statement.templateId)).toBeTruthy();
      }
      candidates++;
    }
  }
  console.log(`VAL-07: ${candidates} candidates; ${losing} correct-play-loses candidates across ${losingPoints.size} points; excluded unresolved points: ${excluded.join(', ') || 'none'}; ${(performance.now() - started).toFixed(0)} ms. Labels from AI annotators; teacher review pending, #100.`);
  if (process.env.F4_REPORT === '1') writeFileSync(new URL('../docs/reports/val-07.md', import.meta.url),
    `# VAL-07: key moments (#26)

Labels from AI annotators; teacher review pending, #100. Disagreements use AI adjudication (D10).

- ${points.length} F4 decision points; ${candidates} labelled candidate classes.
- Excluded unresolved points: ${excluded.join(', ') || 'none'}.
- Acceptable candidates assessed as mistakes: 0.
- Correct-play-loses: ${losing} candidates across ${losingPoints.size} distinct points.
- Every ALL_HANDS output carries the hindsight label.
- Real Table replay, principlesPolicy robots, first-legal learner continuation, bridge-dds 1.4.0 / DDS 2.9.
- Runtime: ${((performance.now() - started) / 1000).toFixed(2)} seconds.

Regenerate: F4_REPORT=1 npx vitest run --project node test/f4.test.ts
`);
  expect(losing).toBeGreaterThanOrEqual(5);
  expect(losingPoints.size).toBeGreaterThanOrEqual(5);
}, 120_000);
