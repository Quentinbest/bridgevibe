import { expect, test } from 'vitest';
import { catalogue, text } from './index';
test('all copy awaits teacher sign-off', () => { expect(Object.values(catalogue).every(entry => entry.status === 'draft')).toBe(true); });
test('interpolates display values', () => { expect(text('tricks', { won: 0, target: 9 })).toBe('Tricks: 0 / 9'); });
