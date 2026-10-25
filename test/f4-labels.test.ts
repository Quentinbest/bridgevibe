import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateLabels, renderLabels } from '../scripts/f4/labels';
import labelsJson from '../docs/domain/f4-draft/f4-labels.json';
import { points } from './f4/records';
import type { TeacherLabel } from '../src/coach/teacherLabels';

test('D10: committed F4 labels are in sync with both source files', async () => {
  expect(await renderLabels()).toBe(readFileSync(new URL('../src/coach/f4-labels.json', import.meta.url), 'utf8'));
});
test('D10: agreement, adjudication, unresolved disagreements, teacher sources and invalid joins', async () => {
  const labels = structuredClone(labelsJson) as unknown as Parameters<typeof generateLabels>[1];
  let result = await generateLabels(points, labels);
  expect(result[0].candidates[0]).toMatchObject({ acceptable: true, source: 'ai-adjudicator' });
  delete labels.labels[0].resolution;
  result = await generateLabels(points, labels);
  expect(result[0].candidates[0]).toMatchObject({ acceptable: null, source: null });
  labels.labels[0].B.acceptable = labels.labels[0].A.acceptable;
  result = await generateLabels(points, labels);
  expect(result[0].candidates[0].source).toBe('ai');
  labels.graders = { A: { name: 'Teacher A', source: 'teacher' }, B: { name: 'Teacher B', source: 'teacher' } } satisfies TeacherLabel['graders'];
  result = await generateLabels(points, labels);
  expect(result[0].candidates[0].source).toBe('teacher');
  labels.labels[0].dealId = 'different';
  await expect(generateLabels(points, labels)).rejects.toThrow('Invalid F4 join');
});
