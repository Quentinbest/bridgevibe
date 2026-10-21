import type { Contract } from './playthrough';

// PLACEHOLDER (DEP-01): no slam objective until the rules specification arrives.
export const OBJECTIVES = ['part-score', 'game'] as const;
export type Objective = typeof OBJECTIVES[number];
// PLACEHOLDER (DEP-01): vulnerability is unused (A-03); scoring belongs to #17.
export const MINI_BRIDGE_USES_VULNERABILITY = false;
export function trickTarget(strain: Contract['strain'], objective: Objective): number {
  // PLACEHOLDER (DEP-01): part-score requires seven tricks in every strain.
  if (objective === 'part-score') return 7;
  // PLACEHOLDER (DEP-01): game requires 9 in NT, 10 in a major, 11 in a minor.
  return strain === 'no-trumps' ? 9 : strain === 'hearts' || strain === 'spades' ? 10 : 11;
}
