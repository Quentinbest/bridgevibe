import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { dealFromSeed, dealIdOf } from '../table';
import { catalogue } from '../explanation';
import { validateLesson } from './validate';

const fixture = (name: string) => JSON.parse(readFileSync(`test/fixtures/lessons/${name}.json`, 'utf8'));
const rules = {
  'lesson-shape': ['lesson-empty-exercises', 'exercise-empty-steps', 'module-missing', 'module-out-of-range'],
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

// ADR-0001: the Prompt, reviews included, reaches the learner snapshot.
test('reviewed equivalents must be cards in the acting hand', () => {
  const lesson = fixture('valid');
  const prompt = lesson.exercises[0].steps[2].prompt;
  prompt.equivalentsReviewed = [{ card: lesson.exercises[0].deal.hands.west[0], decision: 'reject', reason: 'Hidden.' }];
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['equivalent-cards']);
  prompt.equivalentsReviewed = [{ card: prompt.expectedAnswers[1], decision: 'maybe' }];
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['equivalent-cards']);
});
test.each([{}, { northSouth: 'yes', eastWest: false }])('vulnerability flags must be booleans: %j', vulnerability => {
  const lesson = fixture('valid');
  const deal = lesson.exercises[0].deal;
  deal.vulnerability = vulnerability;
  deal.dealId = dealIdOf(deal);
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['deal-shape']);
});
test.each([
  ['lesson', (lesson: ReturnType<typeof fixture>) => { lesson.contentId = ''; }],
  ['exercise', (lesson: ReturnType<typeof fixture>) => { delete lesson.exercises[0].version; }],
  ['prompt', (lesson: ReturnType<typeof fixture>) => { lesson.exercises[0].steps[2].prompt.version = 0; }],
])('%s needs a contentId and a positive version', (_, change) => {
  const lesson = fixture('valid');
  change(lesson);
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['lesson-shape']);
});
// CI-8: references resolve against the catalogue the caller passes in.
test('catalogue references must exist', () => {
  const ids = new Set(Object.keys(catalogue));
  const lesson = fixture('valid');
  expect(validateLesson(lesson, ids)).toEqual({ errors: [], warnings: [] });
  delete lesson.exercises[0].steps[2].prompt.textRef;
  lesson.exercises[0].steps[2].prompt.hint.textRef = 'lesson.missing';
  lesson.titleRef = 'lesson.missing';
  lesson.exercises[0].steps[0].textRef = 'lesson.missing';
  // US-27: the missing Prompt field stops this Exercise; the Lesson title is checked independently.
  expect(validateLesson(lesson, ids).errors.map(f => f.rule)).toEqual(Array(2).fill('catalogue-reference'));
});
// US-15.2: the exposure is checked at its own step, after earlier scripted plays.
test('exposures must name cards the seat still holds', () => {
  const lesson = fixture('valid');
  const exercise = lesson.exercises[0];
  const lead = exercise.script[0];
  exercise.steps.splice(2, 0, { kind: 'exposure', cards: [{ seat: lead.seat, card: lead.action.card }] });
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['hint-references']);
  exercise.steps[2].cards[0].card = exercise.deal.hands[lead.seat].find((card: { rank: string }) => card.rank !== lead.action.card.rank);
  expect(validateLesson(lesson).errors).toEqual([]);
});

// US-27: exercise the entire authored shape through the public validator, before any replay.
const completeLesson = () => {
  const lesson = fixture('valid');
  const prompt = lesson.exercises[0].steps[2].prompt;
  prompt.acceptThenScripted = [prompt.expectedAnswers[1]];
  prompt.equivalentsReviewed = [{ card: prompt.expectedAnswers[1], decision: 'accept', reason: '' }];
  lesson.exercises[0].steps.unshift({ kind: 'exposure', cards: [{ seat: 'west', card: { suit: 'hearts', rank: 'J' } }] });
  return lesson;
};
type Path = (string | number)[];
function paths(value: unknown, path: Path = []): Path[] {
  if (value === null || typeof value !== 'object') return [path];
  return [path, ...Object.entries(value).flatMap(([key, child]) => paths(child, [...path, Array.isArray(value) ? Number(key) : key]))];
}
const shapePaths = paths(completeLesson());
const at = (lesson: ReturnType<typeof fixture>, path: Path) => path.reduce((value, key) => value[key], lesson);
const optional = new Set(['countsRejections', 'acceptThenScripted', 'equivalentsReviewed', 'hint', 'reason']);

