import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';
import type { Lesson } from '../src/curriculum/model';
import { catalogue } from '../src/explanation';
import { glossaryTerms } from '../src/explanation/glossary/lint';
import type { LocaleGlossary } from '../src/explanation/glossary/types';
import type { Entry } from '../src/explanation/types';
import { lessonTextRefs } from '../src/pipeline/validate';
import {
  entrySourceHash,
  validateLocaleLessons,
  validateLocaleRelease,
  validateShippedLocaleList,
  validateSignOffRecord,
  type SignOffRecord,
  type SignOffStore,
} from '../scripts/content/signoff';
import { localeSignOff } from '../scripts/content/plugin';

const lesson = JSON.parse(readFileSync('src/curriculum/content/follow-suit.json', 'utf8')) as Lesson;
const domainTerms = glossaryTerms(readFileSync('GLOSSARY.md', 'utf8'));

function makeSignedLocale(
  locale: string,
  english: Readonly<Record<string, Entry>> = catalogue,
  lessons: readonly Lesson[] = [lesson],
): { catalogue: Record<string, Entry>; glossary: LocaleGlossary; signOffs: SignOffStore } {
  const translated: Record<string, Entry> = {};
  const records: SignOffRecord[] = [];
  for (const [key, entry] of Object.entries(english)) {
    if (entry.scope !== 'learner') continue;
    const source: 'human' | 'ai-draft' = key === 'product' ? 'human' : 'ai-draft';
    translated[key] = { ...entry, status: 'signed', source };
    records.push({
      kind: 'entry',
      contentId: key,
      version: 1,
      locale,
      source,
      sourceHash: entrySourceHash(entry.text),
      ...(source === 'ai-draft' ? { aiDraftConfirmed: true } : {}),
      ...(entry.integrity ? {
        integrityChecklist: { certaintyPreserved: true, hindsightLabelPreserved: true },
        backTranslation: `Back-translation of ${key}: ${entry.text}`,
      } : {}),
      reviewer: 'Bridge Teacher',
      date: '2026-11-22',
    });
  }
  for (const item of lessons) {
    records.push({
      kind: 'lesson',
      contentId: item.contentId,
      version: item.version,
      locale,
      lessonCardNamesConfirmed: true,
      reviewer: 'Bridge Teacher',
      date: '2026-11-22',
    });
  }
  const glossary: LocaleGlossary = {
    locale,
    register: 'Signed test register',
    lengthLimit: 100,
    entries: domainTerms.map(term => ({ term, kind: 'term', approved: term, status: 'signed', source: 'human' })),
  };
  records.push({
    kind: 'glossary',
    contentId: `glossary:${locale}`,
    version: 1,
    locale,
    source: 'human',
    reviewer: 'Bridge Teacher',
    date: '2026-11-22',
  });
  return { catalogue: translated, glossary, signOffs: { schemaVersion: 1, records } };
}

test('I18N-11.1, I18N-23.1: shipped-locales list rejects missing en, duplicates and en-XA', () => {
  expect(validateShippedLocaleList(['en'])).toEqual([]);
  expect(validateShippedLocaleList(['en', 'ja'])).toEqual([]);
  expect(validateShippedLocaleList(['ja'])).toEqual(['shipped-locales.json must include source locale "en".']);
  expect(validateShippedLocaleList(['en', 'en-XA'])).toContain('I18N-23.1: pseudo-locale en-XA cannot appear in shipped-locales.json.');
  expect(validateShippedLocaleList(['en', 'ja', 'ja'])).toContain('Duplicate locale in shipped-locales.json: ja');
});

test('I18N-12.1 (deviation 7): missing lesson key or dropped {answers} fails in ja only while en passes', () => {
  const { catalogue: ja } = makeSignedLocale('ja');
  expect(validateLocaleLessons({ locale: 'en', english: catalogue, catalogue, lessons: [lesson] })).toEqual([]);
  expect(validateLocaleLessons({ locale: 'ja', english: catalogue, catalogue: ja, lessons: [lesson] })).toEqual([]);

  const missingKey = { ...ja };
  delete missingKey['lesson.title'];
  expect(validateLocaleLessons({ locale: 'ja', english: catalogue, catalogue: missingKey, lessons: [lesson] }))
    .toEqual([expect.stringContaining('ja: lesson follow-suit: catalogue-reference')]);
  expect(validateLocaleLessons({ locale: 'en', english: catalogue, catalogue, lessons: [lesson] })).toEqual([]);

  const droppedPlaceholder = { ...ja, 'lesson.correct': { ...ja['lesson.correct'], text: 'よくできました。' } };
  expect(validateLocaleLessons({ locale: 'ja', english: catalogue, catalogue: droppedPlaceholder, lessons: [lesson] }))
    .toEqual([expect.stringContaining('ja: lesson follow-suit: lesson.correct: message shape differs')]);
  expect(validateLocaleLessons({ locale: 'en', english: catalogue, catalogue, lessons: [lesson] })).toEqual([]);
});

