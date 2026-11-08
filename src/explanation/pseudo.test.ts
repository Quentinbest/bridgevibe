import { expect, test } from 'vitest';
import { catalogue } from './index';
import { formatMessage, parseMessage } from './format';
import { parityErrors } from './parity';
import { pseudoLocalise, stubCatalogue } from './pseudo';

const learner = Object.fromEntries(Object.entries(catalogue).filter(([, entry]) => entry.scope === 'learner'));
test('CJK stub preserves card faces, suits and the brand name', () => {
  const stub = stubCatalogue(learner, 'cjk');
  for (const key of Object.keys(learner).filter(key => /^(face|symbol)\.|^product(\.|$)/.test(key))) expect(stub[key]).toEqual(learner[key]);
  expect(stub.product?.text).toBe('BridgeVibe');
});
test.each([['en', pseudoLocalise(learner)], ['es', stubCatalogue(learner, 'long')], ['ja', stubCatalogue(learner, 'cjk')]] as const)('preview %s preserves messages', (locale, result) => {
  expect(parityErrors(learner, result, locale)).toEqual([]);
  for (const entry of Object.values(result)) expect(() => parseMessage(entry.text)).not.toThrow();
  expect(formatMessage(result['moment.position'].text, { n: 2, card: 'CARD' }, locale)).toContain('CARD');
});