test.each(shapePaths.map(path => [path.join('.'), path] as const))('rejects malformed field %s without replay cascades', (_, path) => {
  const lesson = completeLesson();
  const old = at(lesson, path);
  const malformed = typeof old === 'object' ? null : typeof old === 'string' ? 42 : 'wrong-type';
  if (!path.length) {
    expect(validateLesson(malformed).errors).toHaveLength(1);
    return;
  }
  at(lesson, path.slice(0, -1))[path.at(-1)!] = malformed;
  const result = validateLesson(lesson);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].message).toContain('Invalid');
  expect(result.warnings).toEqual([]);
});

test.each(shapePaths.filter(path => path.length && typeof path.at(-1) === 'string')
  .map(path => [path.join('.'), path] as const))('checks required or optional presence of %s', (_, path) => {
  const lesson = completeLesson();
  const key = path.at(-1)!;
  delete at(lesson, path.slice(0, -1))[key];
  expect(validateLesson(lesson).errors).toHaveLength(optional.has(String(key)) ? 0 : 1);
});

test.each(shapePaths.filter(path => {
  const value = at(completeLesson(), path);
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}).map(path => [path.join('.'), path] as const))('rejects unknown keys on %s', (_, path) => {
  const lesson = completeLesson();
  at(lesson, path).countRejections = false;
  expect(validateLesson(lesson).errors).toHaveLength(1);
  expect(validateLesson(lesson).errors[0].message).toContain('unknown key');
});

test.each([
  ['skillTags', []], ['exercises.0.steps.2.prompt.skillTags', []],
  ['exercises.0.steps.2.prompt.countsRejections', false],
])('allows valid empty arrays and false: %s', (path, value) => {
  const lesson = fixture('valid');
  const parts = path.split('.');
  at(lesson, parts.slice(0, -1))[parts.at(-1)!] = value;
  expect(validateLesson(lesson)).toEqual({ errors: [], warnings: [] });
});
test.each([
  ['skillTags', [' ']], ['skillTags', 'follow-suit'],
  ['exercises.0.steps.2.prompt.skillTags', ['']],
  ['exercises.0.steps.2.prompt.countsRejections', 'false'],
  ['schemaVersion', 2], ['signOff.status', 'approved'],
  ['exercises.0.learnerSide', 'eastWest'], ['exercises.0.steps.0.kind', 'unknown'],
  ['exercises.0.steps.2.prompt.answerKind', 'bid'], ['exercises.0.steps.2.prompt.promptId', ' '],
  ['exercises.0.script.0.action.kind', 'bid'], ['exercises.0.steps.1.scriptIndices', [0.5]],
])('rejects invalid model value at %s', (path, value) => {
  const lesson = fixture('valid');
  const parts = path.split('.');
  at(lesson, parts.slice(0, -1))[parts.at(-1)!] = value;
  expect(validateLesson(lesson).errors).toHaveLength(1);
});

test.each([
  null, {}, { kind: 'other' }, { kind: 'authored', contentId: '', version: 1 },
  { kind: 'authored', contentId: 'test', version: 0 },
  ...['kind', 'seed', 'index', 'rotation', 'algorithm'].map(key => {
    const origin: Record<string, unknown> = { kind: 'seed', seed: 'abc', index: 1, rotation: 0, algorithm: 'bv-deal-1' };
    delete origin[key];
    return origin;
  }),
  ...[{ seed: 'bad seed' }, { seed: '' }, { seed: 'a'.repeat(65) }, { index: 0 }, { index: 1.5 },
    { index: Number.MAX_SAFE_INTEGER + 1 }, { rotation: 1 }, { algorithm: 'other' }, { extra: true }]
    .map(change => ({ kind: 'seed', seed: 'abc', index: 1, rotation: 0, algorithm: 'bv-deal-1', ...change })),
])('rejects malformed Deal origin: %j', origin => {
  const lesson = fixture('valid');
  lesson.exercises[0].deal.origin = origin;
  expect(validateLesson(lesson).errors).toEqual([expect.objectContaining({ rule: 'deal-shape' })]);
});

test('structural failure stops only the affected Exercise and preserves its Prompt identity', () => {
  const lesson = fixture('valid');
  lesson.exercises[0].steps[2].prompt.countsRejections = 'false';
  lesson.exercises[0].script[0].action.card = { suit: 'clubs', rank: '2' };
  lesson.exercises.push(fixture('script-not-held').exercises[0]);
  const result = validateLesson(lesson);
  expect(result.errors.map(f => f.rule)).toEqual(['lesson-shape', 'script-replay']);
  expect(result.errors[0].contentId).toBe('follow-suit.prompt');
});

