import { parseMessage } from '../format';
import type { MessageNode } from '../format';
import type { Entry } from '../types';
import type { LocaleGlossary } from './types';

// I18N-09, E-13: compatibility forms and locale-specific case share one spelling.
export function normalise(text: string, locale: string): string {
  return text.normalize('NFKC').toLocaleLowerCase(locale);
}

function* literals(nodes: readonly MessageNode[]): Generator<string> {
  for (const node of nodes) {
    if (node.type === 'literal') yield node.value;
    if ('branches' in node) for (const branch of node.branches.values()) yield* literals(branch);
  }
}

export function avoidViolations(catalogue: Readonly<Record<string, Entry>>, glossary: LocaleGlossary): string[] {
  const violations: string[] = [];
  const { locale } = glossary;
  const substring = /^(zh|ja)(-|$)/i.test(locale);
  const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
  const words = (text: string) => [...segmenter.segment(text)].filter(part => part.isWordLike).map(part => part.segment);
  for (const [key, entry] of Object.entries(catalogue)) {
    if (entry.scope !== 'learner') continue;
    const texts = [...literals(parseMessage(entry.text))].map(text => normalise(text, locale));
    for (const term of glossary.entries) for (const avoided of term.avoid ?? []) {
      const needle = normalise(avoided.text, locale);
      if (!needle) continue;
      const needleWords = words(needle);
      for (let literal of texts) {
        // I18N-09.2: exempt approved compounds before searching for the avoided text.
        const compounds = (avoided.containedIn ?? []).map(text => normalise(text, locale)).sort((a, b) => b.length - a.length);
        for (const compound of compounds) if (compound) literal = literal.split(compound).join('');
        const literalWords = words(literal);
        const found = substring ? literal.includes(needle) : needleWords.length > 0 && literalWords.some((_, start) =>
          needleWords.every((word, offset) => literalWords[start + offset] === word));
        if (found) violations.push(`${key}: uses avoided "${avoided.text}" (${term.term})`);
      }
    }
  }
  return violations;
}

function renderings(nodes: readonly MessageNode[]): string[] {
  let results = [''];
  for (const node of nodes) {
    const parts = node.type === 'literal' ? [node.value]
      : node.type === 'argument' ? [`{${node.name}}`]
        : node.type === 'pound' ? ['#']
          : [...node.branches.values()].flatMap(renderings);
    results = results.flatMap(prefix => parts.map(part => prefix + part));
  }
  return results;
}

export function lengthWarnings(catalogue: Readonly<Record<string, Entry>>, glossary: LocaleGlossary): string[] {
  const warnings: string[] = [];
  const segmenter = new Intl.Segmenter(glossary.locale, { granularity: 'grapheme' });
  for (const [key, entry] of Object.entries(catalogue)) {
    if (entry.scope !== 'learner') continue;
    // I18N-18, E-13: count complete branch renderings, retaining argument and # markers.
    for (const rendering of renderings(parseMessage(entry.text))) {
      const count = [...segmenter.segment(rendering)].length;
      if (count > glossary.lengthLimit) warnings.push(`${key}: ${count} graphemes exceeds limit ${glossary.lengthLimit}`);
    }
  }
  return warnings;
}

export function glossaryTerms(markdown: string): string[] {
  const terms: string[] = [];
  let section = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(\d+)\./.exec(line);
    if (heading) section = Number(heading[1]);
    if (section < 2 || section > 10) continue;
    const row = /^\|\s*\*\*([^*]+)\*\*\s*\|/.exec(line);
    if (row) terms.push(row[1].trim());
  }
  return terms;
}

export function missingTerms(glossary: LocaleGlossary, terms: readonly string[]): string[] {
  const present = new Set(glossary.entries.filter(entry => entry.kind === 'term').map(entry => entry.term));
  return terms.filter(term => !present.has(term));
}
