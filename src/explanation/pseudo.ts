import { parseMessage, type MessageNode } from './format';
import type { Entry } from './types';

type Entries = Readonly<Record<string, Entry>>;
const accents = 'áƀçďéƒğħíĵķľḿñóƥɋŕšťúṽŵẋýž';
function serialize(nodes: readonly MessageNode[], transform: (text: string) => string): string {
  return nodes.map(node => {
    if (node.type === 'literal') return transform(node.value);
    if (node.type === 'pound') return '#';
    if (node.type === 'argument') return `{${node.name}}`;
    return `{${node.name}, ${node.type}, ${[...node.branches].map(([key, branch]) => `${key} {${serialize(branch, transform)}}`).join(' ')}}`;
  }).join('');
}
function convert(catalogue: Entries, transform: (text: string) => string, wrap = false): Record<string, Entry> {
  return Object.fromEntries(Object.entries(catalogue).filter(([, entry]) => entry.scope === 'learner').map(([key, entry]) => {
    const message = serialize(parseMessage(entry.text), transform);
    return [key, { ...entry, text: wrap ? `⟦${message}⟧` : message }];
  }));
}
function pad(text: string, factor: number): string {
  const length = Math.round(text.trim().length * factor);
  return length ? `${text}${'~'.repeat(length)}` : text;
}
// I18N-23, E-12: syntax is preserved while literal text expands.
export function pseudoLocalise(catalogue: Entries): Record<string, Entry> {
  return convert(catalogue, text => pad(text.replace(/[a-z]/gi, letter => {
    const mapped = accents[letter.toLowerCase().charCodeAt(0) - 97];
    return letter === letter.toUpperCase() ? mapped.toUpperCase() : mapped;
  }), 0.4), true);
}
export function stubCatalogue(catalogue: Entries, kind: 'long' | 'cjk'): Record<string, Entry> {
  // I18N-17, #149: a full-width kana is about two Latin letters wide, so each run of letters or digits
  // becomes half as many kana, giving Japanese sample text of similar visual width to the English.
  const samples = 'あいうえおかきくけこさしすせそたちつてとなにぬねの橋牌学習';
  const result = convert(catalogue, text => kind === 'long' ? pad(text, 0.3) : text.replace(/[A-Za-z0-9]+/g, run =>
    Array.from({ length: Math.ceil(run.length / 2) }, (_, index) => samples[run.toLowerCase().charCodeAt(index * 2) % samples.length]).join('')));
  if (kind === 'cjk') for (const key of Object.keys(result)) {
    // U-23, #149: card faces, suits and the brand name stay as in English, as a real CJK catalogue keeps them.
    if (/^(face|symbol)\.|^product(\.|$)/.test(key)) result[key] = catalogue[key];
  }
  return result;
}
