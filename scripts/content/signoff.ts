import { createHash } from 'node:crypto';
import type { Lesson } from '../../src/curriculum/model.js';
import type { Entry } from '../../src/explanation/types.js';
import { parityErrors } from '../../src/explanation/parity.js';
import { avoidViolations, missingTerms } from '../../src/explanation/glossary/lint.js';
import type { LocaleGlossary } from '../../src/explanation/glossary/types.js';
import { lessonTextRefs, validateLesson } from '../../src/pipeline/validate.js';

export type SignOffSource = 'human' | 'ai-draft';
export type IntegrityChecklist = Readonly<{
  certaintyPreserved: boolean;
  hindsightLabelPreserved: boolean;
}>;
export type EntrySignOffRecord = Readonly<{
  kind: 'entry';
  contentId: string;
  version: number;
  locale: string;
  source: SignOffSource;
  sourceHash: string;
  aiDraftConfirmed?: boolean;
  integrityChecklist?: IntegrityChecklist;
  backTranslation?: string;
  reviewer: string;
  date: string;
}>;
export type LessonSignOffRecord = Readonly<{
  kind: 'lesson';
  contentId: string;
  version: number;
  locale: string;
  lessonCardNamesConfirmed: boolean;
  reviewer: string;
  date: string;
}>;
export type GlossarySignOffRecord = Readonly<{
  kind: 'glossary';
  contentId: string;
  version: number;
  locale: string;
  source: SignOffSource;
  aiDraftConfirmed?: boolean;
  reviewer: string;
  date: string;
}>;
export type SignOffRecord = EntrySignOffRecord | LessonSignOffRecord | GlossarySignOffRecord;
export type SignOffStore = Readonly<{ schemaVersion: 1; records: readonly SignOffRecord[] }>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_HASH = /^sha256:[0-9a-f]{64}$/;
const LOCALE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const positiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

// E-01: hash the English entry text so any source edit marks signed translations stale.
export function entrySourceHash(englishText: string): string {
  return `sha256:${createHash('sha256').update(englishText, 'utf8').digest('hex')}`;
}

// I18N-11.1, Q2: explicit owner-controlled shipped-locale list; en is always present and en-XA never ships.
export function validateShippedLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) return ['shipped-locales.json must be a JSON array of locale tags.'];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!nonempty(item) || !LOCALE_TAG.test(item)) {
      errors.push(`Invalid locale tag in shipped-locales.json: ${String(item)}`);
      continue;
    }
    if (item === 'en-XA') errors.push('I18N-23.1: pseudo-locale en-XA cannot appear in shipped-locales.json.');
    if (seen.has(item)) errors.push(`Duplicate locale in shipped-locales.json: ${item}`);
    seen.add(item);
  }
  if (!seen.has('en')) errors.push('shipped-locales.json must include source locale "en".');
  return errors;
}

// I18N-13, I18N-14: validate every sign-off record's schema regardless of whether its locale ships yet.
export function validateSignOffRecord(value: unknown, index: number): string[] {
  const prefix = `sign-offs[${index}]`;
  if (!isRecord(value)) return [`${prefix}: record must be an object.`];
  const errors: string[] = [];
  const kind = value.kind;
  if (kind !== 'entry' && kind !== 'lesson' && kind !== 'glossary') {
    return [`${prefix}: kind must be "entry", "lesson", or "glossary".`];
  }
  if (!nonempty(value.contentId)) errors.push(`${prefix}: contentId must be a non-empty string.`);
  if (!positiveInt(value.version)) errors.push(`${prefix}: version must be a positive safe integer.`);
  if (!nonempty(value.locale) || !LOCALE_TAG.test(value.locale)) errors.push(`${prefix}: locale must be a valid BCP 47 tag.`);
  if (!nonempty(value.reviewer)) errors.push(`${prefix}: reviewer must be a non-empty string.`);
  if (!nonempty(value.date) || !ISO_DATE.test(value.date)) errors.push(`${prefix}: date must be an ISO YYYY-MM-DD date.`);

  if (kind === 'entry' || kind === 'glossary') {
    if (value.source !== 'human' && value.source !== 'ai-draft') {
      errors.push(`${prefix}: source must be "human" or "ai-draft" (I18N-13).`);
    }
    if (value.source === 'ai-draft' && value.aiDraftConfirmed !== true) {
      errors.push(`${prefix}: ai-draft sign-off requires aiDraftConfirmed: true (I18N-13).`);
    }
  }
  if (kind === 'entry') {
    if (!nonempty(value.sourceHash) || !SHA256_HASH.test(value.sourceHash)) {
      errors.push(`${prefix}: entry sign-off requires a sha256 sourceHash (E-01).`);
    }
    if (value.integrityChecklist !== undefined) {
      if (!isRecord(value.integrityChecklist)
        || typeof value.integrityChecklist.certaintyPreserved !== 'boolean'
        || typeof value.integrityChecklist.hindsightLabelPreserved !== 'boolean') {
        errors.push(`${prefix}: integrityChecklist must specify boolean certaintyPreserved and hindsightLabelPreserved.`);
      }
    }
  }
  if (kind === 'lesson' && value.lessonCardNamesConfirmed !== true) {
    errors.push(`${prefix}: lesson sign-off requires lessonCardNamesConfirmed: true (I18N-12.1).`);
  }
  return errors;
}

