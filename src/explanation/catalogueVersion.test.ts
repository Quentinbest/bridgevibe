import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { catalogue, catalogueVersion, setLocale } from './index';
import { versionOf } from './catalogueVersion';

// E-04: independent canonicalisation and the platform hash are the oracle.
function expected(value: object): string {
  const json = JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]])) : item);
  return createHash('sha256').update(json).digest('hex').slice(0, 12);
}
test('E-04: real and stub catalogues match SHA-256 and remain stable across calls and key order', () => {
  const stub = { product: { ...catalogue.product, text: '桥牌 🂡' } };
  for (const entries of [catalogue, stub]) {
    setLocale('en', entries);
    expect(catalogueVersion()).toBe(expected(entries));
    expect(catalogueVersion()).toBe(catalogueVersion());
    expect(versionOf(Object.fromEntries(Object.entries(entries).reverse()))).toBe(catalogueVersion());
  }
  const original = catalogueVersion();
  setLocale('en', { product: { ...stub.product, text: 'Changed' } });
  expect(catalogueVersion()).not.toBe(original);
  expect(versionOf({ product: { ...stub.product, status: 'approved' } })).not.toBe(original);
});
test('E-04: UTF-8, padding boundaries and recursively sorted full entry objects match node:crypto', () => {
  for (const length of [0, 1, 40, 55, 56, 63, 64, 65, 120, 1000]) {
    const value = { z: [{ z: '文'.repeat(length), a: '🂡' }], a: { b: 2, a: 1 } };
    expect(versionOf(value)).toBe(expected(value));
    expect(versionOf({ a: { a: 1, b: 2 }, z: [{ a: '🂡', z: '文'.repeat(length) }] })).toBe(expected(value));
  }
});
