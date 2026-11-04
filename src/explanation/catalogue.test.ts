import { expect, test } from 'vitest';
import { catalogue, text, type Catalogue } from './index';
test('all copy awaits teacher sign-off', () => { expect(Object.values(catalogue).every(entry => entry.status === 'draft')).toBe(true); });
test('interpolates display values', () => { expect(text('tricks', { won: 0, target: 9 })).toBe('Tricks: 0 / 9'); });

// I18N-05.1: tsc checks the English learner catalogue against the locale contract.
const learnerCatalogue: Catalogue = catalogue;
test('English satisfies the learner catalogue contract', () => { expect(learnerCatalogue).toBe(catalogue); });

test('I18N-08: every entry has scope and only benchmark and debug entries are internal', () => {
  expect(Object.values(catalogue).every(entry => ['learner', 'internal'].includes(entry.scope))).toBe(true);
  expect(Object.keys(catalogue)).toHaveLength(310);
  const internal = Object.entries(catalogue).filter(([, entry]) => entry.scope === 'internal').map(([key]) => key);
  expect(internal).toHaveLength(23);
  expect(internal).toEqual(Object.keys(catalogue).filter(key => key.startsWith('bench.') || key.startsWith('debug.')));
});

test('I18N-14: integrity tags cover exactly the certainty-sensitive templates', () => {
  expect(Object.entries(catalogue).filter(([, entry]) => 'integrity' in entry && entry.integrity).map(([key]) => key).sort()).toEqual([
    'moment.sound',
    'moment.unlucky',
    'moment.lucky',
    'moment.mistake',
    'moment.sound-sentence',
    'moment.unlucky-sentence',
    'moment.lucky-sentence',
    'moment.mistake-sentence',
    'moment.alternative',
    'moment.sampled-acceptable',
    'moment.sampled-not-acceptable',
    'moment.sampled-uncertain',
    'moment.uncertain',
    'moment.hint-close',
    'hint.advice',
    'hint.reason',
    'hint.uncertain',
    'hint.unavailable-timeout',
    'hint.unavailable-failure',
    'hint.not-covered',
    'review.unavailable',
    'hint.label',
    'hint.thinking',
    'review.sampling',
    'review.working',
    'review.hindsight',
    'review.xray',
    'review.cost-description',
  ].sort());
});

test('English source entries have no source tag', () => {
  expect(Object.values(catalogue).some(entry => 'source' in entry)).toBe(false);
});
