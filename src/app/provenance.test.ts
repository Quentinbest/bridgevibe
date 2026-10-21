import { choosePractice } from '../../test/miniBridge';
import { version } from '../../package.json';
import { afterEach, expect, test, vi } from 'vitest';
import { validateEntry } from '../coach/provenance';
import { createPlay } from './play';
import type { RobotWorker } from './robotHost';
import { ROBOT_PROTOCOL_VERSION, type RobotMessage } from './robotProtocol';
import { handleRobotMessage } from './robotWorker';
import { robotAudit } from './robotAudit';
import { fixedDeal } from './fixture';

class PolicyWorker implements RobotWorker {
  onmessage: RobotWorker['onmessage'] = null;
  onerror = null;
  onmessageerror = null;
  constructor() { setTimeout(() => this.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent), 0); }
  postMessage(message: RobotMessage) { setTimeout(() => handleRobotMessage(message, data => this.onmessage?.({ data } as MessageEvent)), 1); }
  terminate() {}
}
afterEach(() => vi.useRealTimers());
test('US-40.1, F5: complete real-policy Playthrough and learner rejection have complete provenance', () => {
  vi.useFakeTimers();
  const play = createPlay({ createWorker: () => new PolicyWorker() });
  const stop = play.start(); choosePractice(play);
  try {
    play.play('south', play.getSnapshot().hand[0]);
    const reason = play.getSnapshot().reason;
    expect(reason).not.toBe('');
    for (let index = 0; index < 52; index++) {
      const view = play.getSnapshot();
      if (view.turn === 'north' || view.turn === 'south') play.play(view.turn, view.legalCards[0]);
      else vi.advanceTimersByTime(500);
      expect(play.getSnapshot().positionIndex).toBe(index + 1);
      if (play.getSnapshot().collecting) vi.advanceTimersByTime(1000);
    }
    expect(play.record().status).toBe('completed');
    const entries = play.provenanceLog.entries();
    expect(entries).toHaveLength(27);
    expect(entries[0]).toMatchObject({ kind: 'statement', text: reason, provenance: { sourceKind: 'template', templateId: 'reason.not-your-turn' } });
    const robots = play.record().actions.filter(action => action.controller === 'robot');
    const robotEntries = entries.filter(entry => entry.kind === 'robot-action');
    expect(robotEntries[0].positionIndex).toBe(0);
    expect(robotEntries.map(entry => entry.positionIndex)).toEqual(robots.map(action => action.index));
    expect(entries[0].positionIndex).toBe(0);
    expect(entries.filter(entry => entry.kind === 'robot-action').map(entry => entry.provenance))
      .toEqual(robots.map(action => ({ sourceKind: 'robot', ...action.provenance })));
    expect(entries.map(entry => entry.playthroughId)).toEqual(Array(27).fill(play.record().playthroughId));
    for (const entry of entries) expect(validateEntry(entry)).toEqual([]);
    expect(play.provenanceLog.counters()).toEqual({ hiddenCardsInVisibleInputs: 0, silentFallbacks: 0 });
    expect(play.provenanceLog.export().entries).toHaveLength(27);
    expect(play.provenanceLog.export().appVersion).toBe(version);
  } finally { stop(); }
});
test('US-40.2: hidden-card audit reports into the log before rejecting the payload', () => {
  const play = createPlay();
  const audit = robotAudit(() => play.setupRecord(), play.provenanceLog.hiddenCardFound);
  expect(() => audit({ leak: fixedDeal.hands.east[0] }, 'west')).toThrow('robot-audit-hidden-card');
  expect(play.provenanceLog.counters()).toEqual({ hiddenCardsInVisibleInputs: 1, silentFallbacks: 0 });
});

test('US-40.1: disclosed rule text is also a statement, with its own catalogue key', () => {
  vi.useFakeTimers();
  const play = createPlay(); const stop = play.start(); choosePractice(play);
  play.showRule(); expect(play.provenanceLog.entries()).toEqual([]);
  play.play('south', play.getSnapshot().hand[0]);
  play.showRule();
  expect(play.provenanceLog.entries()).toHaveLength(2);
  expect(play.provenanceLog.entries()[1]).toMatchObject({ kind: 'statement', informationMode: 'VISIBLE',
    provenance: { sourceKind: 'template', templateId: 'rule.not-your-turn' } });
  expect(validateEntry(play.provenanceLog.entries()[1])).toEqual([]); stop();
});

test('US-01.6, US-40.1: unexpected worker provenance cannot commit a card then break logging', () => {
  vi.useFakeTimers();
  const worker = new PolicyWorker();
  worker.postMessage = message => {
    setTimeout(() => handleRobotMessage(message, data => {
      if (data.type === 'decided') Object.assign(data.provenance, { sourceKind: 'template' });
      worker.onmessage?.({ data } as MessageEvent);
    }), 1);
  };
  const play = createPlay({ createWorker: () => worker });
  const stop = play.start(); choosePractice(play);
  worker.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent);
  try {
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
    expect(play.record().actions).toHaveLength(1);
    expect(play.record().actions[0].provenance).toMatchObject({ kind: 'robot', policy: 'bv-fallback', fallback: 'engine-failure' });
    const entries = play.provenanceLog.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ positionIndex: 0, provenance: { sourceKind: 'robot', policy: 'bv-fallback' } });
    expect(validateEntry(entries[0])).toEqual([]);
    expect(play.getSnapshot().positionIndex).toBe(1);
  } finally { stop(); }
});
