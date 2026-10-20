import type { Attempt } from './model';

// US-28.8: append-only session data; replaying a lesson adds another Attempt.
export function createAttemptStore() {
  const attempts: Attempt[] = [];
  return {
    append(attempt: Attempt) { attempts.push(Object.freeze({ ...attempt })); },
    snapshot(): readonly Attempt[] { return [...attempts]; },
  };
}
export type AttemptStore = ReturnType<typeof createAttemptStore>;
export const sessionAttempts = createAttemptStore();
