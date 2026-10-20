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
  const stop = play.start();
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
  const audit = robotAudit(fixedDeal, play.record, play.provenanceLog.hiddenCardFound);
  expect(() => audit({ leak: fixedDeal.hands.east[0] }, 'west')).toThrow('robot-audit-hidden-card');
  expect(play.provenanceLog.counters()).toEqual({ hiddenCardsInVisibleInputs: 1, silentFallbacks: 0 });
});

test('US-40.1: disclosed rule text is also a statement, with its own catalogue key', () => {
  const play = createPlay();
  play.showRule(); expect(play.provenanceLog.entries()).toEqual([]);
  play.play('south', play.getSnapshot().hand[0]);
  play.showRule();
  expect(play.provenanceLog.entries()).toHaveLength(2);
  expect(play.provenanceLog.entries()[1]).toMatchObject({ kind: 'statement', informationMode: 'VISIBLE',
    provenance: { sourceKind: 'template', templateId: 'rule.not-your-turn' } });
  expect(validateEntry(play.provenanceLog.entries()[1])).toEqual([]);
});
