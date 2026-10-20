import { expect, test } from 'vitest';
import { scoreContract, type ScoreInput } from './index';
import reference from './f6-reference.json';
import { law77Examples } from './f6-law77';

const key = (input: { level: number; strain: string; doubling: string; vulnerable: boolean; tricks: number }) =>
  JSON.stringify([input.level, input.strain, input.doubling, input.vulnerable, input.tricks]);

// US-09.1, F6: prove complete Cartesian coverage, not just the fixture's row count.
test('F6 contains exactly 2,940 distinct valid cases and two pinned references', () => {
  const expected = new Set<string>();
  for (let level = 1; level <= 7; level++) {
    for (const strain of ['clubs', 'diamonds', 'hearts', 'spades', 'no-trumps']) {
      for (const doubling of ['undoubled', 'doubled', 'redoubled']) {
        for (const vulnerable of [false, true]) {
          for (let tricks = 0; tricks <= 13; tricks++) expected.add(key({ level, strain, doubling, vulnerable, tricks }));
        }
      }
    }
  }
  expect(reference.cases).toHaveLength(2940);
  expect(new Set(reference.cases.map(key))).toEqual(expected);
  expect(reference.generatedBy).toBe('scripts/scoring/generate-f6-reference.ts');
  expect(reference.references).toMatchObject([
    { name: 'ts-contractbridge', commit: '8a788cf0a926ea0413f9d21091858bf4dc95bcfc', licence: 'MIT' },
    { name: 'contract-bridge', version: '3.2.1', licence: 'MIT' },
  ]);
});

test('F6 reports every disagreement between the two references', () => {
  expect(reference.cases.filter(entry => entry.scores['ts-contractbridge'] !== entry.scores['contract-bridge'])).toEqual([]);
});

test.each(reference.cases)('F6 $level $strain $doubling vulnerable=$vulnerable tricks=$tricks', entry => {
  const result = scoreContract(entry as ScoreInput);
  expect(result.score, 'ts-contractbridge').toBe(entry.scores['ts-contractbridge']);
  expect(result.score, 'contract-bridge').toBe(entry.scores['contract-bridge']);
  expect(result.breakdown.reduce((sum, item) => sum + item.points, 0)).toBe(result.score);
  const kinds = result.breakdown.map(item => item.kind);
  const order = ['contract-points', 'overtricks', 'doubled-bonus', 'part-score-bonus', 'game-bonus', 'slam-bonus', 'undertricks'];
  expect(kinds).toEqual(order.filter(kind => kinds.some(actual => actual === kind)));
  const difference = entry.tricks - entry.level - 6;
  if (difference < 0) {
    expect(result.breakdown).toEqual([{ kind: 'undertricks', points: result.score, count: -difference }]);
  } else {
    expect(kinds).toContain('contract-points');
    expect(kinds.includes('overtricks')).toBe(difference > 0);
    expect(kinds.includes('doubled-bonus')).toBe(entry.doubling !== 'undoubled');
    expect(kinds.includes('slam-bonus')).toBe(entry.level >= 6);
    expect(kinds).not.toContain('undertricks');
    expect(kinds.filter(kind => kind === 'part-score-bonus' || kind === 'game-bonus')).toHaveLength(1);
    for (const item of result.breakdown) {
      expect(item.points).toBeGreaterThan(0);
      if (item.kind === 'overtricks') expect(item.count).toBe(difference);
      else expect(item).not.toHaveProperty('count');
    }
  }
});

test('F6 has exactly 16 distinct Law 77 examples', () => {
  expect(law77Examples).toHaveLength(16);
  expect(new Set(law77Examples.map(example => key(example.input))).size).toBe(16);
});
test.each(law77Examples)('$description', ({ input, expected }) => {
  expect(scoreContract(input)).toEqual(expected);
});

// US-09.2: assertions deliberately bypass types to exercise the public runtime boundary.
const valid: ScoreInput = { level: 3, strain: 'no-trumps', doubling: 'undoubled', vulnerable: false, tricks: 9 };
const invalid: [keyof ScoreInput, unknown][] = [
  ...[-1, 14, 2.5, NaN, Infinity, '9', null, undefined].map(value => ['tricks', value] as [keyof ScoreInput, unknown]),
  ...[0, 8, 1.5, NaN, Infinity, '3', null, undefined].map(value => ['level', value] as [keyof ScoreInput, unknown]),
  ['strain', 'sans'], ['strain', undefined], ['doubling', 'xx'], ['doubling', undefined],
  ['vulnerable', 0], ['vulnerable', 'false'], ['vulnerable', null], ['vulnerable', undefined],
];
test.each(invalid)('rejects invalid %s: %s with a field-naming RangeError', (field, value) => {
  const run = () => scoreContract({ ...valid, [field]: value } as ScoreInput);
  expect(run).toThrow(RangeError);
  expect(run).toThrow(new RegExp(field));
});
test.each([null, undefined, 3, 'contract'])('rejects malformed input: %s', input => {
  expect(() => scoreContract(input as unknown as ScoreInput)).toThrow(new RangeError('input must be an object'));
});
