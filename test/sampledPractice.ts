import assert from 'node:assert/strict';
import { dealFromSeed, startMiniBridge, SEATS, seatViewSeed } from '../src/table';
import { principlesPolicy } from '../src/robots';

// US-18.3: an unlabelled, reproducible practice line shared with the browser flow.
export function sampledPractice() {
  const setup = startMiniBridge({ deal: dealFromSeed('bv-issue-27', 1), learnerSide: 'northSouth', targetDeclaringSide: 'northSouth' });
  while (setup.seatView('south').step !== 'contract-choice') setup.advance();
  const declarer = setup.seatView('south').declarer!;
  assert.equal(setup.submit(declarer, 'learner', { kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' }).kind, 'accepted');
  const table = setup.playthrough()!;
  const dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
  while (table.record().status !== 'completed') {
    const seat = table.seatView('south').turn!;
    const controller = table.controllerOf(seat);
    const view = table.seatView(seat === dummy ? declarer : seat);
    const choice = controller === 'robot' ? principlesPolicy.decide(view, seatViewSeed(view), Infinity) : undefined;
    assert.equal(table.submit(seat, controller, choice ? { kind: 'play-card', card: choice.card } : table.legalActions(seat)[0],
      choice ? { kind: 'robot', policy: principlesPolicy.name, version: principlesPolicy.version, ruleId: choice.ruleId, durationMs: 0 } : undefined).kind, 'accepted');
  }
  return table.completedRecord();
}
