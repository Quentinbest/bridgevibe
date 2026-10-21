import { afterEach, expect, test, vi } from 'vitest';
import { dealFromSeed, highCardPoints, SEATS, sideOf, startMiniBridge, type Seat, type Deal, importRecordJson, exportRecordJson } from '../table';
import { contractChoicePolicy } from '../robots';
import { createPlay } from './play';
import { fixedDeal } from './fixture';
import { handleRobotMessage } from './robotWorker';
import { ROBOT_PROTOCOL_VERSION, type RobotMessage } from './robotProtocol';
import type { RobotWorker } from './robotHost';
import { robotAudit } from './robotAudit';

function fixture(declarer: Seat): Deal {
  for (let i = 1; i < 1000; i++) {
    const deal = dealFromSeed('setup-ui', i), setup = startMiniBridge({ deal, learnerSide: 'northSouth' });
    for (let j = 0; j < 4; j++) setup.advance();
    if (setup.seatView('south').declarer === declarer) return deal;
  }
  throw new Error('Missing fixture');
}
class PolicyWorker implements RobotWorker {
  onmessage: RobotWorker['onmessage'] = null; onerror = null; onmessageerror = null;
  constructor(private messages: RobotMessage[]) { setTimeout(() => this.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent), 0); }
  postMessage(message: RobotMessage) { this.messages.push(message); handleRobotMessage(message, data => this.onmessage?.({ data } as MessageEvent)); }
  terminate() {}
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
test('US-06: default authored Deal is not 20–20 and South chooses; announcements stagger at 500 ms', () => {
  expect(highCardPoints(fixedDeal.hands.south) + highCardPoints(fixedDeal.hands.north)).toBe(32);
  vi.useFakeTimers(); const play = createPlay(); const stop = play.start();
  expect(play.getSnapshot().contract).toBeNull();
  for (let i = 0; i < 4; i++) {
    vi.advanceTimersByTime(499); expect(play.getSnapshot().setup?.announcements).toHaveLength(i);
    vi.advanceTimersByTime(1); expect(play.getSnapshot().setup?.announcements).toHaveLength(i + 1);
  }
  expect(play.getSnapshot().setup).toMatchObject({ declarer: 'south', step: 'declarer', dummy: null });
  vi.advanceTimersByTime(500); expect(play.getSnapshot().setup).toMatchObject({ step: 'dummy', dummy: fixedDeal.hands.north });
  expect(play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'game' })).toBe(false);
  vi.advanceTimersByTime(500); expect(play.chooseContract({ kind: 'choose-contract', strain: 'clubs', objective: 'part-score' })).toBe(true);
  expect(play.record().contract).toEqual({ level: 1, strain: 'clubs', declarer: 'south' });
  expect(play.getSnapshot().objective).toBe('part-score'); stop();
});
test('UX §4.2: reduced motion removes the stagger without changing announcement order', () => {
  vi.useFakeTimers(); vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const play = createPlay(); const stop = play.start(); vi.advanceTimersByTime(10);
  expect(play.getSnapshot().setup?.announcements.map(a => a.seat)).toEqual(['south', 'west', 'north', 'east']);
  expect(play.getSnapshot().setup?.step).toBe('contract-choice');
  const publish = vi.fn(); const unsubscribe = play.subscribe(publish);
  expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(30000);
  expect(publish).not.toHaveBeenCalled(); unsubscribe(); stop();
});
test('UX §4.2: 20–20 message lasts 1500 ms before the next seeded Deal', () => {
  vi.useFakeTimers();
  let deal = dealFromSeed('redeal-ui', 1);
  for (let i = 2; highCardPoints(deal.hands.north) + highCardPoints(deal.hands.south) !== 20; i++) deal = dealFromSeed('redeal-ui', i);
  const play = createPlay({}, deal); const stop = play.start(); vi.advanceTimersByTime(2000);
  expect(play.getSnapshot().setup?.step).toBe('redeal');
  vi.advanceTimersByTime(1499); expect(play.setupRecord().deal).toEqual(deal);
  vi.advanceTimersByTime(1); expect(play.setupRecord().deal.dealId).not.toBe(deal.dealId); stop();
});
test.each(['east', 'west'] as const)('US-06.6, CI-5: %s chooses in the worker with audited inputs and logged provenance', declarer => {
  vi.useFakeTimers(); const messages: RobotMessage[] = [], deal = fixture(declarer);
  const play = createPlay({ createWorker: () => new PolicyWorker(messages) }, deal); const stop = play.start();
  vi.advanceTimersByTime(3499); expect(play.getSnapshot().contract).toBeNull();
  const request = messages.find(message => message.type === 'choose-contract');
  expect(request?.type).toBe('choose-contract');
  if (!request || request.type !== 'choose-contract') throw new Error('Missing request');
  expect(request.view.hand).toEqual(deal.hands[declarer]);
  const dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
  expect(request.view.dummy).toEqual(deal.hands[dummy]);
  const audit = robotAudit(() => play.setupRecord());
  expect(() => audit(request, declarer)).not.toThrow();
  expect(() => audit({ request, leak: deal.hands.south[0] }, declarer)).toThrow('robot-audit-hidden-card');
  vi.advanceTimersByTime(1);
  const event = play.record().setupEvents?.at(-1);
  expect(event).toMatchObject({ kind: 'contract-choice', provenance: { kind: 'robot', policy: 'bv-contract-placeholder', version: '0' } });
  expect(play.provenanceLog.entries()[0]).toMatchObject({ kind: 'robot-action', provenance: { sourceKind: 'robot', policy: 'bv-contract-placeholder' } });
  expect(play.record().actions).toHaveLength(0);
  expect(importRecordJson(exportRecordJson(play.record()))).toEqual(play.record());
  expect(play.getSnapshot().dummySeat).toBe(dummy); stop();
});
test.each(['timeout', 'engine-failure'] as const)('US-12: robot Contract Choice has marked %s fallback', fallback => {
  vi.useFakeTimers(); const play = createPlay({ createWorker: () => {
    if (fallback === 'engine-failure') throw new Error('unavailable');
    return { onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate() {} };
  } }, fixture('east'));
  const stop = play.start(); vi.advanceTimersByTime(3500);
  expect(play.record().setupEvents?.at(-1)).toMatchObject({ provenance: { kind: 'robot', policy: 'bv-contract-placeholder', version: '0', fallback, durationMs: expect.any(Number) } });
  expect(play.provenanceLog.counters().silentFallbacks).toBe(0); stop();
});
test('ADR-0003: North chooses and the learner plays both North and South', () => {
  vi.useFakeTimers(); const play = createPlay({}, fixture('north')); const stop = play.start(); vi.advanceTimersByTime(3000);
  expect(play.getSnapshot().setup?.seat).toBe('north');
  expect(play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' })).toBe(true);
  const seats = new Set<Seat>();
  for (let n = 0; n < 100 && seats.size < 2; n++) {
    const view = play.getSnapshot();
    if (!view.collecting && view.turn && sideOf(view.turn) === 'northSouth') {
      seats.add(view.turn); play.play(view.turn as 'north' | 'south', view.legalCards[0]);
    } else vi.advanceTimersByTime(500);
  }
  expect(seats).toEqual(new Set(['north', 'south']));
  expect(play.record().actions.filter(a => sideOf(a.seat) === 'northSouth').every(a => a.controller === 'learner')).toBe(true); stop();
});
test('DEP-02: major fit and public combined HCP determine the placeholder choice', () => {
  const seen = new Set<string>();
  for (let i = 1; i <= 150; i++) {
    const setup = startMiniBridge({ deal: dealFromSeed('policy-cases', i), learnerSide: 'northSouth' });
    while (setup.seatView('south').step !== 'contract-choice') setup.advance();
    const view = setup.seatView(setup.seatView('south').declarer!);
    const cards = [...view.hand, ...view.dummy!];
    const spades = cards.filter(c => c.suit === 'spades').length, hearts = cards.filter(c => c.suit === 'hearts').length;
    const objective = highCardPoints(cards) >= 25 ? 'game' : 'part-score';
    const strain = Math.max(spades, hearts) < 8 ? 'no-trumps' : spades >= hearts ? 'spades' : 'hearts';
    expect(contractChoicePolicy.decide(view)).toEqual({ kind: 'choose-contract', strain, objective }); seen.add(strain); seen.add(objective);
  }
  expect(seen).toEqual(new Set(['spades', 'hearts', 'no-trumps', 'game', 'part-score']));
});

test('US-11.1: rejected robot choice falls back with provenance instead of starting an invalid contract', () => {
  vi.useFakeTimers();
  const play = createPlay({ createWorker: () => {
    const worker = new PolicyWorker([]);
    worker.postMessage = message => handleRobotMessage(message, data => {
      if (data.type === 'decided' && data.action.kind === 'choose-contract') Object.assign(data.action, { objective: 'slam' });
      worker.onmessage?.({ data } as MessageEvent);
    });
    return worker;
  } }, fixture('east'));
  const stop = play.start(); vi.advanceTimersByTime(3500);
  expect(play.record().setupEvents?.at(-1)).toMatchObject({ kind: 'contract-choice', provenance: { policy: 'bv-contract-placeholder', version: '0', fallback: 'engine-failure' } });
  expect(play.provenanceLog.counters().silentFallbacks).toBe(0);
  expect(play.getSnapshot().reason).toBe(''); stop();
});