export function validateSignOffStore(value: unknown): string[] {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.records)) {
    return ['sign-offs.json must be { schemaVersion: 1, records: [...] }.'];
  }
  const errors: string[] = [];
  const seen = new Set<string>();
  value.records.forEach((record, index) => {
    const recordErrors = validateSignOffRecord(record, index);
    errors.push(...recordErrors);
    if (!recordErrors.length) {
      const typed = record as SignOffRecord;
      const key = `${typed.kind}:${typed.locale}:${typed.contentId}@${typed.version}`;
      if (seen.has(key)) errors.push(`sign-offs[${index}]: duplicate sign-off record ${key}.`);
      seen.add(key);
    }
  });
  return errors;
}

// I18N-12.1 (deviation 7): validate each lesson's catalogue references and placeholder parity per locale.
export function validateLocaleLessons({ locale, english, catalogue, lessons }: {
  locale: string;
  english: Readonly<Record<string, Entry>>;
  catalogue: Readonly<Record<string, Entry>>;
  lessons: readonly Lesson[];
}): string[] {
  const errors: string[] = [];
  const keySet = new Set(Object.keys(catalogue));
  for (const lesson of lessons) {
    const report = validateLesson(lesson, keySet);
    for (const finding of report.errors) {
      errors.push(`${locale}: lesson ${lesson.contentId}: ${finding.rule} [${finding.contentId}] ${finding.message}`);
    }
    const refs = lessonTextRefs(lesson);
    const baseSlice: Record<string, Entry> = {};
    const localeSlice: Record<string, Entry> = {};
    for (const ref of refs) {
      if (Object.hasOwn(english, ref) && Object.hasOwn(catalogue, ref)) {
        baseSlice[ref] = english[ref];
        localeSlice[ref] = catalogue[ref];
      }
    }
    for (const parity of parityErrors(baseSlice, localeSlice, locale)) {
      errors.push(`${locale}: lesson ${lesson.contentId}: ${parity}`);
    }
  }
  return errors;
}

