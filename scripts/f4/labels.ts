import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

if (import.meta.main) registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const candidate = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(candidate)) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
import type { TeacherLabel } from '../../src/coach/teacherLabels';
import type { DraftPoint } from './draft';

type Labels = { graders: TeacherLabel['graders']; labels: (Omit<TeacherLabel['candidates'][number], 'acceptable' | 'source'> & { dealId: string })[] };
// D10, US-18.9: join by stable references and verify the cards, never silently shift labels.
export async function generateLabels(decisions: DraftPoint['decision'][], labels: Labels): Promise<TeacherLabel[]> {
  const { labelPositionKey } = await import('../../src/coach/labelKey');
  let count = 0;
  const output = decisions.map((point, d) => ({ dealId: point.dealId,
    positionKey: labelPositionKey(point.positionKey.setup, point.positionKey.actions),
    graders: { A: labels.graders.A, B: labels.graders.B },
    candidates: point.candidates.map((candidate, c) => {
      const ref = `D${String(d + 1).padStart(2, '0')}-C${String(c + 1).padStart(2, '0')}`;
      const matches = labels.labels.filter(label => label.ref === ref);
      const label = matches[0];
      if (matches.length !== 1 || label.dealId !== point.dealId || JSON.stringify(label.cards) !== JSON.stringify(candidate.cards)) throw new Error(`Invalid F4 join: ${ref}`);
      count++;
      const agreed = label.A.acceptable === label.B.acceptable;
      const acceptable = agreed ? label.A.acceptable : label.resolution?.acceptable ?? null;
      const source = agreed ? (labels.graders.A.source === 'teacher' && labels.graders.B.source === 'teacher' ? 'teacher' : 'ai') : label.resolution?.source ?? null;
      return { ref, cards: candidate.cards, acceptable, source, A: label.A, B: label.B, ...(label.resolution ? { resolution: label.resolution } : {}) };
    }),
  } satisfies TeacherLabel));
  if (count !== labels.labels.length) throw new Error('Unexpected F4 labels');
  return output;
}
export async function renderLabels() {
  const read = (name: string) => JSON.parse(readFileSync(new URL(`../../docs/domain/f4-draft/${name}.json`, import.meta.url), 'utf8'));
  return JSON.stringify(await generateLabels(read('f4-decisions'), read('f4-labels')), null, 2) + '\n';
}
if (import.meta.main) writeFileSync(new URL('../../src/coach/f4-labels.json', import.meta.url), await renderLabels());
