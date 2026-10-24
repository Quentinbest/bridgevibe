import { afterEach, expect, test, vi } from 'vitest';
import { fixedPlaythrough } from '../../test/strategy';
import { robotAudit } from '../../test/robotAudit';
import { dealFromSeed, startMiniBridge, encodeSetupSeatView, encodeSeatView, seatViewSeed } from '../table';
import { basicPolicy } from '../robots';
import { handleRobotMessage } from './robotWorker';
import type { ContractRequest, RobotRequest } from './robotProtocol';
afterEach(() => vi.unstubAllGlobals());
test('US-12.6: worker handler decides without WebAssembly and reports policy provenance', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebAssembly');
  Reflect.deleteProperty(globalThis, 'WebAssembly');
  try {
    expect('WebAssembly' in globalThis).toBe(false);
    const table = fixedPlaythrough();
    const request: RobotRequest = { type: 'decide', requestId: '1', cancellationId: '1', playthroughId: table.record().playthroughId,
      positionKey: table.positionKey(), deadline: 400, seat: 'west', seed: seatViewSeed(table.seatView('west')), view: encodeSeatView(table.seatView('west')) };
    robotAudit(table.record)(request, 'west');
    const post = vi.fn(); let time = 0;
    handleRobotMessage(request, post, undefined, () => time++);
    expect(post).toHaveBeenCalledWith({ type: 'decided', requestId: '1', playthroughId: table.record().playthroughId, positionKey: table.positionKey(),
      action: { kind: 'play-card', card: { suit: 'hearts', rank: 'J' } },
      provenance: { kind: 'robot', policy: 'bv-principles', version: '1', ruleId: 'lead-sequence', durationMs: 1 } });
    handleRobotMessage({ type: 'cancel', cancellationId: '1' }, post); expect(post).toHaveBeenCalledOnce();
    handleRobotMessage({ ...request, view: { ...request.view, extra: true } } as RobotRequest, post);
    expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'error', requestId: '1', playthroughId: table.record().playthroughId,
      positionKey: table.positionKey(), provenance: { kind: 'robot', policy: 'bv-principles', version: '1' } });
  } finally { if (descriptor) Object.defineProperty(globalThis, 'WebAssembly', descriptor); }
});

test('ADR-0001: policy receives exactly decoded view, visible seed, and deadline', () => {
  const table = fixedPlaythrough(); const view = table.seatView('west');
  const request: RobotRequest = { type: 'decide', requestId: 'request-only', cancellationId: 'cancel-only',
    playthroughId: 'playthrough-envelope-only', positionKey: 'position-envelope-only',
    seat: 'west', view: encodeSeatView(view), seed: seatViewSeed(view), deadline: 400 };
  robotAudit(table.record)(request, 'west');
  const decide = vi.fn(basicPolicy.decide);
  handleRobotMessage(request, vi.fn(), { ...basicPolicy, decide });
  expect(decide.mock.calls).toEqual([[view, request.seed, request.deadline]]);
  expect(decide.mock.calls[0][0]).not.toBe(request.view);
});
test('ADR-0001, FR-BOT1: MiniBridge card-play worker policy receives decoded public Announcements', () => {
  const setup = startMiniBridge({ deal: dealFromSeed('setup-ui', 3), learnerSide: 'northSouth' });
  while (setup.seatView('south').step !== 'contract-choice') setup.advance();
  const declarer = setup.seatView('south').declarer!, controller = setup.controllerOf(declarer);
  const announcements = setup.seatView(declarer).announcements;
  expect(setup.submit(declarer, controller, { kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' },
    controller === 'robot' ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined).kind).toBe('accepted');
  const table = setup.playthrough()!, seat = table.seatView('south').turn!, view = table.seatView(seat);
  const request: RobotRequest = { type: 'decide', requestId: 'announcements', cancellationId: 'announcements',
    playthroughId: table.record().playthroughId, positionKey: table.positionKey(), seat,
    view: encodeSeatView(view), seed: seatViewSeed(view), deadline: 400 };
  robotAudit(table.record)(request, seat);
  const decide = vi.fn(basicPolicy.decide), post = vi.fn();
  handleRobotMessage(request, post, { ...basicPolicy, decide });
  expect(decide).toHaveBeenCalledOnce();
  expect(decide.mock.calls[0][0]).toEqual(view);
  expect(decide.mock.calls[0][0].announcements).toEqual(announcements);
  expect(announcements).toHaveLength(4);
  expect(post.mock.calls[0][0]).toMatchObject({ type: 'decided' });
});

test('§4.3.3: contract worker success and failure carry the structured rule ID', () => {
  const setup = startMiniBridge({ deal: dealFromSeed('setup-ui', 3), learnerSide: 'northSouth' });
  while (setup.seatView('south').step !== 'contract-choice') setup.advance();
  const seat = setup.seatView('south').declarer!;
  const request: ContractRequest = { type: 'choose-contract', requestId: 'choice', cancellationId: 'choice',
    playthroughId: 'setup', positionKey: setup.positionKey(), deadline: 400, seat, seed: 'visible', view: encodeSetupSeatView(setup.seatView(seat)) };
  const post = vi.fn(); let time = 0;
  handleRobotMessage(request, post, undefined, () => time++);
  expect(post.mock.calls[0][0]).toMatchObject({ type: 'decided', provenance: { kind: 'robot',
    policy: 'bv-contract-placeholder', version: '0', ruleId: 'placeholder-dep-02', durationMs: 1 } });
  handleRobotMessage({ ...request, view: { ...request.view, seat: 'south' } }, post);
  expect(post.mock.calls[1][0]).toMatchObject({ type: 'error', provenance: { ruleId: 'placeholder-dep-02' } });
});
