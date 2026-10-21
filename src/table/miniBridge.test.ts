import { expect, test } from 'vitest';
import { SEATS, SUITS, dealFromSeed, highCardPoints, startMiniBridge, sideOf, trickTarget, encodeSetupSeatView, decodeSetupSeatView,
  exportRecordJson, importRecordJson, exportPbn, importPbn, replay, startPlaythrough, type Deal } from './index';
import { reconstruct } from './replay';

function findDeal(predicate: (deal: Deal) => boolean) {
  for (let index = 1; index <= 2000; index++) { const deal = dealFromSeed('minibridge-f1', index); if (predicate(deal)) return deal; }
  throw new Error('Missing deterministic F1 case');
}
const nsPoints = (deal: Deal) => highCardPoints(deal.hands.north) + highCardPoints(deal.hands.south);
const ready = (deal: Deal) => {
  const setup = startMiniBridge({ deal, learnerSide: 'northSouth' });
  for (let n = 0; setup.seatView('south').step !== 'contract-choice' && n < 100; n++) setup.advance();
  expect(setup.seatView('south').step).toBe('contract-choice'); return setup;
};
test('F1 US-06.1: truthful announcements in dealer order; setup views expose no hidden cards', () => {
  const deal = findDeal(d => nsPoints(d) !== 20), setup = startMiniBridge({ deal, learnerSide: 'northSouth' });
  for (let i = 0; i < 4; i++) {
    setup.advance();
    const seat = SEATS[(SEATS.indexOf(deal.dealer) + i) % 4];
    expect(setup.seatView('south').announcements[i]).toEqual({ seat, hcp: highCardPoints(deal.hands[seat]) });
    for (const viewer of SEATS) {
      const view = encodeSetupSeatView(setup.seatView(viewer));
      expect(view.hand).toEqual(deal.hands[viewer]); expect(view.dummy).toBeNull();
      expect(view).not.toHaveProperty('contract'); expect(view).not.toHaveProperty('hands');
    }
  }
  expect(setup.playthrough()).toBeNull();
});
test('F1 US-06.2: 20–20 redeals to the next index of the same seed and records the event', () => {
  const deal = findDeal(d => nsPoints(d) === 20);
  const setup = startMiniBridge({ deal, learnerSide: 'northSouth' });
  for (let i = 0; i < 4; i++) setup.advance();
  expect(setup.seatView('south').step).toBe('redeal'); setup.advance();
  expect(deal.origin.kind).toBe('seed');
  if (deal.origin.kind !== 'seed') throw new Error('Expected seeded deal');
  const next = dealFromSeed(deal.origin.seed, deal.origin.index + 1);
  expect(setup.record().deal).toEqual(next);
  expect(setup.record().setupEvents.at(-1)).toEqual({ kind: 'redeal', from: deal, to: next });
  expect(setup.seatView('south').announcements).toEqual([]);
  const authored = startMiniBridge({ deal: { ...deal, origin: { kind: 'authored', contentId: 'test', version: 1 } }, learnerSide: 'northSouth' });
  for (let i = 0; i < 3; i++) authored.advance();
  expect(() => authored.advance()).toThrow(/cannot be redealt/);
});
test.each([false, true])('ADR-0001, US-06: all card-play views retain only final Announcements through completion (Redeal: %s)', redealt => {
  const initial = findDeal(deal => (nsPoints(deal) === 20) === redealt);
  const setup = ready(initial), final = setup.record().deal;
  const expected = SEATS.map((_, index) => {
    const seat = SEATS[(SEATS.indexOf(final.dealer) + index) % 4];
    return { seat, hcp: highCardPoints(final.hands[seat]) };
  });
  if (redealt) {
    expect(final.dealId).not.toBe(initial.dealId);
    expect(setup.record().setupEvents.filter(event => event.kind === 'announcement').length).toBeGreaterThan(4);
  }
  const declarer = setup.seatView('south').declarer!, controller = setup.controllerOf(declarer);
  expect(setup.submit(declarer, controller, { kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' },
    controller === 'robot' ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined).kind).toBe('accepted');
  const table = setup.playthrough()!;
  for (let position = 0; position <= 52; position++) {
    for (const viewer of SEATS) expect(table.seatView(viewer).announcements).toEqual(expected);
    if (position === 52) break;
    const seat = table.seatView('south').turn!, controller = table.controllerOf(seat);
    expect(table.submit(seat, controller, table.legalActions(seat)[0], controller === 'robot'
      ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined).kind).toBe('accepted');
  }
  expect(table.seatView('south').status).toBe('completed');
});
test('US-04.2: replay reconstruction keeps the recorded Announcements in every view', () => {
  const setup = ready(findDeal(deal => nsPoints(deal) !== 20));
  const declarer = setup.seatView('south').declarer!, controller = setup.controllerOf(declarer);
  expect(setup.submit(declarer, controller, { kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' },
    controller === 'robot' ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined).kind).toBe('accepted');
  const table = setup.playthrough()!;
  for (let position = 0; position < 52; position++) {
    const seat = table.seatView('south').turn!, controller = table.controllerOf(seat);
    expect(table.submit(seat, controller, table.legalActions(seat)[0], controller === 'robot'
      ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined).kind).toBe('accepted');
  }
  const rebuilt = reconstruct(table.record()).table;
  for (const seat of SEATS) expect(rebuilt.seatView(seat).announcements).toEqual(table.seatView(seat).announcements);
  expect(rebuilt.seatView('south').announcements).toHaveLength(4);
});
test('ADR-0001: Contract Bridge views have no Announcements without setup events', () => {
  const table = startPlaythrough({ deal: dealFromSeed('legacy', 1), learnerSide: 'northSouth',
    contract: { level: 3, strain: 'no-trumps', declarer: 'south' } });
  for (const seat of SEATS) expect(table.seatView(seat).announcements).toEqual([]);
});
test.each(SEATS)('F1 US-06.3: %s wins the declaring-side tie by announcing first', dealer => {
  const deal = findDeal(d => {
    const partner = SEATS[(SEATS.indexOf(dealer) + 2) % 4];
    return highCardPoints(d.hands[dealer]) > 10 && highCardPoints(d.hands[dealer]) === highCardPoints(d.hands[partner]);
  });
  const setup = ready({ ...deal, dealer });
  expect(setup.seatView('south')).toMatchObject({ declarer: dealer, tied: true });
});
test.each(SEATS)('F1 US-06.3–7: %s declares, every view exposes dummy before choice, left-hand opponent leads', declarer => {
  const deal = findDeal(d => highCardPoints(d.hands[declarer]) > highCardPoints(d.hands[SEATS[(SEATS.indexOf(declarer) + 2) % 4]])
    && (nsPoints(d) > 20 ? 'northSouth' : nsPoints(d) < 20 ? 'eastWest' : null) === sideOf(declarer));
  const setup = ready(deal), dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
  for (const seat of SEATS) expect(setup.seatView(seat).dummy).toEqual(deal.hands[dummy]);
  const before = setup.record();
  const choice = { kind: 'choose-contract', strain: 'hearts', objective: 'game' } as const;
  expect(setup.submit(dummy, setup.controllerOf(dummy), choice)).toMatchObject({ reason: 'not-declarer' });
  expect(setup.submit(declarer, setup.controllerOf(declarer) === 'robot' ? 'learner' : 'robot', choice)).toMatchObject({ reason: 'not-declarer' });
  expect(setup.submit(declarer, setup.controllerOf(declarer), { ...choice, objective: 'slam' })).toMatchObject({ reason: 'invalid-contract-choice' });
  expect(setup.submit(declarer, setup.controllerOf(declarer), { ...choice, strain: 'unknown' })).toMatchObject({ reason: 'invalid-contract-choice' });
  expect(setup.record()).toEqual(before);
  const provenance = setup.controllerOf(declarer) === 'robot' ? { kind: 'robot', policy: 'test', version: '0', durationMs: 1 } as const : undefined;
  expect(setup.submit(declarer, setup.controllerOf(declarer), choice, provenance).kind).toBe('accepted');
  const table = setup.playthrough()!;
  expect(table.record()).toMatchObject({ gameFormat: 'minibridge', contract: { level: 4, strain: 'hearts', declarer }, actions: [] });
  for (const seat of SEATS) expect(table.seatView(seat).dummy).toEqual(deal.hands[dummy]);
  expect(table.seatView(declarer).turn).toBe(SEATS[(SEATS.indexOf(declarer) + 1) % 4]);
  if (declarer === 'north') for (const seat of ['north', 'south'] as const) expect(table.controllerOf(seat)).toBe('learner');
  expect(importRecordJson(exportRecordJson(table.record()))).toEqual(table.record());
});
test('DEP-01: every strain/objective maps to the specified target; schema 2 remains readable', () => {
  for (const strain of [...SUITS, 'no-trumps' as const]) {
    expect(trickTarget(strain, 'part-score')).toBe(7);
    expect(trickTarget(strain, 'game')).toBe(strain === 'no-trumps' ? 9 : strain === 'spades' || strain === 'hearts' ? 10 : 11);
  }
  const record = startPlaythrough({ deal: dealFromSeed('legacy', 1), learnerSide: 'northSouth', contract: { level: 3, strain: 'no-trumps', declarer: 'south' } }).record();
  const { gameFormat: _, setupEvents: __, ...legacy } = record; void _; void __;
  expect(importRecordJson(JSON.stringify(legacy))).toEqual(legacy);
  expect(startPlaythrough({ deal: record.deal, learnerSide: 'northSouth', contract: record.contract }).seatView('south').dummy).toBeNull();
});
test('ADR-0001: setup decode rejects extra fields; returned views and events are independent copies', () => {
  const setup = ready(findDeal(d => nsPoints(d) !== 20));
  const encoded = encodeSetupSeatView(setup.seatView('south'));
  expect(() => decodeSetupSeatView({ ...encoded, leak: [] })).toThrow();
  // US-06.2: a partial list is valid during setup, a repeated Seat never is.
  expect(decodeSetupSeatView({ ...encoded, announcements: encoded.announcements.slice(0, 2) }).announcements).toHaveLength(2);
  expect(() => decodeSetupSeatView({ ...encoded, announcements: [encoded.announcements[0], encoded.announcements[0]] })).toThrow();
  const changed = JSON.parse(JSON.stringify(encoded)); changed.hand.length = 0; changed.announcements[0].hcp = 99;
  expect(setup.seatView('south').hand).toHaveLength(13);
  expect(setup.seatView('south').announcements[0].hcp).not.toBe(99);
});

test('CI-5: robot contract choice rejects missing or invalid provenance without mutation', () => {
  const setup = ready(findDeal(d => nsPoints(d) < 20));
  const seat = setup.seatView('south').declarer!, before = setup.record();
  const action = { kind: 'choose-contract', strain: 'no-trumps', objective: 'game' };
  for (const provenance of [undefined, { kind: 'learner' }, { kind: 'robot', policy: 'bad', version: '0', durationMs: -1 },
    { kind: 'robot', policy: 'bad', version: '0', durationMs: 1, secret: [] },
    ...['', ' ', 42, null].map(ruleId => ({ kind: 'robot', policy: 'test', version: '0', durationMs: 1, ruleId }))]) {
    expect(setup.submit(seat, 'robot', action, provenance as never)).toMatchObject({ reason: 'malformed-action' });
    expect(setup.record()).toEqual(before);
  }
});
test('US-04.3: redeals round-trip; tampered setup announcements, choices and exposures are rejected', () => {
  const setup = ready(findDeal(d => nsPoints(d) === 20));
  const seat = setup.seatView('south').declarer!, controller = setup.controllerOf(seat);
  setup.submit(seat, controller, { kind: 'choose-contract', strain: 'no-trumps', objective: 'game' }, controller === 'robot'
    ? { kind: 'robot', policy: 'test', version: '0', durationMs: 0 } : undefined);
  const record = setup.playthrough()!.record();
  expect(importRecordJson(exportRecordJson(record))).toEqual(record);
  for (const kind of ['announcement', 'dummy-exposed', 'contract-choice']) {
    const tampered = JSON.parse(exportRecordJson(record));
    tampered.setupEvents.find((event: { kind: string }) => event.kind === kind).seat = 'invalid';
    expect(() => importRecordJson(JSON.stringify(tampered))).toThrow(/JSON parse error/);
  }
});

test('US-04: MiniBridge card actions still replay and export through the existing PBN path', () => {
  const setup = ready(findDeal(d => nsPoints(d) > 20));
  const declarer = setup.seatView('south').declarer!;
  setup.submit(declarer, 'learner', { kind: 'choose-contract', strain: 'diamonds', objective: 'game' });
  const table = setup.playthrough()!;
  for (let i = 0; i < 52; i++) {
    const seat = table.seatView('south').turn!, controller = table.controllerOf(seat);
    expect(table.submit(seat, controller, table.legalActions(seat)[0], controller === 'robot'
      ? { kind: 'robot', policy: 'test', version: '0', durationMs: 0 } : undefined).kind).toBe('accepted');
  }
  const record = table.completedRecord();
  expect(replay(record)).toHaveLength(13);
  const imported = importPbn(exportPbn(record));
  expect(imported.contract).toEqual(record.contract); expect(imported.result).toEqual(record.result);
  expect(importRecordJson(exportRecordJson(record))).toEqual(JSON.parse(exportRecordJson(record)));
});

test('§4.3.3, CI-5: accepted robot Contract Choice retains its structured rule ID in JSON', () => {
  const setup = ready(findDeal(d => nsPoints(d) < 20)), seat = setup.seatView('south').declarer!;
  const provenance = { kind: 'robot', policy: 'bv-contract-placeholder', version: '0', ruleId: 'placeholder-dep-02', durationMs: 1 } as const;
  expect(setup.submit(seat, 'robot', { kind: 'choose-contract', strain: 'spades', objective: 'game' }, provenance).kind).toBe('accepted');
  const record = setup.playthrough()!.record();
  expect(record.setupEvents?.at(-1)).toMatchObject({ provenance });
  expect(importRecordJson(exportRecordJson(record))).toEqual(record);
});

// US-01.5: actions in the wrong phase say so, even from the declarer.
test('F1 US-01.5: wrong-phase before the contract choice and for card plays during setup', () => {
  const deal = findDeal(d => nsPoints(d) !== 20), setup = startMiniBridge({ deal, learnerSide: 'northSouth' });
  const choice = { kind: 'choose-contract', strain: 'no-trumps', objective: 'game' } as const;
  for (let n = 0; setup.seatView('south').step !== 'contract-choice' && n < 100; n++) {
    const { declarer } = setup.seatView('south');
    expect(setup.submit(declarer ?? 'south', declarer ? setup.controllerOf(declarer) : 'learner', choice)).toMatchObject({ reason: 'wrong-phase' });
    setup.advance();
  }
  const declarer = setup.seatView('south').declarer!;
  const card = setup.seatView(declarer).hand[0];
  expect(setup.submit(declarer, setup.controllerOf(declarer), { kind: 'play-card', card })).toMatchObject({ reason: 'wrong-phase' });
  expect(setup.seatView('south').step).toBe('contract-choice');
});
