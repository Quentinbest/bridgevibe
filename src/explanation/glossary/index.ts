import type { LocaleGlossary } from './types';
import { es } from './es';
import { ja } from './ja';
import { zhHans } from './zh-Hans';
import { zhHant } from './zh-Hant';

export type { GlossaryEntry, LocaleGlossary } from './types';
export { normalise, avoidViolations, lengthWarnings, glossaryTerms, missingTerms } from './lint';

// I18N-09: English is the source; draft and signed locale glossaries register here.
export const glossaries: Partial<Record<string, LocaleGlossary>> = {
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ja,
  es,
};