// I18N-11 to I18N-14, E-01, E-11, Q2: verify every non-English shipped locale has complete,
// non-stale, checklist-verified sign-offs, valid lessons and a signed Locale Glossary.
export function validateLocaleRelease({ shipped, english, locales, glossaries, glossaryDomainTerms, lessons, signOffs }: {
  shipped: unknown;
  english: Readonly<Record<string, Entry>>;
  locales: Readonly<Record<string, Readonly<Record<string, Entry>>>>;
  glossaries: Readonly<Record<string, LocaleGlossary | undefined>>;
  glossaryDomainTerms: readonly string[];
  lessons: readonly Lesson[];
  signOffs: unknown;
}): { errors: string[] } {
  const errors = [...validateShippedLocaleList(shipped), ...validateSignOffStore(signOffs)];
  if (errors.length) return { errors };

  const records = (signOffs as SignOffStore).records;
  const entryRecords = new Map<string, EntrySignOffRecord>();
  const lessonRecords = new Map<string, LessonSignOffRecord>();
  const glossaryRecords = new Map<string, GlossarySignOffRecord>();
  for (const record of records) {
    if (record.kind === 'entry') entryRecords.set(`${record.locale}:${record.contentId}`, record);
    else if (record.kind === 'lesson') lessonRecords.set(`${record.locale}:${record.contentId}@${record.version}`, record);
    else glossaryRecords.set(record.locale, record);
  }

  const englishLearner: Record<string, Entry> = {};
  for (const [key, entry] of Object.entries(english)) {
    if (entry.scope === 'learner') englishLearner[key] = entry;
  }

  for (const locale of shipped as readonly string[]) {
    if (locale === 'en') continue;
    const catalogue = locales[locale];
    if (!catalogue) {
      errors.push(`${locale}: shipped locale has no catalogue file (I18N-11.1).`);
      continue;
    }

    for (const parity of parityErrors(englishLearner, catalogue, locale)) {
      errors.push(`${locale}: ${parity}`);
    }

    const signedKeys = new Set<string>();
    for (const [key, sourceEntry] of Object.entries(englishLearner)) {
      const entry = catalogue[key];
      if (!entry) continue;
      if (entry.source !== 'human' && entry.source !== 'ai-draft') {
        errors.push(`${locale}: ${key}: missing valid source ("human" or "ai-draft") (I18N-13.1).`);
      }
      if (entry.status !== 'signed') {
        errors.push(`${locale}: ${key}: entry status is "${entry.status}", must be "signed" (I18N-11.1).`);
        continue;
      }
      const record = entryRecords.get(`${locale}:${key}`);
      if (!record) {
        errors.push(`${locale}: ${key}: missing sign-off record (I18N-11.1).`);
        continue;
      }
      if (entry.source && record.source !== entry.source) {
        errors.push(`${locale}: ${key}: sign-off source "${record.source}" does not match entry source "${entry.source}" (I18N-13.1).`);
      }
      const expectedHash = entrySourceHash(sourceEntry.text);
      if (record.sourceHash !== expectedHash) {
        errors.push(`${locale}: ${key}: translation is stale (English source changed since sign-off) (E-01).`);
        continue;
      }
      if (sourceEntry.integrity) {
        const checklist = record.integrityChecklist;
        if (!checklist || !checklist.certaintyPreserved || !checklist.hindsightLabelPreserved) {
          errors.push(`${locale}: ${key}: integrity entry sign-off requires completed integrityChecklist (I18N-14.2).`);
          continue;
        }
        if (!nonempty(record.backTranslation)) {
          errors.push(`${locale}: ${key}: integrity entry sign-off requires an English backTranslation (I18N-14.2).`);
          continue;
        }
      }
      signedKeys.add(key);
    }

    // E-11, I18N-12.1: per-locale lesson validity + lesson sign-off at lesson.version.
    errors.push(...validateLocaleLessons({ locale, english, catalogue, lessons }));
    for (const lesson of lessons) {
      const lessonRecord = lessonRecords.get(`${locale}:${lesson.contentId}@${lesson.version}`);
      if (!lessonRecord) {
        errors.push(`${locale}: lesson ${lesson.contentId}@${lesson.version}: missing lesson sign-off record (E-11).`);
      }
      for (const ref of lessonTextRefs(lesson)) {
        if (Object.hasOwn(englishLearner, ref) && !signedKeys.has(ref)) {
          errors.push(`${locale}: lesson ${lesson.contentId}@${lesson.version}: referenced key ${ref} is unsigned or stale (E-11).`);
        }
      }
    }

    // I18N-09, I18N-11.1: Locale Glossary must cover all domain terms, pass lint, and be signed off.
    const glossary = glossaries[locale];
    if (!glossary) {
      errors.push(`${locale}: shipped locale has no registered Locale Glossary (I18N-11.1).`);
    } else {
      const missing = missingTerms(glossary, glossaryDomainTerms);
      if (missing.length) errors.push(`${locale}: Locale Glossary is missing domain terms: ${missing.join(', ')}.`);
      for (const violation of avoidViolations(catalogue, glossary)) {
        errors.push(`${locale}: glossary avoid violation: ${violation}`);
      }
      const unsignedTerms = glossary.entries.filter(item => item.status !== 'signed').map(item => item.term);
      if (unsignedTerms.length) {
        errors.push(`${locale}: Locale Glossary has unsigned entries: ${unsignedTerms.slice(0, 5).join(', ')}${unsignedTerms.length > 5 ? ` (+${unsignedTerms.length - 5} more)` : ''}.`);
      }
      if (!glossaryRecords.has(locale)) {
        errors.push(`${locale}: missing Locale Glossary sign-off record (I18N-11.1).`);
      }
    }
  }

  return { errors };
}
