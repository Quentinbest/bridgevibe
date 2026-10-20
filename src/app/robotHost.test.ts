import { afterEach, expect, test, vi } from 'vitest';
import { robotAudit, hiddenCard } from '../../test/robotAudit';
import { fixedPlaythrough } from '../../test/strategy';
import { basicPolicy } from '../robots';
import { seatViewSeed, type Action, type Hand, type Playthrough, type RobotProvenance } from '../table';
import { fixedDeal } from './fixture';
import { createRobotHost, type RobotHostOptions, type RobotWorker } from './robotHost';
import { handleRobotMessage } from './robotWorker';
import { ROBOT_PROTOCOL_VERSION, type RobotMessage, type RobotRequest, type RobotResponse } from './robotProtocol';
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
  emit(message: RobotResponse) { this.onmessage?.({ data: message } as MessageEvent<RobotResponse>); }
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
  const audit = vi.fn(robotAudit(fixedDeal, table.record));
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
});
test('US-10.4: forced final play uses the same display delay', () => {
  const table = fixedPlaythrough();
  while (table.record().actions.length < 48 || table.controllerOf(table.seatView('south').turn!) !== 'robot') {
    const seat = table.seatView('south').turn!;
    table.submit(seat, table.controllerOf(seat), table.legalActions(seat)[0]);
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
  vi.advanceTimersByTime(20); table.submit('west', 'robot', table.legalActions('west')[0]);
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
  const audit = vi.fn(robotAudit(fixedDeal, () => play.record()));
  const play = createPlay({ createWorker: () => new FakeWorker(1), audit });
  const stop = play.start();
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
  const table = fixedPlaythrough(); const inspect = robotAudit(fixedDeal, table.record);
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
  const audit = vi.fn(robotAudit(fixedDeal, () => play.record()));
  const play = createPlay({ createWorker: () => new FakeWorker(), audit });
  const stop = play.start(); vi.advanceTimersByTime(500);
  expect(play.record().actions[0].provenance).toMatchObject({ kind: 'robot', policy: 'bv-fallback', fallback: 'timeout', durationMs: 400 });
  expect(audit).toHaveBeenCalledOnce(); stop();
});

test('US-10.3, US-44: composition seed and view ignore cards hidden from West', () => {
  vi.useFakeTimers();
  // Before the opening lead, East's and North's (Dummy's) cards are both hidden from West.
  const changed = structuredClone(fixedDeal);
  const east: [...Hand] = [...changed.hands.east]; const north: [...Hand] = [...changed.hands.north];
  [east[0], north[0]] = [north[0], east[0]];
  const permuted = { ...changed, hands: { ...changed.hands, east, north } };
  const requests = [fixedDeal, permuted].map(deal => {
    const worker = new FakeWorker();
    const audit = vi.fn(robotAudit(deal, () => play.record()));
    const play = createPlay({ createWorker: () => worker, audit }, deal);
    const stop = play.start();
    try {
      vi.advanceTimersByTime(0);
      expect(worker.request.seat).toBe('west');
      expect(worker.request.view.positionIndex).toBe(0);
      expect(worker.request.view.dummy).toBeNull();
      expect(audit).toHaveBeenCalledOnce();
      return worker.request;
    } finally { stop(); }
  });
  expect(requests[1].view).toEqual(requests[0].view);
  expect(requests[1].seed).toBe(requests[0].seed);
  expect(requests[1].positionKey).not.toBe(requests[0].positionKey);
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
  const stop = play.start();
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
