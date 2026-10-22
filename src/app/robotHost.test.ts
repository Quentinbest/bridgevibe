import { choosePractice } from '../../test/miniBridge';
import { afterEach, expect, test, vi } from 'vitest';
import { robotAudit, hiddenCard } from '../../test/robotAudit';
import { fixedPlaythrough } from '../../test/strategy';
import { basicPolicy } from '../robots';
import { dealFromSeed, highCardPoints, seatViewSeed, validProvenance, type Action, type Hand, type Playthrough, type RobotProvenance } from '../table';
import { fixedDeal } from './fixture';
import { createRobotHost, type RobotHostOptions, type RobotWorker } from './robotHost';
import { handleRobotMessage } from './robotWorker';
import { ROBOT_PROTOCOL_VERSION, type RobotMessage, type RobotRequest } from './robotProtocol';
import { createPlay } from './play';

class FakeWorker implements RobotWorker {
  onmessage: RobotWorker['onmessage'] = null;
  onerror: RobotWorker['onerror'] = null;
  onmessageerror: RobotWorker['onmessageerror'] = null;
  messages: RobotMessage[] = [];
  terminated = false;
  constructor(readonly latency?: number, version = ROBOT_PROTOCOL_VERSION) {
    setTimeout(() => this.emit({ type: 'hello', protocolVersion: version }), 0);
  }
  postMessage(message: RobotMessage) {
    this.messages.push(message);
    if (this.latency !== undefined) setTimeout(() => handleRobotMessage(message, response => this.emit(response)), this.latency);
  }
  emit(message: unknown) { this.onmessage?.({ data: message } as MessageEvent<unknown>); }
  terminate() { this.terminated = true; }
  get request() { return this.messages.find((message): message is RobotRequest => message.type === 'decide')!; }
  answer(request = this.request) { handleRobotMessage(request, response => this.emit(response)); }
}
const hosts: ReturnType<typeof createRobotHost>[] = [];
afterEach(() => { hosts.forEach(host => host.stop()); hosts.length = 0; vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup(latency?: number, options: RobotHostOptions = {}, table: Playthrough = fixedPlaythrough()) {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  const submit = vi.fn<(action: Action, provenance: RobotProvenance) => boolean>(() => true);
  const audit = vi.fn(robotAudit(table.record));
  const host = createRobotHost({ createWorker: () => { const worker = new FakeWorker(latency); workers.push(worker); return worker; }, audit, ...options });
  hosts.push(host);
  const decide = () => {
    const seat = table.seatView('south').turn!;
    host.decide({ view: table.seatView(seat), seed: seatViewSeed(table.seatView(seat)), playthroughId: table.record().playthroughId,
      positionKey: table.positionKey(), currentPositionKey: table.positionKey, submit });
  };
  decide(); vi.advanceTimersByTime(0);
  return { host, workers, submit, audit, decide, table };
}
for (const latency of [1, 350]) test(`US-10.4: ${latency} ms policy displays at exactly 500 ms`, () => {
  const { submit, audit } = setup(latency);
  vi.advanceTimersByTime(499); expect(submit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(submit).toHaveBeenCalledOnce();
  expect(submit.mock.calls[0][1]).toMatchObject({ policy: 'bv-basic', version: '1', kind: 'robot' });
  expect(submit.mock.calls[0][1].fallback).toBeUndefined(); expect(audit).toHaveBeenCalled();
  expect(submit.mock.calls[0][1]).not.toHaveProperty('ruleId');
});

const malformedResponses: [string, (response: Record<string, unknown>) => unknown][] = [
  ['unknown-type', response => ({ ...response, type: 'surprise' })],
  ['missing-action', response => { delete response.action; return response; }],
  ['wrong-action-kind', response => ({ ...response, action: { kind: 'pass' } })],
  ['extra-envelope-key', response => ({ ...response, extra: true })],
  ['extra-action-key', response => ({ ...response, action: { ...(response.action as object), extra: true } })],
  ['missing-provenance', response => { delete response.provenance; return response; }],
  ['wrong-provenance-kind', response => ({ ...response, provenance: { ...(response.provenance as object), kind: 'learner' } })],
  ['invalid-duration', response => ({ ...response, provenance: { ...(response.provenance as object), durationMs: '1' } })],
  ['extra-provenance-key', response => ({ ...response, provenance: { ...(response.provenance as object), extra: true } })],
  ['null', () => null],
  ['array', response => Object.assign([], response)],
  ['non-plain-object', response => Object.assign(new Date(), response)],
];
for (const operation of ['decide', 'choose-contract'] as const) {
  const actionVariants: typeof malformedResponses = operation === 'decide' ? [
    ['invalid-suit', response => ({ ...response, action: { kind: 'play-card', card: { suit: 'stars', rank: 'A' } } })],
    ['invalid-rank', response => ({ ...response, action: { kind: 'play-card', card: { suit: 'spades', rank: '1' } } })],
    ['extra-card-key', response => ({ ...response, action: { kind: 'play-card', card: { suit: 'spades', rank: 'A', extra: true } } })],
    ['contract-action', response => ({ ...response, action: { kind: 'choose-contract', strain: 'no-trumps', objective: 'game' } })],
  ] : [
    ['invalid-strain', response => ({ ...response, action: { kind: 'choose-contract', strain: 'stars', objective: 'game' } })],
    ['invalid-objective', response => ({ ...response, action: { kind: 'choose-contract', strain: 'spades', objective: 'slam' } })],
    ['card-action', response => ({ ...response, action: { kind: 'play-card', card: { suit: 'spades', rank: 'A' } } })],
  ];
  test.each([...malformedResponses, ...actionVariants])(`US-12.5: ${operation} rejects %s, restarts and completes with valid record provenance`, (_name, corrupt) => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const audit = vi.fn();
    const play = createPlay({ audit, createWorker: () => {
      const worker = new FakeWorker(workers.length ? 1 : undefined); workers.push(worker); return worker;
    } }, operation === 'decide' ? fixedDeal : dealFromSeed('setup-ui', 3), 'eastWest');
    const stop = play.start();
    try {
      if (operation === 'decide') choosePractice(play);
      else vi.advanceTimersByTime(3000);
      vi.advanceTimersByTime(1);
      const request = workers[0].messages.find(message => message.type === operation)!;
      handleRobotMessage(request, response => workers[0].emit(corrupt(structuredClone(response) as Record<string, unknown>)));
      expect(workers[0].terminated).toBe(true);
      expect(workers).toHaveLength(2);
      vi.advanceTimersByTime(500);
      const entry = operation === 'decide' ? play.record().actions[0] : play.record().setupEvents?.at(-1);
      expect(entry).toMatchObject({ provenance: { kind: 'robot', fallback: 'engine-failure' } });
      for (let step = 0; step < 120 && play.record().status !== 'completed'; step++) {
        const view = play.getSnapshot();
        if (view.collecting) vi.advanceTimersByTime(1000);
        else if ((view.turn === 'north' || view.turn === 'south') && view.legalCards.length) play.play(view.turn, view.legalCards[0]);
        else vi.advanceTimersByTime(500);
      }
      expect(play.record().status).toBe('completed');
      for (const action of play.record().actions) {
        if (action.controller === 'robot') {
          expect(action.provenance.kind).toBe('robot');
          expect(validProvenance('robot', action.provenance)).toBe(true);
        }
      }
      for (const event of play.record().setupEvents ?? []) {
        if (event.kind === 'contract-choice' && event.controller === 'robot') {
          expect(event.provenance.kind).toBe('robot');
          expect(validProvenance('robot', event.provenance)).toBe(true);
        }
      }
      expect(audit).toHaveBeenCalled();
    } finally { stop(); }
  });
}

test('US-12.5: malformed responses count toward disabling the worker for the session', () => {
  const { workers, decide, submit } = setup(undefined, { failureThreshold: 2 });
  workers[0].emit(null); vi.advanceTimersByTime(500);
  decide(); workers[1].emit({ type: 'unknown' }); vi.advanceTimersByTime(500);
  decide(); vi.advanceTimersByTime(500);
  expect(workers).toHaveLength(2);
  expect(workers.every(worker => worker.terminated)).toBe(true);
  expect(submit).toHaveBeenCalledTimes(3);
  expect(submit.mock.calls.every(([, provenance]) => provenance.fallback === 'engine-failure')).toBe(true);
});
test('US-10.4: forced final play uses the same display delay', () => {
  const table = fixedPlaythrough();
  while (table.record().actions.length < 48 || table.controllerOf(table.seatView('south').turn!) !== 'robot') {
    const seat = table.seatView('south').turn!;
    table.submit(seat, table.controllerOf(seat), table.legalActions(seat)[0], table.controllerOf(seat) === 'robot' ? { kind: 'robot', policy: 'test-policy', version: '1', durationMs: 0 } : undefined);
  }
  expect(table.legalActions(table.seatView('south').turn!)).toHaveLength(1);
  const { submit } = setup(1, {}, table);
  vi.advanceTimersByTime(499); expect(submit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(submit).toHaveBeenCalledOnce();
});
test('US-12.2: deadline timeout is marked, cancelled, and late answers discarded', () => {
  const { submit, workers, audit } = setup();
  vi.advanceTimersByTime(400);
  // §4.3: a synchronous policy can't read a cancel message, so the in-flight worker is terminated.
  expect(workers[0].terminated).toBe(true);
  workers[0].answer(); vi.advanceTimersByTime(100);
  expect(submit).toHaveBeenCalledOnce();
  expect(submit.mock.calls[0][1]).toMatchObject({ policy: 'bv-fallback', fallback: 'timeout', durationMs: 400 });
  expect(audit).toHaveBeenCalledOnce();
  expect(submit.mock.calls[0][1]).not.toHaveProperty('ruleId');
});
for (const event of ['error', 'messageerror', 'response'] as const) test(`US-12.5: ${event} restarts and records engine-failure`, () => {
  const { workers, submit } = setup();
  const { requestId, playthroughId, positionKey } = workers[0].request;
  if (event === 'response') workers[0].emit({ type: 'error', requestId, playthroughId, positionKey, message: 'failed',
    provenance: { kind: 'robot', policy: 'bv-basic', version: '1', durationMs: 1 } });
  else if (event === 'error') workers[0].onerror?.({} as ErrorEvent);
  else workers[0].onmessageerror?.({} as MessageEvent);
  expect(workers).toHaveLength(2); expect(workers[0].terminated).toBe(true);
  vi.advanceTimersByTime(500);
  expect(submit.mock.calls[0][1]).toMatchObject({ fallback: 'engine-failure' });
});
test('US-12.5: threshold disables engine for later decisions, including stop/start', () => {
  const { workers, host, decide, submit } = setup(undefined, { failureThreshold: 2 });
  workers[0].onerror?.({} as ErrorEvent); vi.advanceTimersByTime(500);
  decide(); workers[1].onerror?.({} as ErrorEvent); vi.advanceTimersByTime(500);
  host.stop(); decide(); vi.advanceTimersByTime(500);
  expect(workers).toHaveLength(2); expect(submit).toHaveBeenCalledTimes(3);
  expect(submit.mock.calls.every(call => call[1].fallback === 'engine-failure')).toBe(true);
});
test('US-41.3: mismatched worker is reloaded before any request; repeated mismatch disables it', () => {
  const workers: FakeWorker[] = [];
  const { submit } = setup(undefined, { failureThreshold: 2, createWorker: () => {
    const worker = new FakeWorker(undefined, -1); workers.push(worker); return worker;
  } });
  vi.advanceTimersByTime(500);
  expect(workers).toHaveLength(2);
  expect(workers.every(worker => worker.terminated && !worker.messages.length)).toBe(true);
  expect(submit.mock.calls[0][1].fallback).toBe('engine-failure');
});
test('US-41.3: a matching replacement completes normally', () => {
  const workers: FakeWorker[] = [];
  const { submit } = setup(undefined, { createWorker: () => {
    const worker = new FakeWorker(1, workers.length ? ROBOT_PROTOCOL_VERSION : -1); workers.push(worker); return worker;
  } });
  vi.advanceTimersByTime(500);
  expect(workers[0].messages).toEqual([]); expect(workers[1].request).toBeTruthy();
  expect(submit.mock.calls[0][1].fallback).toBeUndefined();
});
test('§4.3.6: stale position and request IDs are discarded', () => {
  const { workers, submit } = setup(); const worker = workers[0];
  worker.answer({ ...worker.request, positionKey: 'stale' });
  worker.answer({ ...worker.request, requestId: 'old' });
  vi.advanceTimersByTime(500);
  expect(submit.mock.calls[0][1].fallback).toBe('timeout');
});
test('§4.3.6: an actual Table position change discards an already decided action', () => {
  const { table, submit } = setup(1);
  vi.advanceTimersByTime(20); table.submit('west', 'robot', table.legalActions('west')[0], { kind: 'robot', policy: 'test-policy', version: '1', durationMs: 0 });
  vi.advanceTimersByTime(500); expect(submit).not.toHaveBeenCalled();
});
test('US-12.4: visibility events cancel, pause, and re-request with a fresh deadline', () => {
  const target = new EventTarget(); let hidden = false;
  vi.stubGlobal('document', { get visibilityState() { return hidden ? 'hidden' : 'visible'; },
    addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target) });
  const { workers, submit } = setup();
  const first = workers[0].request;
  vi.advanceTimersByTime(300); hidden = true; target.dispatchEvent(new Event('visibilitychange'));
  workers[0].answer(first); vi.advanceTimersByTime(5000); expect(submit).not.toHaveBeenCalled();
  expect(workers[0].terminated).toBe(true);
  hidden = false; target.dispatchEvent(new Event('visibilitychange'));
  const resumed = Date.now(); vi.advanceTimersByTime(0);
  const next = workers[1].request;
  expect(next.positionKey).toBe(first.positionKey); expect(next.requestId).not.toBe(first.requestId);
  expect(next.deadline).toBe(resumed + 400); workers[1].answer(next);
  vi.advanceTimersByTime(499); expect(submit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(submit.mock.calls[0][1].fallback).toBeUndefined();
});
test('US-12.4: a decision started hidden never times out', () => {
  let hidden = true; let change = () => {};
  const { workers, submit } = setup(1, { visibility: { hidden: () => hidden, subscribe: callback => { change = callback; return () => {}; } } });
  vi.advanceTimersByTime(10000); expect(workers).toHaveLength(0); expect(submit).not.toHaveBeenCalled();
  hidden = false; change(); vi.advanceTimersByTime(500);
  expect(submit.mock.calls[0][1].fallback).toBeUndefined();
});
test('US-10.2: audit rejects a hidden card nested in a fake payload', () => {
  const { audit, workers } = setup();
  expect(() => audit({ ...workers[0].request, leak: { card: hiddenCard(fixedDeal, 'west') } }, 'west')).toThrow('robot-audit-hidden-card');
});
test('US-10.4: invalid timing or threshold is rejected', () => {
  for (const options of [{ policyDeadlineMs: 500 }, { displayDelayMs: 300 }, { failureThreshold: 0 }]) {
    expect(() => createRobotHost(options)).toThrow();
  }
});
test('composition: complete fixed Deal through the real policy, auditing every worker message', () => {
  vi.useFakeTimers();
  const audit = vi.fn(robotAudit(() => play.record()));
  const play = createPlay({ createWorker: () => new FakeWorker(1), audit });
  const stop = play.start(); choosePractice(play);
  for (let index = 0; index < 52; index++) {
    const view = play.getSnapshot();
    if (view.turn === 'north' || view.turn === 'south') play.play(view.turn, view.legalCards[0]);
    else vi.advanceTimersByTime(500);
    expect(play.getSnapshot().positionIndex).toBe(index + 1);
    if (play.getSnapshot().collecting) vi.advanceTimersByTime(1000);
  }
  expect(play.record().status).toBe('completed');
  expect(play.record().result).toEqual({ northSouth: 6, eastWest: 7 });
  const robots = play.record().actions.filter(entry => entry.controller === 'robot');
  expect(robots).toHaveLength(26); expect(audit).toHaveBeenCalledTimes(26);
  for (const entry of robots) expect(entry.provenance).toMatchObject({ kind: 'robot', policy: basicPolicy.name, version: '1' } satisfies Partial<RobotProvenance>);
  stop();
});
test('US-12.5: construction and posting failures are marked and bounded', () => {
  const createWorker = vi.fn(() => { throw new Error('unavailable'); });
  const { submit } = setup(undefined, { createWorker });
  vi.advanceTimersByTime(500);
  expect(createWorker).toHaveBeenCalledTimes(3);
  expect(submit.mock.calls[0][1].fallback).toBe('engine-failure');
  const workers: FakeWorker[] = [];
  const next = setup(undefined, { createWorker: () => {
    const worker = new FakeWorker(); worker.postMessage = () => { throw new Error('unavailable'); };
    workers.push(worker); return worker;
  } });
  vi.advanceTimersByTime(500);
  expect(workers[0].terminated).toBe(true);
  expect(next.submit.mock.calls[0][1].fallback).toBe('engine-failure');
});
test('US-10.2: a throwing audit fails directly instead of producing a fallback', () => {
  const table = fixedPlaythrough(); const inspect = robotAudit(table.record);
  expect(() => setup(undefined, { audit: (message, seat) => inspect(message.type === 'decide' ? { message, leak: hiddenCard(fixedDeal, seat) } : message, seat) }))
    .toThrow('robot-audit-hidden-card');
});
test('US-10.4, US-12.4: completed decisions wait a full display window after the page returns', () => {
  let hidden = false; let change = () => {};
  const { workers, submit } = setup(1, { visibility: { hidden: () => hidden, subscribe: callback => { change = callback; return () => {}; } } });
  vi.advanceTimersByTime(300); hidden = true; change();
  vi.advanceTimersByTime(5000); expect(submit).not.toHaveBeenCalled();
  hidden = false; change(); vi.advanceTimersByTime(499); expect(submit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(submit).toHaveBeenCalledOnce();
  expect(workers[0].messages).toHaveLength(1);
  expect(submit.mock.calls[0][1].fallback).toBeUndefined();
});
test('composition: timeout provenance survives Table submission into the record', () => {
  vi.useFakeTimers();
  const audit = vi.fn(robotAudit(() => play.record()));
  const play = createPlay({ createWorker: () => new FakeWorker(), audit });
  const stop = play.start(); choosePractice(play); vi.advanceTimersByTime(500);
  expect(play.record().actions[0].provenance).toMatchObject({ kind: 'robot', policy: 'bv-fallback', fallback: 'timeout', durationMs: 400 });
  expect(audit).toHaveBeenCalledOnce(); stop();
});

test('US-10.3, US-44: composition worker key, seed and view ignore cards hidden from West', () => {
  vi.useFakeTimers();
  // MiniBridge exposes North before the lead; South and East remain hidden from West.
  const changed = structuredClone(fixedDeal);
  const east: [...Hand] = [...changed.hands.east]; const south: [...Hand] = [...changed.hands.south];
  // CI-9, US-10.3: swapping spot cards preserves every public HCP Announcement.
  [east[0], south[1]] = [south[1], east[0]];
  expect(highCardPoints(east)).toBe(highCardPoints(fixedDeal.hands.east));
  expect(highCardPoints(south)).toBe(highCardPoints(fixedDeal.hands.south));
  const permuted = { ...changed, hands: { ...changed.hands, east, south } };
  const requests = [fixedDeal, permuted].map(deal => {
    const worker = new FakeWorker();
    const audit = vi.fn(robotAudit(() => play.record()));
    const play = createPlay({ createWorker: () => worker, audit }, deal);
    const stop = play.start(); choosePractice(play);
    worker.emit({ type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION });
    try {
      vi.advanceTimersByTime(0);
      expect(worker.request.seat).toBe('west');
      expect(worker.request.view.positionIndex).toBe(0);
      expect(worker.request.view.dummy).toEqual(fixedDeal.hands.north);
      expect(worker.request.view.announcements).toHaveLength(4);
      expect(audit).toHaveBeenCalledOnce();
      return worker.request;
    } finally { stop(); }
  });
  expect(requests[1].view).toEqual(requests[0].view);
  expect(requests[1].seed).toBe(requests[0].seed);
  expect(requests[1].positionKey).toBe(requests[0].positionKey);
});
test('§4.3.6: a response for another playthrough is ignored, not accepted or failed', () => {
  const { workers, submit } = setup();
  const request = workers[0].request;
  handleRobotMessage({ ...request, playthroughId: 'playthrough-other' }, response => workers[0].emit(response));
  vi.advanceTimersByTime(500);
  expect(workers).toHaveLength(1);
  expect(submit.mock.calls[0][1]).toMatchObject({ fallback: 'timeout' });
});
test('US-11.1: a robot action the Table rejects becomes a marked engine-failure fallback, not a loop', () => {
  const { workers, submit, table } = setup();
  submit.mockImplementationOnce(() => false);
  const { requestId, playthroughId, positionKey } = workers[0].request;
  const wrong = table.seatView('south').hand[0];
  workers[0].emit({ type: 'decided', requestId, playthroughId, positionKey, action: { kind: 'play-card', card: wrong },
    provenance: { kind: 'robot', policy: 'bv-basic', version: '1', durationMs: 1 } });
  vi.advanceTimersByTime(500);
  expect(submit).toHaveBeenCalledTimes(2);
  expect(submit.mock.calls[1][1]).toMatchObject({ policy: 'bv-fallback', fallback: 'engine-failure' });
  expect(workers[0].terminated).toBe(true);
});
test('US-11.1: in the composition a rejected robot card shows no learner message and play continues', () => {
  vi.useFakeTimers();
  const worker = new FakeWorker();
  const play = createPlay({ createWorker: () => worker });
  const stop = play.start(); choosePractice(play);
  worker.emit({ type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION });
  try {
    vi.advanceTimersByTime(0);
    const { requestId, playthroughId, positionKey } = worker.request;
    worker.emit({ type: 'decided', requestId, playthroughId, positionKey,
      action: { kind: 'play-card', card: fixedDeal.hands.south[0] }, provenance: { kind: 'robot', policy: 'bv-basic', version: '1', durationMs: 1 } });
    vi.advanceTimersByTime(500);
    expect(play.getSnapshot().reason).toBe('');
    expect(play.record().actions[0]).toMatchObject({ seat: 'west', provenance: { fallback: 'engine-failure' } });
  } finally { stop(); }
});
test('US-12.2: an error arriving after the deadline is a timeout, not an engine failure', () => {
  const { workers, submit } = setup();
  const { requestId, playthroughId, positionKey } = workers[0].request;
  vi.setSystemTime(Date.now() + 400);
  workers[0].emit({ type: 'error', requestId, playthroughId, positionKey, message: 'late',
    provenance: { kind: 'robot', policy: 'bv-basic', version: '1', durationMs: 400 } });
  vi.advanceTimersByTime(500);
  expect(submit.mock.calls[0][1]).toMatchObject({ fallback: 'timeout' });
});
test('US-41.3, US-12.5: a worker that never sends hello is replaced and eventually disabled', () => {
  vi.useFakeTimers();
  const created: RobotWorker[] = [];
  const table = fixedPlaythrough();
  const submit = vi.fn<(action: Action, provenance: RobotProvenance) => boolean>(() => true);
  const host = createRobotHost({ createWorker: () => {
    const worker: RobotWorker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() };
    created.push(worker); return worker;
  } });
  hosts.push(host);
  for (let decision = 0; decision < 5; decision++) {
    host.decide({ view: table.seatView('west'), seed: seatViewSeed(table.seatView('west')), playthroughId: table.record().playthroughId,
      positionKey: table.positionKey(), currentPositionKey: table.positionKey, submit });
    vi.advanceTimersByTime(500);
  }
  expect(created).toHaveLength(3);
  for (const worker of created) expect(worker.terminate).toHaveBeenCalled();
  expect(submit.mock.calls.map(call => call[1].fallback)).toEqual(['timeout', 'timeout', 'timeout', 'engine-failure', 'engine-failure']);
});

// CI-5, US-12: the host names the policy that actually produced a fallback choice.
test.each(['timeout', 'engine-failure'] as const)('contract-choice host fallback records %s and its producing policy', fallback => {
  vi.useFakeTimers(); const workers: FakeWorker[] = [];
  const play = createPlay({ createWorker: () => { const worker = new FakeWorker(); workers.push(worker); return worker; } }, dealFromSeed('setup-ui', 3), 'eastWest');
  const stop = play.start();
  try {
    vi.advanceTimersByTime(3001);
    expect(workers[0].messages.some(message => message.type === 'choose-contract')).toBe(true);
    if (fallback === 'engine-failure') workers[0].onerror?.({} as ErrorEvent);
    vi.advanceTimersByTime(499);
    expect(play.record().setupEvents?.at(-1)).toMatchObject({ kind: 'contract-choice', provenance: {
      kind: 'robot', policy: 'bv-contract-placeholder', version: '0', ruleId: 'placeholder-dep-02', fallback,
      durationMs: fallback === 'timeout' ? 400 : 1,
    } });
    expect(play.provenanceLog.entries().at(-1)?.provenance).toMatchObject({ policy: 'bv-contract-placeholder', ruleId: 'placeholder-dep-02', fallback });
    expect(play.provenanceLog.counters().silentFallbacks).toBe(0);
  } finally { stop(); }
});
