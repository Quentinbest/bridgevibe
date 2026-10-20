import data from './content/follow-suit.json';
import type { Lesson } from './model';

// §4.4: trusted bundled content; automatic content validity checks belong to #15.
export const followSuit = data as unknown as Lesson;
