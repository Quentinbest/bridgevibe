import { afterEach, expect, test, vi } from 'vitest';
import { dealFromSeed, startMiniBridge, SEATS, type Seat } from '../table';
import { createPlay } from './play';
import { tablePositions } from './rotation';
import { ROBOT_PROTOCOL_VERSION, type RobotMessage, type RobotRequest } from './robotProtocol';
import { handleRobotMessage } from './robotWorker';
import type { RobotWorker } from './robotHost';

function northDeal() {
  for (let index = 1; index < 100; index++) {
    const deal = dealFromSeed('table-turns', index);
    const setup = startMiniBridge({ deal, learnerSide: 'northSouth' });
    for (let i = 0; i < 4; i++) setup.advance();
    if (setup.seatView('south').declarer === 'north') return deal;
  }
  throw new Error('Missing North fixture');
}
class PolicyWorker implements RobotWorker {
  onmessage: RobotWorker['onmessage'] = null;
  onerror = null;
  onmessageerror = null;
  constructor(private requests: RobotRequest[]) {
    setTimeout(() => this.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent), 0);
  }
  postMessage(message: RobotMessage) {
    if (message.type === 'decide') this.requests.push(message);
    handleRobotMessage(message, data => this.onmessage?.({ data } as MessageEvent));
  }
  terminate() {}
}
afterEach(() => vi.useRealTimers());

// US-02.4: exercise the real composition, policies and all 52 true-seat actions in both layouts.
test('rotation preserves the complete record, every Seat View and every robot request', () => {
  vi.useFakeTimers();
  const deal = northDeal();
  function complete(rotated: boolean) {
    vi.setSystemTime(0);
    const requests: RobotRequest[] = [];
    const play = createPlay({ createWorker: () => new PolicyWorker(requests) }, deal);
    const stop = play.start();
    vi.advanceTimersByTime(3000);
    expect(play.getSnapshot().contract).toBeNull();
    play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' });
    expect(play.getSnapshot().turn).toBe('east');
    const views = [];
    while (play.getSnapshot().status !== 'completed') {
      const view = play.getSnapshot();
      const positions = tablePositions(rotated ? view.contract!.declarer : null);
      views.push(SEATS.map(seat => play.seatView(seat)));
      if (view.collecting) vi.advanceTimersByTime(1000);
      else if (view.turn === 'north' || view.turn === 'south') {
        // The display locates the active hand; the action still submits its true seat.
        const position = positions[view.turn];
        const seat = SEATS.find(seat => positions[seat] === position) as Extract<Seat, 'north' | 'south'>;
        play.play(seat, view.legalCards[0]);
      } else vi.advanceTimersByTime(500);
    }
    const { playthroughId, ...record } = play.record();
    expect(playthroughId).toBeTruthy();
    expect(record.actions).toHaveLength(52);
    expect(requests).toHaveLength(26);
    expect(record.actions[0].seat).toBe('east');
    expect(record.actions.filter(action => action.seat === 'north' || action.seat === 'south').every(action => action.controller === 'learner')).toBe(true);
    stop();
    return { record, views, requests: requests.map(request => ({ seat: request.seat, view: request.view, seed: request.seed })) };
  }
  expect(complete(true)).toEqual(complete(false));
});
