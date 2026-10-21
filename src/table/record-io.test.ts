import { expect, test } from 'vitest';
import clean from '../../test/fixtures/records/column-order.pbn?raw';
import annotated from '../../test/fixtures/records/column-order-annotated.pbn?raw';
import fixed from '../../test/fixtures/records/fixed.json';
import { dealFromSeed, dealIdOf, exportPbn, exportRecordJson, importPbn, importRecordJson, SEATS, startMiniBridge, startPlaythrough, type Deal } from './index';

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

// US-04.3, CI-5: PBN carries no provenance, so imported plays say they were imported.
test('PBN-imported plays carry imported provenance, whatever their controller', () => {
  const record = importPbn(clean);
  expect(record.actions).toHaveLength(52);
  for (const entry of record.actions) expect(entry.provenance).toEqual({ kind: 'imported', format: 'pbn' });
  expect(new Set(record.actions.map(entry => entry.controller))).toEqual(new Set(['learner', 'robot']));
});

// US-04.3: JSON is lossless for every record the public APIs produce, PBN imports included.
test('a PBN-imported record round-trips through JSON', () => {
  const imported = importPbn(clean);
  expect(importRecordJson(exportRecordJson(imported))).toEqual(JSON.parse(exportRecordJson(imported)));
});
// US-04.1: JSON import requires provenance on every action.
test('JSON import rejects an action without provenance', () => {
  const record = structuredClone(fixed) as { actions: { provenance?: unknown }[] };
  expect(() => importRecordJson(JSON.stringify(record))).not.toThrow();
  delete record.actions[1].provenance;
  expect(() => importRecordJson(JSON.stringify(record))).toThrow(/Invalid record schema/);
});

// US-04.3: PBN preserves MiniBridge setup in a supplemental tag; play provenance remains imported.
function miniBridgeRecord() {
  const setup = startMiniBridge({ deal: dealFromSeed('setup-ui', 1), learnerSide: 'northSouth' });
  while (setup.seatView('south').step !== 'contract-choice') setup.advance();
  const seat = setup.seatView('south').declarer!, controller = setup.controllerOf(seat);
  setup.submit(seat, controller, { kind: 'choose-contract', strain: 'no-trumps', objective: 'game' }, controller === 'robot'
    ? { kind: 'robot', policy: 'quoted-"policy"\\{literal};', version: '0', ruleId: 'placeholder-dep-02', durationMs: 1 } : undefined);
  const table = setup.playthrough()!;
  for (let i = 0; i < 52; i++) {
    const turn = table.seatView('south').turn!, owner = table.controllerOf(turn);
    table.submit(turn, owner, table.legalActions(turn)[0], owner === 'robot'
      ? { kind: 'robot', policy: 'test', version: '0', durationMs: 0 } : undefined);
  }
  return table.completedRecord();
}
test('US-04.3: MiniBridge PBN round-trips every setup event, objective and provenance with safe escaping', () => {
  const record = miniBridgeRecord(), pbn = exportPbn(record);
  expect(pbn).toContain('[BridgeVibeSetup "');
  expect(record.setupEvents?.some(event => event.kind === 'redeal')).toBe(true);
  const imported = importPbn(pbn);
  expect(imported).toMatchObject({ gameFormat: 'minibridge', setupEvents: record.setupEvents,
    contract: record.contract, result: record.result, deal: record.deal });
  expect(imported.actions.every(action => action.provenance.kind === 'imported')).toBe(true);
  expect(importRecordJson(exportRecordJson(imported))).toEqual(JSON.parse(exportRecordJson(imported)));
  const withoutSetup = importPbn(pbn.split('\n').filter(line => !line.startsWith('[BridgeVibeSetup ')).join('\n'));
  expect(withoutSetup.gameFormat).toBe('contract-bridge'); expect(withoutSetup.setupEvents).toEqual([]);
});
test.each(['announcement', 'redeal', 'declarer', 'dummy-exposed', 'contract-choice', 'provenance', 'deal', 'format', 'shape', 'json'])('US-04.3: tampered PBN supplemental %s is a parse error', field => {
  const pbn = exportPbn(miniBridgeRecord());
  const tag = pbn.match(/\[BridgeVibeSetup ("(?:\\.|[^"\\])*")\]/)!;
  expect(tag).not.toBeNull();
  const payload = JSON.parse(JSON.parse(tag[1]));
  if (field === 'deal') [payload.deal.hands.north, payload.deal.hands.south] = [payload.deal.hands.south, payload.deal.hands.north];
  else if (field === 'format') payload.gameFormat = 'contract-bridge';
  else if (field === 'shape') delete payload.setupEvents;
  else if (field === 'provenance') payload.setupEvents.at(-1).provenance.ruleId = ' ';
  else if (field !== 'json') {
    const event = payload.setupEvents.find((event: { kind: string }) => event.kind === field);
    if (field === 'announcement') event.hcp++;
    else if (field === 'redeal') event.to.origin.index++;
    else if (field === 'contract-choice') event.action.objective = 'part-score';
    else event.seat = 'invalid';
  }
  const encoded = field === 'json' ? 'not-json' : JSON.stringify(payload);
  expect(() => importPbn(pbn.replace(tag[0], `[BridgeVibeSetup ${JSON.stringify(encoded)}]`))).toThrow(/PBN parse error/);
});
test('US-04.3: PBN contract tags must agree with the supplemental setup', () => {
  const pbn = exportPbn(miniBridgeRecord());
  expect(() => importPbn(pbn.replace('[Contract "3NT"]', '[Contract "4NT"]'))).toThrow(/PBN parse error/);
});

test('§4.3.3, US-04.3: JSON preserves optional robot rule IDs and rejects invalid values', () => {
  const record = structuredClone(fixed);
  const robot = record.actions.find(action => action.provenance.kind === 'robot')!;
  const tagged = { ...record, actions: record.actions.map(action => action === robot
    ? { ...action, provenance: { ...action.provenance, ruleId: 'test-card-rule' } } : action) };
  expect(importRecordJson(JSON.stringify(tagged))).toEqual(tagged);
  for (const ruleId of ['', ' ', 42, null]) {
    const invalid = structuredClone(tagged);
    Object.assign(invalid.actions[robot.index].provenance, { ruleId });
    expect(() => importRecordJson(JSON.stringify(invalid))).toThrow(/Invalid record schema/);
  }
});
