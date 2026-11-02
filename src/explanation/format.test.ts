import { expect, test } from 'vitest';
import { checkMessage, formatMessage, list, messageShape, number, parseMessage, requiredPluralCategories } from './format';
import { cardName, text } from './index';

test('I18N-06: parses literals and arguments, preserving apostrophes and missing arguments', () => {
  expect(parseMessage("It's {name}’s #")).toEqual([
    { type: 'literal', value: "It's " }, { type: 'argument', name: 'name' }, { type: 'literal', value: '’s #' },
  ]);
  expect(formatMessage("It's {name}’s {missing}", { name: 'Sam' })).toBe("It's Sam’s {missing}");
  expect(formatMessage('{name} {n}', { name: '1234.5', n: 1234.5 })).toBe('1234.5 1,234.5');
  expect(formatMessage('{toString} {constructor}', {})).toBe('{toString} {constructor}');
});

test('I18N-06: plural/select AST and rendering support nested branches and nearest plural #', () => {
  expect(parseMessage('{x, select, a {A} other {{n}}}')).toEqual([{
    type: 'select', name: 'x', branches: new Map([
      ['a', [{ type: 'literal', value: 'A' }]], ['other', [{ type: 'argument', name: 'n' }]],
    ]),
  }]);
  expect(parseMessage('{n, plural, other {#}}')).toEqual([{
    type: 'plural', name: 'n', branches: new Map([['other', [{ type: 'pound' }]]]),
  }]);
  const message = '{n, plural, =0 {none} one {{name}: #} other {{x, select, a {# outer, {m, plural, one {# inner} other {# inners}}, # again} other {fallback #}}}}';
  expect(formatMessage(message, { n: 0 })).toBe('none');
  expect(formatMessage(message, { n: 1, name: 'Sam' })).toBe('Sam: 1');
  expect(formatMessage(message, { n: 1234, x: 'a', m: 2 })).toBe('1,234 outer, 2 inners, 1,234 again');
  expect(formatMessage(message, { n: 3, x: 'unknown' })).toBe('fallback 3');
  expect(formatMessage('{x, select, a {{n, plural, one {one} other {#}}} other {#}}', { x: 'a', n: 2 })).toBe('2');
  expect(formatMessage('{x, select, a {A} other {#}}', { x: 'unknown' })).toBe('#');
  expect(formatMessage('{x, select, constructor {own} other {fallback}}', { x: 'constructor' })).toBe('own');
});

test.each([
  ['{', /argument/], ['}', /closing brace/], ['{}', /argument name/],
  ['{n, unknown, other {x}}', /Unknown argument type/],
  ['{n, plural, one {x}}', /other branch/], ['{x, select, a {x}}', /other branch/],
  ['{n, plural, {x} other {y}}', /Empty selector/],
  ['{n, plural, other {x', /Unterminated branch/],
  ['{n, plural, other {x}', /Unterminated plural/],
  ['{n, plural, nonsense {x} other {y}}', /Invalid plural selector/],
  ['{x, select, other {x} other {y}}', /Duplicate selector/],
  ['{n plural}', /comma/], ['{n, plural other {x}}', /comma/],
  ['{n, plural, other x}', /opening brace/],
])('I18N-06.2: malformed message %s fails descriptively', (message, error) => {
  expect(() => parseMessage(message)).toThrow(error);
  expect(checkMessage(message)).toHaveLength(1);
});

const allCategories = '{n, plural, zero {zero} one {one} two {two} few {few} many {many} other {other}}';
test.each([
  ['en', 1, 'one'], ['en', 0, 'other'], ['en', 2, 'other'],
  ['es', 1, 'one'], ['es', 2, 'other'], ['es', 1_000_000, 'many'],
  ['zh-Hans', 1, 'other'], ['ja', 1, 'other'], ['zh-Hant', 2, 'other'],
])('I18N-06: %s selects %s as %s', (locale, n, category) => {
  expect(formatMessage(allCategories, { n }, locale)).toBe(category);
});

test('I18N-06: exact branches precede CLDR and missing categories fall back to other', () => {
  expect(formatMessage('{n, plural, =1 {exact} one {category} other {fallback}}', { n: 1 })).toBe('exact');
  expect(formatMessage('{n, plural, =-1 {negative} =1.5 {fraction} other {fallback}}', { n: -1 })).toBe('negative');
  expect(formatMessage('{n, plural, =1.5 {fraction} other {fallback}}', { n: 1.5 })).toBe('fraction');
  expect(formatMessage('{n, plural, one {one} other {fallback}}', { n: 1_000_000 }, 'es')).toBe('fallback');
  const invalidParams: Record<string, string | number>[] = [{}, { n: '1' }, { n: NaN }, { n: Infinity }];
  for (const params of invalidParams) {
    expect(() => formatMessage(allCategories, params)).toThrow(/finite number/);
  }
});

test.each([
  ['en', ['one', 'other']], ['es', ['one', 'other']],
  ['zh-Hans', ['other']], ['ja', ['other']], ['zh-Hant', ['other']],
])('I18N-06.1: required whole-number categories for %s', (locale, categories) => {
  expect(requiredPluralCategories(locale)).toEqual(categories);
  expect(requiredPluralCategories(locale)).toBe(requiredPluralCategories(locale));
});

test('I18N-06.1: shapes ignore wording, ordering and plural categories, retaining nested names and select keys', () => {
  expect(messageShape('{n, plural, one {{name}} other {{x, select, a {A} other {B}}}}')).toEqual({
    arguments: ['n', 'name', 'x'], choices: [{ name: 'n', type: 'plural' }, { name: 'x', type: 'select', keys: ['a', 'other'] }],
  });
  expect(messageShape('{a} {b} {a}')).toEqual(messageShape('{b} {a}'));
  expect(checkMessage('{x, select, other {{n, plural, other {#}}}}', 'en')).toEqual([expect.stringContaining('missing one')]);
});

test('I18N-07: locale list and number helpers', () => {
  expect(list(['A', 'B', 'C'])).toBe('A, B, and C');
  expect(list(['A', 'B', 'C'], 'zh-Hans')).toBe('A、B和C');
  expect(list(['A', 'B', 'C'], 'es')).toBe('A, B y C');
  expect(list(['A', 'B'])).toBe('A and B');
  expect(list([])).toBe(''); expect(list(['A'])).toBe('A');
  expect(number(1234.5)).toBe('1,234.5');
  expect(number(1234.5, 'de')).toBe('1.234,5');
  expect(formatMessage('{n, plural, other {#}} / {n}', { n: 1234.5 }, 'de')).toBe('1.234,5 / 1.234,5');
});

test('I18N-07: merged messages preserve English singular, plural, scores and card names', () => {
  expect(text('moment.heading', { count: 1 })).toBe('1 big moment');
  expect(text('moment.heading', { count: 2 })).toBe('2 big moments');
  expect(text('home.session', { count: 1 })).toBe('1 deal played this session.');
  expect(text('home.session', { count: 0 })).toBe('0 deals played this session.');
  expect(text('result.down', { count: 1 })).toBe('So close. Down 1.');
  expect(text('result.down', { count: 2 })).toBe('So close. Down 2 tricks.');
  expect(cardName({ rank: 'A', suit: 'spades' })).toBe('Ace of spades');
  expect(cardName({ rank: '10', suit: 'hearts' })).toBe('10 of hearts');
});
