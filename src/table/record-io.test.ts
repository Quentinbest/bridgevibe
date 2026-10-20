import { expect, test } from 'vitest';
import clean from '../../test/fixtures/records/column-order.pbn?raw';
import annotated from '../../test/fixtures/records/column-order-annotated.pbn?raw';
import { dealFromSeed, dealIdOf, exportPbn, exportRecordJson, importPbn, importRecordJson, SEATS, startPlaythrough, type Deal } from './index';

// US-04.3: rotating columns must not make an incorrect opening leader acceptable.
test.each(['N', 'E', 'S'])('PBN rejects Play %s when South declares', leader => {
  const offset = ['W', 'N', 'E', 'S'].indexOf(leader);
  const rotated = clean.replace('[Play "W"]', `[Play "${leader}"]`).split('\n').map(line => {
    if (!/^[SHDC][AKQJT2-9] /.test(line)) return line;
    const cards = line.split(' ');
    return [...cards.slice(offset), ...cards.slice(0, offset)].join(' ');
  }).join('\n');
  expect(() => importPbn(rotated)).toThrow(/PBN parse error:.*opening leader/);
});
const seeded = dealFromSeed('review-import', 3);
function jsonFor(deal: Deal) {
  return exportRecordJson(startPlaythrough({ deal, contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' }).record());
}
test('US-03.4, US-04.3: imported JSON verifies content identity', () => {
  expect(importRecordJson(jsonFor(seeded)).deal).toEqual(seeded);
  expect(() => importRecordJson(jsonFor({ ...seeded, dealId: 'deal-tampered' }))).toThrow(/dealId/);
});
test.each([{ seed: 'other-seed' }, { index: 4 }])('JSON rejects altered seed origin %j', changed => {
  const deal = { ...seeded, origin: { kind: 'seed' as const, seed: 'review-import', index: 3, rotation: 0 as const, algorithm: 'bv-deal-1' as const, ...changed } };
  expect(() => importRecordJson(jsonFor(deal))).toThrow(/seed.*reproduce/);
});
test('JSON rejects an unsupported dealing algorithm', () => {
  expect(() => importRecordJson(jsonFor(seeded).replace('bv-deal-1', 'bv-deal-2'))).toThrow(/JSON parse error/);
});
test.each(['hands', 'dealer', 'vulnerability'] as const)('JSON verifies seeded %s even with a recomputed ID', field => {
  const changed = { ...seeded,
    ...(field === 'hands' ? { hands: { ...seeded.hands, north: seeded.hands.east, east: seeded.hands.north } } : {}),
    ...(field === 'dealer' ? { dealer: SEATS[(SEATS.indexOf(seeded.dealer) + 1) % 4] } : {}),
    ...(field === 'vulnerability' ? { vulnerability: { ...seeded.vulnerability, northSouth: !seeded.vulnerability.northSouth } } : {}),
  };
  expect(() => importRecordJson(jsonFor({ ...changed, dealId: dealIdOf(changed) }))).toThrow(/seed.*reproduce/);
});
test('JSON identity ignores card order within a hand', () => {
  const reversed = { ...seeded, hands: { ...seeded.hands, north: [...seeded.hands.north].reverse() } };
  const json = jsonFor(JSON.parse(JSON.stringify(reversed)));
  expect(importRecordJson(json).deal.hands.north).toEqual(reversed.hands.north);
});
test('PBN comments and annotations preserve the entire imported record except its new ID', () => {
  const original = importPbn(clean), withAnnotations = importPbn(annotated);
  expect({ ...withAnnotations, playthroughId: original.playthroughId }).toEqual(original);
});
test('PBN comment markers in quoted tag values are not comments', () => {
  expect(() => importPbn(clean.replace('Hand-checked column order', 'Quoted {text}; $1 !?'))).not.toThrow();
});
test.each(['SZ!', 'S10?', 'S!2', 'S2???', '$x', 'S2junk!', 'S2$1junk'])('PBN annotations do not conceal malformed card token %s', token => {
  expect(() => importPbn(clean.replace('S2 SA SK SQ', `${token} SA SK SQ`))).toThrow(/PBN parse error/);
});
test('PBN rejects unterminated brace comments', () => {
  expect(() => importPbn(clean + '\n{unfinished')).toThrow(/PBN parse error/);
});

test('PBN escape lines anywhere preserve the imported record', () => {
  const escaped = '% PBN 2.1\n' + clean.replace('[Dealer', '% EXPORT\n[Dealer')
    .replace('CK SJ HJ DQ', '% metadata { unclosed quote " must be ignored\nCK SJ HJ DQ') + '% end\n';
  const original = importPbn(clean), imported = importPbn(escaped);
  expect({ ...imported, playthroughId: original.playthroughId }).toEqual(original);
});
test('PBN exports South-dealt hands clockwise from South and still imports North-first', () => {
  const original = importPbn(clean.replace('[Dealer "N"]', '[Dealer "S"]'));
  const exported = exportPbn(original);
  expect(exported).toContain('[Deal "S:Q..QJT98765432.A 2...KQJT98765432 AJT9876543.AKQ.. K.JT98765432.AK."]');
  const imported = importPbn(exported);
  expect({ ...imported, playthroughId: original.playthroughId }).toEqual(original);
});
