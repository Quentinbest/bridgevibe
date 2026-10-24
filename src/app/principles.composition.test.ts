import { afterEach, expect, test, vi } from 'vitest';
import { dealFromSeed, SEATS } from '../table';
import { validateEntry } from '../coach/provenance';
import { createPlay } from './play';
import { robotAudit } from './robotAudit';
import { handleRobotMessage } from './robotWorker';
import { ROBOT_PROTOCOL_VERSION, type RobotMessage } from './robotProtocol';
import type { RobotWorker } from './robotHost';

afterEach(() => vi.useRealTimers());
test.each([false, true])('ADR-0001: Dummy uses Declarer view, audited and legal (fallback=%s)', fallback => {
  vi.useFakeTimers();
  let dummyRequests = 0;
  const worker: RobotWorker = {
    onmessage: null, onerror: null, onmessageerror: null, terminate() {},
    postMessage(message: RobotMessage) {
      if (message.type === 'decide') {
        const declarer = message.view.contract.declarer, dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
        if (message.view.turn === dummy) {
          dummyRequests++;
          expect(message.seat).toBe(declarer);
          expect(message.view.hand).toEqual(play.seatView(declarer).hand);
          expect(message.view.dummy).toEqual(play.seatView(dummy).hand);
          expect(message.view.hand).not.toEqual(message.view.dummy);
          if (fallback) return;
        }
      }
      handleRobotMessage(message, data => worker.onmessage?.({ data } as MessageEvent));
    },
  };
  const play = createPlay({ createWorker: () => {
    setTimeout(() => worker.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent), 0);
    return worker;
  }, audit(message, seat) { robotAudit(() => message.type === 'choose-contract' ? play.setupRecord() : play.record())(message, seat); } }, dealFromSeed('dummy-principles', 1), 'eastWest');
  const stop = play.start();
  try {
    vi.advanceTimersByTime(3500);
    for (let n = 0; n < 52; n++) {
      const snapshot = play.getSnapshot();
      if (snapshot.turn === 'south') play.play('south', snapshot.legalCards[0]);
      else vi.advanceTimersByTime(500);
      expect(play.getSnapshot().positionIndex).toBe(n + 1);
      if (play.getSnapshot().collecting) vi.advanceTimersByTime(1000);
    }
    expect(dummyRequests).toBe(13);
    expect(play.record().status).toBe('completed');
    for (const entry of play.provenanceLog.entries()) expect(validateEntry(entry)).toEqual([]);
    const entries = play.provenanceLog.entries().filter(e => e.kind === 'robot-action').slice(1);
    expect(entries.map(e => e.provenance)).toEqual(play.record().actions.filter(a => a.controller === 'robot').map(a => ({ sourceKind: 'robot', ...a.provenance })));
    expect(entries.every(e => 'ruleId' in e.provenance && !!e.provenance.ruleId)).toBe(true);
  } finally { stop(); }
});
