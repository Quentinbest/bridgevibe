import type { LocaleGlossary } from './types';
import { zhHans } from './zh-Hans';

export type { GlossaryEntry, LocaleGlossary } from './types';
export { normalise, avoidViolations, lengthWarnings, glossaryTerms, missingTerms } from './lint';

// I18N-09: English is the source; teacher-reviewed locale glossaries register here.
export const glossaries: Partial<Record<string, LocaleGlossary>> = { 'zh-Hans': zhHans };
