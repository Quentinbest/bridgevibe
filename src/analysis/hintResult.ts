import type { CardClass } from './index';
export type HintResult = { classes: CardClass[]; sampleCount: number; enumerated: boolean }
  | { abstention: ({ reason: 'uncertain'; cause: 'constraints' } | { reason: 'unavailable'; cause: 'timeout' | 'error' }); sampleCount: 0; enumerated: false };
export const unavailable = (cause: 'timeout' | 'error' = 'error'): HintResult => ({ abstention: { reason: 'unavailable', cause }, sampleCount: 0, enumerated: false });
