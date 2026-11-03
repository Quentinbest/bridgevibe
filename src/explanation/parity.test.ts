import { expect, test } from 'vitest';
import { catalogue } from './index';
import { checkMessage } from './format';
import { parityErrors } from './parity';

test('I18N-06.1/2: every English entry is a valid message', () => {
  expect(Object.entries(catalogue).flatMap(([key, entry]) => checkMessage(entry.text, 'en').map(error => `${key}: ${error}`))).toEqual([]);
});

const base = { greeting: { text: 'Hello {name}' }, count: { text: '{n, plural, one {{name}: #} other {{name}: #}}' } };
test('I18N-06.1: parity rejects dropped placeholders, required branches and malformed messages', () => {
  expect(parityErrors(base, { ...base, greeting: { text: 'Hola' } }, 'es')).toEqual(['greeting: message shape differs']);
  expect(parityErrors(base, { ...base, count: { text: '{n, plural, other {{name}: #}}' } }, 'es')).toEqual([expect.stringContaining('count: Plural argument n missing one')]);
  expect(parityErrors(base, { ...base, greeting: { text: '{name' } }, 'es')).toEqual([expect.stringContaining('greeting:')]);
  expect(parityErrors(base, { greeting: { text: '你好{name}' }, count: { text: '{n, plural, other {{name}：#}}' } }, 'zh-Hans')).toEqual([]);
});

test('I18N-06.1: parity rejects added arguments, changed choice types/keys and missing catalogue keys', () => {
  expect(parityErrors({ x: { text: '{a}' } }, { x: { text: '{a} {b}' } })).toEqual(['x: message shape differs']);
  expect(parityErrors({ x: { text: '{a, plural, other {#}}' } }, { x: { text: '{a, select, other {x}}' } }, 'ja')).toEqual(['x: message shape differs']);
  expect(parityErrors({ x: { text: '{a, select, female {F} other {X}}' } }, { x: { text: '{a, select, male {M} other {X}}' } })).toEqual(['x: message shape differs']);
  expect(parityErrors(base, { greeting: base.greeting })).toEqual(['count: missing catalogue key']);
  expect(parityErrors({}, { extra: { text: 'X' } })).toEqual(['extra: missing catalogue key']);
});
