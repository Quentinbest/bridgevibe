import type { Contract } from './playthrough';

// DEP-01 Laws 9–17: standard objectives exclude slam.
export const OBJECTIVES = ['part-score', 'game'] as const;
export type Objective = typeof OBJECTIVES[number];
// DEP-01 S5: standard MiniBridge does not use vulnerability.
export const MINI_BRIDGE_USES_VULNERABILITY = false;
export function trickTarget(strain: Contract['strain'], objective: Objective): number {
  // DEP-01 Law 10: part-score requires seven tricks in every strain.
  if (objective === 'part-score') return 7;
  // DEP-01 Law 10: game requires 9 in NT, 10 in a major, 11 in a minor.
  return strain === 'no-trumps' ? 9 : strain === 'hearts' || strain === 'spades' ? 10 : 11;
}
