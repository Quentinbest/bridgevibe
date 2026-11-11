import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { Catalogue } from './index';
import type { Entry } from './types';
import { avoidViolations, glossaries, glossaryTerms, lengthWarnings, missingTerms, normalise } from './glossary';
import type { GlossaryEntry, LocaleGlossary } from './glossary';

const entry = (text: string, scope: Entry['scope'] = 'learner'): Entry => ({ text, scope, status: 'draft' });
const term = (name: string, avoid: GlossaryEntry['avoid'] = []): GlossaryEntry => ({
  term: name, kind: 'term', approved: name, avoid, status: 'draft', source: 'ai-draft',
});
const glossary = (locale: string, entries: readonly GlossaryEntry[] = []): LocaleGlossary => ({
  locale, register: 'stub only', lengthLimit: 10, entries,
});
const japanese = glossary('ja', [term('Trump suit', [{ text: 'トランプ', containedIn: ['ノートランプ'] }])]);

test('I18N-09.3: approved compounds pass; standalone avoided text fails, including after compounds', () => {
  expect(avoidViolations({ stub: entry('ノートランプで3つ ノートランプ') }, japanese)).toEqual([]);
  for (const text of ['トランプで3つ', 'ノートランプ トランプで3つ']) {
    expect(avoidViolations({ stub: entry(text) }, japanese)).toEqual(['stub: uses avoided "トランプ" (Trump suit)']);
  }
});

test.each(['ja', 'zh-Hans', 'zh-Hant'])('I18N-09.2, E-13: %s normalises full-width letters before substring matching', locale => {
  const stub = glossary(locale, [term('No-trumps', [{ text: 'NT', containedIn: ['ＮＴ契約'] }])]);
  expect(normalise('ＮＴ', locale)).toBe('nt');
  expect(avoidViolations({ stub: entry('前ＮＴ後') }, stub)).toEqual(['stub: uses avoided "NT" (No-trumps)']);
  expect(avoidViolations({ stub: entry('NT契約ＮＴ契約') }, stub)).toEqual([]);
});

test.each(['Digo doblo.', 'Digo Doblo.'])('I18N-09: Spanish whole-word matching catches %s', text => {
  expect(avoidViolations({ stub: entry(text) }, glossary('es', [term('Double', [{ text: 'doblo' }])]))).toEqual([
    'stub: uses avoided "doblo" (Double)',
  ]);
});

test('I18N-09: whole words, consecutive multi-word terms, and normalised compound exemptions', () => {
  const stub = glossary('es', [term('Double', [{ text: 'doblo', containedIn: ['DOBLO aprobado'] }])]);
  expect(avoidViolations({ stub: entry('doblones DOBLO aprobado doblo aprobado') }, stub)).toEqual([]);
  const multi = glossary('es', [term('Register', [{ text: 'mal paso' }])]);
  expect(avoidViolations({ stub: entry('Un MAL paso.') }, multi)).toEqual(['stub: uses avoided "mal paso" (Register)']);
  expect(avoidViolations({ stub: entry('mal otro paso; mal pasos') }, multi)).toEqual([]);
});

test('I18N-08, I18N-09: skips internal entries and syntax, visits nested plural/select literals', () => {
  const stub = glossary('es', [term('Trump suit', [{ text: 'trump' }])]);
  expect(avoidViolations({ internal: entry('trump', 'internal'), placeholder: entry('{trump}'),
    selectors: entry('{trump, select, trump {safe} other {safe}}') }, stub)).toEqual([]);
  expect(avoidViolations({ stub: entry('{n, plural, one {safe} other {{choice, select, a {trump} other {safe}}}}') }, stub))
    .toEqual(['stub: uses avoided "trump" (Trump suit)']);
});

test('US-34.2: avoided terms spanning surrounding text and a branch are caught; arguments stay opaque', () => {
  const spanish = glossary('es', [term('No-trumps', [{ text: 'sin palo' }])]);
  expect(avoidViolations({ stub: entry('sin {strain, select, nt {triunfo} other {palo}}') }, spanish))
    .toEqual(['stub: uses avoided "sin palo" (No-trumps)']);
  expect(avoidViolations({ stub: entry('sin {strain, select, a {palo} b {palo} other {palo}}') }, spanish))
    .toEqual(['stub: uses avoided "sin palo" (No-trumps)']);
  expect(avoidViolations({ stub: entry('sin {x} palo'), count: entry('{n, plural, other {sin # palo}}') }, spanish)).toEqual([]);
  const japanese = glossary('ja', [term('Trump suit', [{ text: 'トランプ', containedIn: ['ノートランプ'] }])]);
  expect(avoidViolations({ stub: entry('トラ{x, select, a {ンプ} other {ック}}') }, japanese))
    .toEqual(['stub: uses avoided "トランプ" (Trump suit)']);
  expect(avoidViolations({ stub: entry('トラ{x}ンプ') }, japanese)).toEqual([]);
});

