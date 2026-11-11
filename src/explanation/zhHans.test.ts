import { expect, test } from 'vitest';
import { catalogue, type Entry } from './index';
import { parityErrors } from './parity';
import { zhHans } from './locales/zh-Hans';

const learner: Record<string, Entry> = Object.fromEntries(Object.entries(catalogue).filter(([, entry]) => entry.scope === 'learner'));

test('I18N-06: the zh-Hans draft keeps every placeholder, select key and required plural branch', () => {
  expect(parityErrors(learner, zhHans, 'zh-Hans')).toEqual([]);
});

test('U-24, CI-8: every zh-Hans entry is an unsigned AI draft until its teacher signs it off', () => {
  expect(Object.values(zhHans).every(entry => entry.source === 'ai-draft' && entry.status === 'draft' && entry.scope === 'learner')).toBe(true);
});

test('I18N-14: integrity tags match English, and hindsight statements keep the X-ray label', () => {
  const tagged = (entries: Record<string, { integrity?: true }>) => Object.keys(entries).filter(key => entries[key].integrity).sort();
  expect(tagged(zhHans)).toEqual(tagged(learner));
  // CI-3: every ALL_HANDS label English marks with "X-ray view" keeps 透视 in Chinese.
  for (const key of Object.keys(learner).filter(key => learner[key].text.includes('X-ray'))) {
    expect(zhHans[key as keyof typeof zhHans].text, key).toContain('透视');
  }
});
