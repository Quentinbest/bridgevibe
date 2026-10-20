import { afterEach, expect, test, vi } from 'vitest';
import { fixedPlaythrough } from '../../test/strategy';
import { robotAudit } from '../../test/robotAudit';
import { encodeSeatView, seatViewSeed } from '../table';
import { basicPolicy } from '../robots';
import { fixedDeal } from './fixture';
import { handleRobotMessage } from './robotWorker';
import type { RobotRequest } from './robotProtocol';
afterEach(() => vi.unstubAllGlobals());
test('US-12.6: worker handler decides without WebAssembly and reports policy provenance', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebAssembly');
  Reflect.deleteProperty(globalThis, 'WebAssembly');
  try {
    expect('WebAssembly' in globalThis).toBe(false);
    const table = fixedPlaythrough();
    const request: RobotRequest = { type: 'decide', requestId: '1', cancellationId: '1', playthroughId: table.record().playthroughId,
      positionKey: table.positionKey(), deadline: 400, seat: 'west', seed: seatViewSeed(table.seatView('west')), view: encodeSeatView(table.seatView('west')) };
    robotAudit(fixedDeal, table.record)(request, 'west');
    const post = vi.fn(); let time = 0;
    handleRobotMessage(request, post, undefined, () => time++);
    expect(post).toHaveBeenCalledWith({ type: 'decided', requestId: '1', playthroughId: table.record().playthroughId, positionKey: table.positionKey(),
      action: { kind: 'play-card', card: { suit: 'spades', rank: '9' } },
      provenance: { kind: 'robot', policy: 'bv-basic', version: '1', durationMs: 1 } });
    handleRobotMessage({ type: 'cancel', cancellationId: '1' }, post); expect(post).toHaveBeenCalledOnce();
    handleRobotMessage({ ...request, view: { ...request.view, extra: true } } as RobotRequest, post);
    expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'error', requestId: '1', playthroughId: table.record().playthroughId,
      positionKey: table.positionKey(), provenance: { kind: 'robot', policy: 'bv-basic', version: '1' } });
  } finally { if (descriptor) Object.defineProperty(globalThis, 'WebAssembly', descriptor); }
});

test('ADR-0001: policy receives exactly decoded view, visible seed, and deadline', () => {
  const table = fixedPlaythrough(); const view = table.seatView('west');
  const request: RobotRequest = { type: 'decide', requestId: 'request-only', cancellationId: 'cancel-only',
    playthroughId: 'playthrough-envelope-only', positionKey: 'position-envelope-only',
    seat: 'west', view: encodeSeatView(view), seed: seatViewSeed(view), deadline: 400 };
  robotAudit(fixedDeal, table.record)(request, 'west');
  const decide = vi.fn(basicPolicy.decide);
  handleRobotMessage(request, vi.fn(), { ...basicPolicy, decide });
  expect(decide.mock.calls).toEqual([[view, request.seed, request.deadline]]);
  expect(decide.mock.calls[0][0]).not.toBe(request.view);
});
