import { afterEach, expect, test, vi } from 'vitest';
import type { RobotMessage, RobotResponse } from './robotProtocol';
import type { RobotWorker } from './robotHost';

const inspected = vi.hoisted(() => [] as unknown[]);
vi.mock('./robotAudit', async original => {
  const actual = await original<typeof import('./robotAudit')>();
  return { ...actual, robotAudit: (...args: Parameters<typeof actual.robotAudit>) => {
    const audit = actual.robotAudit(...args);
    return (message: unknown, seat: Parameters<typeof audit>[1]) => { inspected.push(message); audit(message, seat); };
  } };
});
const { createPlay } = await import('./play');

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); inspected.length = 0; });

// US-10.2, §4.3.6, US-40.2: test builds, and every build that shows the debug panel's hidden-card
// counter, audit robot messages even when no audit hook is passed.
for (const mode of ['test', 'development', 'internal']) test(`${mode} mode installs the robot audit automatically`, async () => {
  vi.useFakeTimers(); vi.stubEnv('MODE', mode);
  const posted: RobotMessage[] = [];
  const worker: RobotWorker = { onmessage: null, onerror: null, onmessageerror: null, terminate() {},
    postMessage(message) { posted.push(message); } };
  const play = createPlay({ createWorker: () => {
    queueMicrotask(() => worker.onmessage?.({ data: { type: 'hello', protocolVersion: 1 } } as MessageEvent<RobotResponse>));
    return worker;
  } });
  const stop = play.start();
  await Promise.resolve();
  expect(posted.some(message => message.type === 'decide')).toBe(true);
  expect(inspected).toEqual(posted);
  stop();
});
