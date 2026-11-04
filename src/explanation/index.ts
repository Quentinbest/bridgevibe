import type { Card, ReasonCode } from '../table';

import { formatMessage, list as formatList, number as formatNumber } from './format';

import { en } from './locales/en';
import type { Entry } from './types';
export type { Entry } from './types';

export const catalogue = en;
export type StringId = keyof typeof en;
export type LearnerStringId = {
  [K in StringId]: typeof en[K]['scope'] extends 'learner' ? K : never
}[StringId];
// I18N-05.1: later locales must cover every learner key.
export type Catalogue = Record<LearnerStringId, Entry>;
let active: { locale: string; languageTag: string; catalogue: Partial<Record<StringId, Entry>> } = { locale: 'en', languageTag: 'en', catalogue: en };
export function setLocale(id: string, catalogue: Partial<Record<StringId, Entry>>, languageTag = id): void {
  active = { locale: id, languageTag, catalogue };
}
export function currentLocale(): string { return active.locale; }
export function currentLanguageTag(): string { return active.languageTag; }
export function text(id: StringId, params: Readonly<Record<string, string | number>> = {}): string {
  const english = en[id];
  // I18N-08, I18N-11.2: internal and missing translations use English formatting too.
  const translated = english.scope === 'internal' ? undefined : active.catalogue[id];
  return formatMessage((translated ?? english).text, params, translated ? active.languageTag : 'en');
}
export function list(items: readonly string[], locale = currentLanguageTag()): string { return formatList(items, locale); }
export function number(n: number, locale = currentLanguageTag()): string { return formatNumber(n, locale); }

// US-01.9: adding a Reason Code requires a corresponding copy template.
export const reasonStrings: Record<ReasonCode, StringId> = {
  'not-declarer': 'reason.not-declarer',
  'invalid-contract-choice': 'reason.invalid-contract-choice',
  'wrong-phase': 'reason.wrong-phase',
  'playthrough-complete': 'reason.playthrough-complete',
  'malformed-action': 'reason.malformed-action',
  'not-your-turn': 'reason.not-your-turn',
  'only-declarer-plays-dummy': 'reason.only-declarer-plays-dummy',
  'card-not-held': 'reason.card-not-held',
  'must-follow-suit': 'reason.must-follow-suit',
};
export function cardName(card: Card): string {
  return text('card.name', { rank: text(`rank.${card.rank}`), suit: text(`suit.${card.suit}`) });
}
