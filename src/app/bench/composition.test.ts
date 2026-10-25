// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { decodeSeatView } from '../../table';
import { sampledEstimate } from '../../analysis/sampledEstimate';
import { bridgeDdsAdapter } from '../../analysis/bridgeDdsAdapter';
import { macroxueAdapter } from '../../analysis/macroxueAdapter';
import { dds31Adapter } from '../../analysis/dds31Adapter';
import { handleRobotMessage } from '../robotWorker';
import { ROBOT_PROTOCOL_VERSION, type RobotMessage, type RobotResponse } from '../robotProtocol';
import { samplePosition } from './run';
import { soakDeal } from './soak';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
test.each([bridgeDdsAdapter, macroxueAdapter, dds31Adapter])('fixed benchmark positions produce real layout estimates with $name', async solver => {
  for (let index = 0; index < 2; index++) {
    const position = samplePosition(index);
    const result = await sampledEstimate(solver, decodeSeatView(position.view), position.cards, 2, 'bench-samples', Infinity);
    expect(result).not.toHaveProperty('abstention');
    expect(result.sampleCount).toBeGreaterThan(0);
  }
});
test('F7 composition completes Setup and all 52 plays through the real host and worker handler', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  // US-43: only transport/time are simulated here; the browser test uses actual Web Workers.
  class Transport {
    onmessage: ((event: MessageEvent<RobotResponse>) => void) | null = null;
    onerror = null; onmessageerror = null;
    stopped = false;
    listeners: ((event: MessageEvent<RobotResponse>) => void)[] = [];
    constructor() { setTimeout(() => this.deliver({ type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION }), 0); }
    addEventListener(type: string, listener: (event: MessageEvent<RobotResponse>) => void) { if (type === 'message') this.listeners.push(listener); }
    deliver(data: RobotResponse) {
      if (this.stopped) return;
      const event = new MessageEvent('message', { data });
      this.listeners.forEach(listener => listener(event)); this.onmessage?.(event);
    }
    postMessage(message: RobotMessage) { setTimeout(() => handleRobotMessage(message, data => this.deliver(data)), 0); }
    terminate() { this.stopped = true; }
  }
  vi.stubGlobal('Worker', Transport);
  const observe = vi.fn(), crash = vi.fn();
  const completion = soakDeal(0, new AbortController().signal, observe, crash);
  await vi.runAllTimersAsync();
  const result = await completion;
  expect(observe).toHaveBeenCalledTimes(53);
  expect(result.events).toEqual([]);
  expect(crash).not.toHaveBeenCalled();
  expect(Object.values(result.layout).flat()).toHaveLength(52);
});