test('catalogue membership checks all references on structurally valid content', () => {
  const lesson = fixture('valid');
  const prompt = lesson.exercises[0].steps[2].prompt;
  lesson.titleRef = 'missing';
  lesson.exercises[0].steps[0].textRef = 'missing';
  for (const key of ['textRef', 'commentaryRef', 'correctRef', 'wrongRef', 'shownRef']) prompt[key] = 'missing';
  prompt.hint.textRef = 'missing';
  expect(validateLesson(lesson, new Set(Object.keys(catalogue))).errors.map(f => f.rule))
    .toEqual(Array(8).fill('catalogue-reference'));
});

// US-15.2 / US-27.3a: exposures use the position reached by the learner's actual answers.
test.each([3, 5])('checks exposures after alternative answers, including trailing Steps (%i)', index => {
  const lesson = fixture('valid');
  const exercise = lesson.exercises[0];
  const prompt = exercise.steps[2].prompt;
  exercise.steps.splice(index, 0, { kind: 'exposure', cards: [{ seat: 'south', card: prompt.expectedAnswers[1] }] });
  expect(validateLesson(lesson).errors).toEqual([expect.objectContaining({ rule: 'hint-references' })]);
  prompt.acceptThenScripted = [prompt.expectedAnswers[1]];
  expect(validateLesson(lesson)).toEqual({ errors: [], warnings: [] });
});
test('exposures check later alternatives on lines with multiple Prompts', () => {
  const lesson = fixture('equivalent-after-alternative');
  const exercise = lesson.exercises[0];
  const second = exercise.steps[4].prompt;
  const card = { suit: 'spades', rank: '2' };
  second.expectedAnswers.push(card);
  exercise.steps.push({ kind: 'exposure', cards: [{ seat: 'south', card }] });
  expect(validateLesson(lesson).errors.map(f => f.rule)).toEqual(['hint-references']);
  second.acceptThenScripted = [card];
  expect(validateLesson(lesson).errors).toEqual([]);
});

test('accepts a valid seeded origin', () => {
  const lesson = fixture('valid');
  const exercise = lesson.exercises[0];
  exercise.deal = dealFromSeed('lesson-56', 1);
  exercise.script = [];
  exercise.steps = [{ kind: 'commentary', textRef: 'lesson.intro' }];
  expect(validateLesson(lesson)).toEqual({ errors: [], warnings: [] });
});

// US-03, US-04.3: a seeded origin is provenance; it must reproduce the authored Deal.
test('seeded origins must reproduce the Deal', () => {
  const lesson = fixture('valid');
  const exercise = lesson.exercises[0];
  exercise.deal = dealFromSeed('lesson-seed', 3);
  expect(validateLesson(lesson).errors.map(f => f.rule)).not.toContain('deal-shape');
  exercise.deal = { ...fixture('valid').exercises[0].deal, origin: { kind: 'seed', seed: 'lesson-seed', index: 3, rotation: 0, algorithm: 'bv-deal-1' } };
  expect(validateLesson(lesson).errors).toEqual([expect.objectContaining({ rule: 'deal-shape', message: 'Seeded origin does not reproduce this Deal.' })]);
});

// FR-L2: modules are required integers in the ten-module curriculum.
test.each([undefined, null, 0, 11, -1, 2.5, '2', true, NaN, Infinity])('rejects invalid module %s', module => {
  const lesson = fixture('valid');
  lesson.module = module;
  expect(validateLesson(lesson)).toEqual({ errors: [{
    rule: 'lesson-shape', contentId: lesson.contentId, message: 'Invalid lesson.module.',
  }], warnings: [] });
});
test.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('accepts curriculum module %i', module => {
  const lesson = fixture('valid');
  lesson.module = module;
  expect(validateLesson(lesson)).toEqual({ errors: [], warnings: [] });
});
test.each(['follow-suit', 'follow-suit-full'])('FR-L2 / ADR-0004: %s declares module 2 at Lesson version 2', name => {
  const lesson = JSON.parse(readFileSync(`src/curriculum/content/${name}.json`, 'utf8'));
  expect(lesson).toMatchObject({ module: 2, version: 2, signOff: { status: 'unsigned-draft' } });
  expect(validateLesson(lesson, new Set(Object.keys(catalogue)))).toEqual({ errors: [], warnings: [] });
});
