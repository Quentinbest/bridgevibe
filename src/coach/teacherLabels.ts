import data from './f4-labels.json' with { type: 'json' };
import type { Card } from '../table';

export type LabelSource = 'ai' | 'ai-adjudicator' | 'teacher';
export type TeacherLabel = {
  dealId: string; positionKey: string;
  graders: Record<'A' | 'B', { name: string; source: 'ai' | 'teacher' }>;
  candidates: { ref: string; cards: readonly Card[]; acceptable: boolean | null; source: LabelSource | null;
    A: { acceptable: boolean; comment: string }; B: { acceptable: boolean; comment: string };
    resolution?: { acceptable: boolean; note: string; source: LabelSource } }[];
};
// D10: draft AI labels remain distinguishable from teacher judgements.
export const teacherLabels = data as readonly TeacherLabel[];