test('I18N-13.1: schema requires source and aiDraftConfirmed for ai-draft entries', () => {
  const validHash = entrySourceHash(catalogue['home.learn'].text);
  expect(validateSignOffRecord({
    kind: 'entry', contentId: 'home.learn', version: 1, locale: 'ja',
    source: 'other', sourceHash: validHash, reviewer: 'Teacher', date: '2026-11-22',
  }, 0)).toContain('sign-offs[0]: source must be "human" or "ai-draft" (I18N-13).');

  expect(validateSignOffRecord({
    kind: 'entry', contentId: 'home.learn', version: 1, locale: 'ja',
    source: 'ai-draft', sourceHash: validHash, reviewer: 'Teacher', date: '2026-11-22',
  }, 0)).toContain('sign-offs[0]: ai-draft sign-off requires aiDraftConfirmed: true (I18N-13).');

  expect(validateSignOffRecord({
    kind: 'entry', contentId: 'home.learn', version: 1, locale: 'ja',
    source: 'ai-draft', aiDraftConfirmed: true, sourceHash: validHash, reviewer: 'Teacher', date: '2026-11-22',
  }, 0)).toEqual([]);
});

test('I18N-14.2: integrity entry sign-off requires answered checklist and English back-translation', () => {
  const { catalogue: ja, glossary, signOffs } = makeSignedLocale('ja');
  expect(validateLocaleRelease({
    shipped: ['en', 'ja'], english: catalogue, locales: { ja }, glossaries: { ja: glossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs,
  }).errors).toEqual([]);

  const noChecklist: SignOffStore = {
    schemaVersion: 1,
    records: signOffs.records.map(record => record.kind === 'entry' && record.contentId === 'review.hindsight'
      ? { ...record, integrityChecklist: { certaintyPreserved: true, hindsightLabelPreserved: false } } : record),
  };
  expect(validateLocaleRelease({
    shipped: ['en', 'ja'], english: catalogue, locales: { ja }, glossaries: { ja: glossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs: noChecklist,
  }).errors).toContain('ja: review.hindsight: integrity entry sign-off requires completed integrityChecklist (I18N-14.2).');

  const noBackTranslation: SignOffStore = {
    schemaVersion: 1,
    records: signOffs.records.map(record => record.kind === 'entry' && record.contentId === 'review.hindsight'
      ? { ...record, backTranslation: '   ' } : record),
  };
  expect(validateLocaleRelease({
    shipped: ['en', 'ja'], english: catalogue, locales: { ja }, glossaries: { ja: glossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs: noBackTranslation,
  }).errors).toContain('ja: review.hindsight: integrity entry sign-off requires an English backTranslation (I18N-14.2).');
});

test('E-11: lesson text sign-off covers every referenced key at the lesson version', () => {
  const refs = lessonTextRefs(lesson);
  expect(refs).toEqual(expect.arrayContaining(['lesson.title', 'lesson.intro', 'lesson.correct', 'lesson.hint-text']));
  const { catalogue: ja, glossary, signOffs } = makeSignedLocale('ja');
  const withoutLessonSignOff: SignOffStore = {
    schemaVersion: 1,
    records: signOffs.records.filter(record => record.kind !== 'lesson'),
  };
  expect(validateLocaleRelease({
    shipped: ['en', 'ja'], english: catalogue, locales: { ja }, glossaries: { ja: glossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs: withoutLessonSignOff,
  }).errors).toContain(`ja: lesson ${lesson.contentId}@${lesson.version}: missing lesson sign-off record (E-11).`);
});

test('E-01, Q2: changing an English entry marks its signed ja translation stale; production build fails while development warns', async () => {
  const { catalogue: ja, glossary, signOffs } = makeSignedLocale('ja');
  const editedEnglish = {
    ...catalogue,
    'home.learn': { ...catalogue['home.learn'], text: 'Start learning' },
  };
  const report = validateLocaleRelease({
    shipped: ['en', 'ja'], english: editedEnglish, locales: { ja }, glossaries: { ja: glossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs,
  });
  expect(report.errors).toContain('ja: home.learn: translation is stale (English source changed since sign-off) (E-01).');

  // Verify real Vite build gating: production fails naming the stale key; development warns and succeeds.
  const dir = mkdtempSync(join(tmpdir(), 'bridgevibe-signoff-'));
  try {
    const pluginOptions = {
      shipped: ['en', 'ja'],
      signOffs,
      english: editedEnglish,
      locales: { ja },
      glossaries: { ja: glossary },
      lessons: [lesson],
    };
    await expect(build({
      configFile: false,
      root: process.cwd(),
      mode: 'production',
      logLevel: 'silent',
      plugins: [localeSignOff(pluginOptions)],
      build: { outDir: join(dir, 'prod'), lib: { entry: 'src/explanation/types.ts', formats: ['es'] } },
    })).rejects.toThrow(/ja: home\.learn: translation is stale/);

    const warnings: string[] = [];
    await build({
      configFile: false,
      root: process.cwd(),
      mode: 'development',
      customLogger: {
        info() {}, warn(msg) { warnings.push(msg); }, warnOnce(msg) { warnings.push(msg); },
        error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false,
      },
      plugins: [localeSignOff(pluginOptions)],
      build: { outDir: join(dir, 'dev'), lib: { entry: 'src/explanation/types.ts', formats: ['es'] } },
    });
    expect(warnings.some(msg => msg.includes('ja: home.learn: translation is stale'))).toBe(true);
    vi.restoreAllMocks();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);

test('I18N-11.1: shipped locale requires signed entries, signed glossary and glossary sign-off', () => {
  const { catalogue: ja, glossary, signOffs } = makeSignedLocale('ja');
  const draftEntry = { ...ja, 'home.learn': { ...ja['home.learn'], status: 'draft' as const } };
  expect(validateLocaleRelease({
    shipped: ['en', 'ja'], english: catalogue, locales: { ja: draftEntry }, glossaries: { ja: glossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs,
  }).errors).toContain('ja: home.learn: entry status is "draft", must be "signed" (I18N-11.1).');

  const draftGlossary: LocaleGlossary = {
    ...glossary,
    entries: glossary.entries.map((item, idx) => idx === 0 ? { ...item, status: 'draft' } : item),
  };
  expect(validateLocaleRelease({
    shipped: ['en', 'ja'], english: catalogue, locales: { ja }, glossaries: { ja: draftGlossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs,
  }).errors).toContain(`ja: Locale Glossary has unsigned entries: ${glossary.entries[0].term}.`);

  // I18N-13.1: a glossary with ai-draft entries cannot be signed off as human without aiDraftConfirmed.
  const aiGlossary: LocaleGlossary = {
    ...glossary,
    entries: glossary.entries.map((item, idx) => idx === 0 ? { ...item, source: 'ai-draft' } : item),
  };
  expect(validateLocaleRelease({
    shipped: ['en', 'ja'], english: catalogue, locales: { ja }, glossaries: { ja: aiGlossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs,
  }).errors).toContain('ja: Locale Glossary contains ai-draft entries and requires an ai-draft sign-off with aiDraftConfirmed: true (I18N-13.1).');

  const confirmedAiGlossarySignOffs: SignOffStore = {
    schemaVersion: 1,
    records: signOffs.records.map(record => record.kind === 'glossary'
      ? { ...record, source: 'ai-draft', aiDraftConfirmed: true } : record),
  };
  expect(validateLocaleRelease({
    shipped: ['en', 'ja'], english: catalogue, locales: { ja }, glossaries: { ja: aiGlossary },
    glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs: confirmedAiGlossarySignOffs,
  }).errors).toEqual([]);
});

test('I18N-12: entry and glossary sign-offs resolve by highest version regardless of record order', () => {
  const { catalogue: ja, glossary, signOffs } = makeSignedLocale('ja');
  const staleV1: SignOffRecord = {
    kind: 'entry',
    contentId: 'home.learn',
    version: 1,
    locale: 'ja',
    source: 'ai-draft',
    aiDraftConfirmed: true,
    sourceHash: entrySourceHash('Old English text'),
    reviewer: 'Bridge Teacher',
    date: '2026-11-20',
  };
  const freshV2: SignOffRecord = {
    kind: 'entry',
    contentId: 'home.learn',
    version: 2,
    locale: 'ja',
    source: 'ai-draft',
    aiDraftConfirmed: true,
    sourceHash: entrySourceHash(catalogue['home.learn'].text),
    reviewer: 'Bridge Teacher',
    date: '2026-11-22',
  };
  const rest = signOffs.records.filter(record => !(record.kind === 'entry' && record.contentId === 'home.learn'));
  // Placing v1 after v2 must still resolve v2 (order-independent).
  for (const ordered of [[...rest, freshV2, staleV1], [...rest, staleV1, freshV2]]) {
    expect(validateLocaleRelease({
      shipped: ['en', 'ja'], english: catalogue, locales: { ja }, glossaries: { ja: glossary },
      glossaryDomainTerms: domainTerms, lessons: [lesson], signOffs: { schemaVersion: 1, records: ordered },
    }).errors).toEqual([]);
  }
});
