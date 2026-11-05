import { describe, expect, test } from 'vitest';
import { catalogue, currentLanguageTag, currentLocale, list, number, setLocale, text } from './index';
import { withLocale } from '../../test/withLocale';

describe('E-06: setup resets module state between tests', () => {
  test('a test leaves the stub active', () => {
    setLocale('es', { product: { ...catalogue.product, text: 'Producto' } }, 'es-419');
    expect(currentLocale()).toBe('es');
    expect(currentLanguageTag()).toBe('es-419');
    expect(text('product')).toBe('Producto');
  });
  test('the following test starts in English', () => {
    expect(currentLocale()).toBe('en');
    expect(currentLanguageTag()).toBe('en');
    expect(text('product')).toBe(catalogue.product.text);
  });
});
test('I18N-08, I18N-11.2: internal and absent entries use English text and formatting', async () => {
  await withLocale('es', {
    'bench.title': { ...catalogue['bench.title'], text: 'Changed' },
    'tricks': { ...catalogue.tricks, text: '{won} / {target}' },
  }, () => {
    expect(currentLanguageTag()).toBe('es');
    expect(text('bench.title')).toBe(catalogue['bench.title'].text);
    expect(text('product')).toBe(catalogue.product.text);
    expect(text('tricks', { won: 1234567, target: 9 })).toBe('1.234.567 / 9');
    expect(text('result.score', { score: 1234567, side: 'NS' })).toBe('Score: 1,234,567 for NS');
    expect(number(1234567)).toBe('1.234.567');
    expect(list(['A', 'B', 'C'])).toBe('A, B y C');
    expect(number(1234567, 'en')).toBe('1,234,567');
  });
  expect(currentLocale()).toBe('en');
  expect(currentLanguageTag()).toBe('en');
});

test('U-20: formatting uses the language tag while identity stays the catalogue ID', () => {
  setLocale('es', { tricks: { ...catalogue.tricks, text: '{won} / {target}' } }, 'es-419');
  expect(currentLocale()).toBe('es');
  expect(currentLanguageTag()).toBe('es-419');
  expect(text('tricks', { won: 1234567, target: 9 })).toBe('1,234,567 / 9');
  expect(number(1234567)).toBe('1,234,567');
  expect(list(['A', 'B', 'C'])).toBe('A, B y C');
});

test('I18N-07: list formatting uses the language tag rather than the catalogue ID', () => {
  setLocale('en', catalogue, 'en-GB');
  expect(list(['A', 'B', 'C'])).toBe('A, B and C');
  expect(list(['A', 'B', 'C'], 'en')).toBe('A, B, and C');
});
test('E-06: withLocale restores English after an asynchronous rejection', async () => {
  await expect(withLocale('ja', {}, async () => {
    await Promise.resolve();
    throw new Error('test failure');
  })).rejects.toThrow('test failure');
  expect(currentLocale()).toBe('en');
});
