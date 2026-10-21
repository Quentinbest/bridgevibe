import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { dealIdOf } from '../table';
import { validateLesson } from './validate';

const fixture = (name: string) => JSON.parse(readFileSync(`test/fixtures/lessons/${name}.json`, 'utf8'));
const rules = {
  'lesson-shape': ['lesson-empty-exercises', 'exercise-empty-steps'],
  'equivalent-cards': ['equivalent-accepted-not-expected'],
  'deal-shape': ['deal-duplicate', 'deal-count', 'deal-id'],
  'script-replay': ['script-not-held', 'script-follow-suit', 'script-learner', 'script-unreferenced', 'script-empty-indices', 'script-index-bounds', 'script-index-repeated'],
  'expected-answer': ['expected-illegal', 'expected-not-held', 'expected-inconsistent'],
  'alternative-continuation': ['alternative-illegal', 'alternative-winner', 'alternative-later-prompt'],
  'minibridge-redeal': ['minibridge-tie'],
  'hint-references': ['hint-hidden', 'hint-missing-references'],
  'rights-sign-off': ['lesson-rights', 'lesson-signOff', 'exercise-rights', 'exercise-signOff', 'prompt-rights', 'prompt-signOff'],
};
for (const [rule, names] of Object.entries(rules)) {
  test.each(names)(`US-27 / US-15: %s fails only ${rule}`, name => {
    const result = validateLesson(fixture(name));
    expect([...new Set(result.errors.map(finding => finding.rule))]).toEqual([rule]);
    for (const finding of result.errors) {
      expect(finding.contentId).toBeTruthy();
      expect(finding.message).toBeTruthy();
    }
  });
}
test('valid lesson has neither errors nor warnings', () => {
  expect(validateLesson(fixture('valid'))).toEqual({ errors: [], warnings: [] });
});
test('missing equivalents warn until accepted or rejected with a reason', () => {
  const lesson = fixture('equivalent-missing');
  const prompt = lesson.exercises[0].steps[2].prompt;
  expect(validateLesson(lesson).errors).toEqual([]);
  expect(validateLesson(lesson).warnings.map(f => f.rule)).toEqual(['equivalent-cards', 'equivalent-cards']);
  prompt.equivalentsReviewed = [
    { card: { suit: 'hearts', rank: 'K' }, decision: 'accept' },
    { card: { suit: 'hearts', rank: 'Q' }, decision: 'reject' },
  ];
  expect(validateLesson(lesson).errors).toEqual([expect.objectContaining({
    rule: 'equivalent-cards', message: expect.stringContaining('accepted but not in expectedAnswers'),
  })]);
  prompt.expectedAnswers.push(prompt.equivalentsReviewed[0].card);
  expect(validateLesson(lesson).errors).toEqual([]);
  expect(validateLesson(lesson).warnings).toHaveLength(1);
  prompt.equivalentsReviewed[1].reason = 'This Prompt teaches the highest card.';
  expect(validateLesson(lesson).warnings).toEqual([]);
});
test.each(['alternative-illegal', 'alternative-winner'])('%s passes when alternatives use the canonical continuation', name => {
  const lesson = fixture(name);
  const prompt = lesson.exercises[0].steps[2].prompt;
  prompt.acceptThenScripted = prompt.expectedAnswers.slice(1);
  expect(validateLesson(lesson).errors).toEqual([]);
});
test('only earlier exposures in the same exercise authorize hidden hint references', () => {
  const lesson = fixture('hint-hidden');
  const exercise = lesson.exercises[0];
  const exposure = { kind: 'exposure', cards: [{ seat: 'west', card: { suit: 'hearts', rank: 'J' } }] };
  exercise.steps.push(exposure);
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['hint-references']);
  exercise.steps.unshift(exposure);
  expect(validateLesson(lesson).errors).toEqual([]);
  lesson.exercises.push(fixture('hint-hidden').exercises[0]);
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['hint-references']);
});
test('hints can reference own, dummy and already played cards', () => {
  const lesson = fixture('valid');
  lesson.exercises[0].steps[2].prompt.hint.referencedCards = [
    { suit: 'hearts', rank: 'A' }, { suit: 'spades', rank: 'K' }, { suit: 'hearts', rank: '10' },
  ];
  expect(validateLesson(lesson).errors).toEqual([]);
});
test.each([null, {}, { gameFormat: 'contract-bridge', exercises: [null] }])('malformed input returns findings: %j', input => {
  expect(validateLesson(input).errors.map(f => f.rule)).toContain('lesson-shape');
});
describe('Node content command', () => {
  test.each([
    [[], 0], [['test/fixtures/lessons/deal-duplicate.json'], 1],
    [['test/fixtures/lessons/equivalent-missing.json'], 0],
  ] as const)('arguments %j exit %i', (args, status) => {
    const result = spawnSync(process.execPath, ['scripts/content/check.ts', ...args], { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr + result.stdout).toBe(status);
    if (status) expect(result.stdout).toContain('deal-shape [follow-suit.exercise]');
  });
});

// US-27.3b: the intervening rank matters only while it remains in another hand.
test('equivalence removes played ranks but retains unplayed opponents’ ranks', () => {
  const lesson = fixture('equivalent-missing');
  const exercise = lesson.exercises[0];
  const south = exercise.deal.hands.south;
  const north = exercise.deal.hands.north;
  [south[1], north[0]] = [north[0], south[1]];
  exercise.deal.dealId = dealIdOf(exercise.deal);
  exercise.script[0].action.card = north[0];
  expect(validateLesson(lesson).warnings.map(f => f.message)).toEqual([
    expect.stringContaining('hearts Q'),
  ]);
  // Lead the ten instead, leaving the king unplayed in North.
  [north[1], south[1]] = [south[1], north[1]];
  exercise.deal.dealId = dealIdOf(exercise.deal);
  exercise.script[0].action.card = north[1];
  expect(validateLesson(lesson)).toEqual({ errors: [], warnings: [] });
});
test('acceptThenScripted cannot authorize an illegal alternative', () => {
  const lesson = fixture('expected-illegal');
  const prompt = lesson.exercises[0].steps[2].prompt;
  prompt.acceptThenScripted = prompt.expectedAnswers.slice(1);
  expect(validateLesson(lesson).errors.map(f => f.rule)).toContain('expected-answer');
});
test('empty rights and sign-off values fail even when fields exist', () => {
  const lesson = fixture('valid');
  lesson.rights.source = '  ';
  lesson.signOff.status = '';
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['rights-sign-off']);
});

