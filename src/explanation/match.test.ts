import { expect, test } from 'vitest';
import { devicePreferences, matchLocale } from './match';

const all = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'es'];
// I18N-01.1, E-07: preference order, canonicalisation and maximized scripts.
test.each([
  [[], 'en'], [['fr-FR', 'ja-JP'], 'ja'], [['es-MX', 'ja'], 'es'],
  [['en-GB'], 'en'], [['en-US'], 'en'], [['es-ES'], 'es'], [['es-419'], 'es'],
  [['ja'], 'ja'], [['zh'], 'zh-Hans'], [['zh-cn'], 'zh-Hans'], [['zh-SG'], 'zh-Hans'],
  [['zh-Hans-HK'], 'zh-Hans'], [['zh-HK'], 'zh-Hant'], [['zh-TW'], 'zh-Hant'],
  [['zh-MO'], 'zh-Hant'], [['zh-Hant-CN'], 'zh-Hant'], [['invalid_tag', 'ja-JP'], 'ja'],
  [['invalid_tag'], 'en'], [['fr-FR'], 'en'],
] as const)('matches %j to %s', (preferences, expected) => {
  expect(matchLocale(preferences, all)).toBe(expected);
});
test.each(['zh-TW', 'zh-HK', 'zh-MO'])('E-09, Q1: %s never crosses scripts when Hant is unshipped', tag => {
  expect(matchLocale([tag], ['en', 'zh-Hans'])).toBe('en');
});
test('only shipped matches count, and later preferences remain eligible', () => {
  expect(matchLocale(['zh-TW', 'ja-JP'], ['en', 'zh-Hans', 'ja'])).toBe('ja');
  expect(matchLocale(['ja-JP'], ['en'])).toBe('en');
});
test('device preferences use languages, then language, then an empty list', () => {
  expect(devicePreferences({ languages: ['es', 'ja'], language: 'en' })).toEqual(['es', 'ja']);
  expect(devicePreferences({ language: 'ja-JP' })).toEqual(['ja-JP']);
  expect(devicePreferences({ languages: [], language: 'es' })).toEqual(['es']);
  expect(devicePreferences({})).toEqual([]);
  expect(devicePreferences({ languages: [], language: '' })).toEqual([]);
});
