import { expect, test } from 'vitest';
import { REASON_CODES } from '../table';
import { catalogue, reasonStrings, text } from './index';
test('US-01.9: every reason has draft copy, with the led suit interpolated', () => {
  expect(Object.keys(reasonStrings).sort()).toEqual([...REASON_CODES].sort());
  for (const reason of REASON_CODES) {
    expect(catalogue[reasonStrings[reason]].status).toBe('draft');
    expect(text(reasonStrings[reason])).not.toBe('');
  }
  expect(text(reasonStrings['must-follow-suit'], { suit: 'hearts' })).toBe('Play hearts; you still have that suit.');
});
