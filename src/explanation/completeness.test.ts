import { expect, test } from 'vitest';
import { REASON_CODES } from '../table';
import { catalogue } from './index';

// US-01.9 / FR-E1: both entries are required independently of the UI's mapping.
for (const code of REASON_CODES) {
  test(`${code} has a nonempty draft Template and Rule Reference`, () => {
    for (const prefix of ['reason', 'rule'] as const) {
      const entry = catalogue[`${prefix}.${code}`];
      expect(entry).toBeDefined();
      expect(entry.text.trim()).not.toBe('');
      expect(entry.status).toBe('draft');
    }
  });
}