test('I18N-18, E-13: warns on 11 graphemes, accepts 10 and counts skin-tone emoji as one', () => {
  const stub = glossary('ja');
  expect(lengthWarnings({ stub: entry('1234567890'), emoji: entry('123456789👍🏽'),
    internal: entry('12345678901', 'internal') }, stub)).toEqual([]);
  expect(lengthWarnings({ stub: entry('{n, plural, one {1234567890} other {12345678901}}') }, stub))
    .toEqual(['stub: 11 graphemes exceeds limit 10']);
});

test('I18N-18: complete nested branch renderings include surrounding text, arguments and #', () => {
  const stub = glossary('es');
  expect(lengthWarnings({ stub: entry('12{x, select, a {{name}34} other {123456789}}') }, stub))
    .toEqual(['stub: 11 graphemes exceeds limit 10']);
  expect(lengthWarnings({ stub: entry('{n, plural, other {12345{x, select, a {{who}} other {12345}}#}}') }, stub))
    .toEqual(['stub: 11 graphemes exceeds limit 10', 'stub: 11 graphemes exceeds limit 10']);
});

const terms = glossaryTerms(readFileSync('GLOSSARY.md', 'utf8'));
test('I18N-09: parses all 110 real glossary terms, excluding the context map and invariants', () => {
  expect(terms).toHaveLength(110);
  expect(new Set(terms).size).toBe(terms.length);
  expect(terms).toEqual(expect.arrayContaining(['Playthrough', 'Locale Glossary', 'Declarer']));
  expect(terms).not.toContain('Table');
  expect(glossaryTerms('## 1. Context map\n| **Ignore** | x |\n## 2. Table\n| **Card** | x |\n## 10. Explanation\n| **Locale Glossary** | x |\n## 11. Invariants\n| **Ignore** | x |'))
    .toEqual(['Card', 'Locale Glossary']);
});

test('I18N-09: missing terms require term entries, not register entries', () => {
  const absent = ['Playthrough', 'Locale Glossary'];
  const stub = glossary('ja', terms.filter(name => !absent.includes(name)).map(name => term(name)));
  stub.entries = [...stub.entries, { ...term('Playthrough'), kind: 'register' }];
  expect(missingTerms(stub, terms)).toEqual(absent);
});

for (const [tag, registered] of Object.entries(glossaries)) {
  test(`I18N-09: the ${tag} glossary covers every domain term once and passes its own avoid list`, () => {
    expect(registered?.locale).toBe(tag);
    expect(missingTerms(registered!, terms)).toEqual([]);
    const names = registered!.entries.map(entry => `${entry.kind}:${entry.term}`);
    expect(new Set(names).size).toBe(names.length);
    const approved = Object.fromEntries(registered!.entries.map((entry, index) => [`approved.${index}`, { text: entry.approved, scope: 'learner' as const, status: 'draft' as const }]));
    expect(avoidViolations(approved, registered!)).toEqual([]);
  });
}

test('U-24, CI-8: the zh-Hans glossary is an AI draft until its teacher signs it off (I-11)', () => {
  expect(glossaries['zh-Hans']!.entries.every(entry => entry.source === 'ai-draft' && entry.status === 'draft')).toBe(true);
});

for (const [tag, realGlossary] of Object.entries(glossaries)) {
  if (!realGlossary || !existsSync(new URL(`./locales/${tag}.ts`, import.meta.url))) continue;
  test(`I18N-09, I18N-18: real locale ${tag} avoids forbidden terms and covers the domain glossary`, async () => {
    const module = await import(`./locales/${tag}.ts`) as Record<string, Catalogue>;
    const [catalogue] = Object.values(module);
    expect(catalogue).toBeDefined();
    expect(avoidViolations(catalogue, realGlossary)).toEqual([]);
    expect(missingTerms(realGlossary, terms)).toEqual([]);
    for (const warning of lengthWarnings(catalogue, realGlossary)) console.warn(`${tag}: ${warning}`);
  });
}
