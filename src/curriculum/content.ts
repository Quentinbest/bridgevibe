import data from './content/follow-suit.json';
import type { Lesson } from './model';

// §4.4: trusted bundled content; automatic content validity checks belong to #15.
export function loadLesson(content: unknown): Lesson {
  const lesson = content as Lesson;
  // US-02, ADR-0003: the lesson screen projects South's Seat View, so exercises declare from South
  // until the table turns for other declarers (#16).
  for (const exercise of lesson.exercises) {
    if (exercise.contract.declarer !== 'south') throw new Error(`Exercise ${exercise.contentId} must be declared by South until #16`);
  }
  return lesson;
}
export const followSuit = loadLesson(data);
