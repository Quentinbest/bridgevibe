import type { CardClass } from './index';
// US-45.1: preserve the failure causes accepted by coach provenance (AnalysisCause).
export type HintFailureCause = 'timeout' | 'error' | 'worker-crash' | 'protocol-mismatch';
export type HintResult = { classes: CardClass[]; sampleCount: number; enumerated: boolean }
  | { abstention: ({ reason: 'uncertain'; cause: 'constraints' } | { reason: 'unavailable'; cause: HintFailureCause }); sampleCount: 0; enumerated: false };
export const unavailable = (cause: HintFailureCause = 'error'): HintResult => ({ abstention: { reason: 'unavailable', cause }, sampleCount: 0, enumerated: false });
