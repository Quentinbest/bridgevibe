// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { fixedPlaythrough } from '../../test/strategy';
import { hiddenCard } from '../../test/robotAudit';
import { encodeSeatView } from '../table';
import { browserRobotAudit, robotAudit } from './robotAudit';
import { fixedDeal } from './fixture';
import { createPlay } from './play';
import { createRobotHost, type RobotWorker } from './robotHost';
import { ROBOT_PROTOCOL_VERSION } from './robotProtocol';
afterEach(() => {
  delete window.__robotAuditCount; delete window.__robotAuditViolations;
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers();
});
test('US-10.2: browser audit counts payloads, records violations and throws', () => {
  const table = fixedPlaythrough(); const audit = browserRobotAudit(fixedDeal, table.record);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  audit({ view: encodeSeatView(table.seatView('west')) }, 'west');
  expect(window.__robotAuditCount).toBe(1); expect(window.__robotAuditViolations).toEqual([]);
  expect(() => audit({ nested: { card: hiddenCard(fixedDeal, 'west') } }, 'west')).toThrow('robot-audit-hidden-card');
  expect(window.__robotAuditCount).toBe(2);
  expect(window.__robotAuditViolations).toEqual(['robot-audit-hidden-card']);
  expect(error).toHaveBeenCalledWith('robot-audit-hidden-card');
});
test('US-10.2: plain Node audit remains a throwing hook without browser telemetry', () => {
  const table = fixedPlaythrough(); const audit = robotAudit(fixedDeal, table.record);
  expect(() => audit(hiddenCard(fixedDeal, 'west'), 'west')).toThrow('robot-audit-hidden-card');
  expect(window.__robotAuditCount).toBeUndefined(); expect(window.__robotAuditViolations).toBeUndefined();
});
for (const mode of ['audit', 'production']) test(`composition installs real-host audit only in ${mode} mode`, () => {
  vi.useFakeTimers(); vi.stubEnv('MODE', mode);
  const worker: RobotWorker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() };
  const play = createPlay({ createWorker: () => worker }); const stop = play.start();
  try {
    worker.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent);
    expect(worker.postMessage).toHaveBeenCalledOnce();
    if (mode === 'audit') {
      expect(window.__robotAuditCount).toBe(1); expect(window.__robotAuditViolations).toEqual([]);
      vi.advanceTimersByTime(400);
      expect(window.__robotAuditCount).toBe(2);
    } else {
      expect(window.__robotAuditCount).toBeUndefined(); expect(window.__robotAuditViolations).toBeUndefined();
    }
  } finally { stop(); }
});

test('US-10.2: an audit violation stops the decision without a timeout fallback', () => {
  vi.useFakeTimers();
  const table = fixedPlaythrough(); const inspect = browserRobotAudit(fixedDeal, table.record);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const worker: RobotWorker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() };
  const submit = vi.fn();
  const host = createRobotHost({ createWorker: () => worker,
    audit: (message, seat) => inspect({ message, leak: hiddenCard(fixedDeal, seat) }, seat) });
  host.decide({ view: table.seatView('west'), seed: 'visible-seed', playthroughId: table.record().playthroughId,
    positionKey: table.positionKey(), currentPositionKey: table.positionKey, submit });
  try {
    expect(() => worker.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent))
      .toThrow('robot-audit-hidden-card');
    vi.advanceTimersByTime(1000);
    expect(submit).not.toHaveBeenCalled(); expect(worker.postMessage).not.toHaveBeenCalled();
    expect(window.__robotAuditViolations).toEqual(['robot-audit-hidden-card']);
  } finally { host.stop(); }
});
