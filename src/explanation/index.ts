import type { Card, ReasonCode } from '../table';

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
export function text(id: StringId, params: Readonly<Record<string, string | number>> = {}): string {
  return catalogue[id].text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match));
}

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
