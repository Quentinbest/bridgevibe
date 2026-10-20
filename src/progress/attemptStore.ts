import type { Attempt, AttemptSink } from '../curriculum/model';

// §4.2, US-28.8: progress owns the session Attempts store (V: memory only). Append-only:
// replaying a lesson adds another Attempt.
export function createAttemptStore(): AttemptSink & { snapshot(): readonly Attempt[] } {
  const attempts: Attempt[] = [];
  return {
    append(attempt: Attempt) { attempts.push(Object.freeze({ ...attempt })); },
    snapshot(): readonly Attempt[] { return [...attempts]; },
  };
}
export type AttemptStore = ReturnType<typeof createAttemptStore>;
export const sessionAttempts = createAttemptStore();