// US-27.3: accepted answers must remain legal after combinations of earlier answers.
test('later alternatives remain legal when an earlier alternative uses the canonical card', () => {
  const lesson = fixture('alternative-later-prompt');
  const first = lesson.exercises[0].steps[2].prompt;
  first.acceptThenScripted = [first.expectedAnswers[1]];
  expect(validateLesson(lesson).errors).toEqual([]);
});
test('a later acceptThenScripted marker cannot accept a card used by an earlier answer', () => {
  const lesson = fixture('alternative-later-prompt');
  const second = lesson.exercises[0].steps[4].prompt;
  second.acceptThenScripted = [second.expectedAnswers[1]];
  expect(validateLesson(lesson).errors).toEqual([expect.objectContaining({
    rule: 'alternative-continuation', contentId: second.contentId,
    message: expect.stringContaining('illegal after earlier answers'),
  })]);
});
test('enumeration limit fails explicitly instead of accepting unchecked branches', () => {
  const lesson = fixture('valid');
  const prompt = lesson.exercises[0].steps[2].prompt;
  // Even repeated authored answers consume work; cap the total probes, not just unique positions.
  prompt.expectedAnswers = Array.from({ length: 1025 }, () => prompt.expectedAnswers[0]);
  expect(validateLesson(lesson).errors).toEqual([expect.objectContaining({
    rule: 'alternative-continuation', message: expect.stringContaining('enumeration limit of 1024'),
  })]);
});

// US-27.3b: the canonical line plays the ace; the alternative leaves it equivalent to the queen.
test('equivalents are checked after earlier alternatives, with duplicate warnings suppressed', () => {
  const lesson = fixture('equivalent-after-alternative');
  const result = validateLesson(lesson);
  expect(result.errors).toEqual([]);
  expect(result.warnings).toEqual([{
    rule: 'equivalent-cards', contentId: 'follow-suit.second-prompt',
    message: 'Equivalent hearts A is not expected or reviewed (rejection needs a reason).',
  }]);
  const first = lesson.exercises[0].steps[2].prompt;
  first.expectedAnswers.push(first.expectedAnswers[1]);
  expect(validateLesson(lesson).warnings).toEqual(result.warnings);
  first.acceptThenScripted = [first.expectedAnswers[1]];
  expect(validateLesson(lesson).warnings).toEqual([]);
});
