import data from './content/follow-suit.json' with { type: 'json' };
import fullData from './content/follow-suit-full.json' with { type: 'json' };
import type { Lesson } from './model';

// §4.4: trusted bundled content; automatic content validity checks belong to #15.
export function loadLesson(content: unknown): Lesson {
  const lesson = content as Lesson;
  return lesson;
}
export const followSuit = loadLesson(data);
export const fullFollowSuit = loadLesson(fullData);
export function lessonById(id: string | null): Lesson | undefined {
  return [followSuit, fullFollowSuit].find(lesson => lesson.contentId === id);
}
