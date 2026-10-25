import assert from 'node:assert/strict';
import decisions from '../../docs/domain/f4-draft/f4-decisions.json' with { type: 'json' };
import type { DraftPoint } from '../../scripts/f4/draft';
import { dealFromSeed, startMiniBridge, SEATS, seatViewSeed, type Card, type Playthrough } from '../../src/table';
import { principlesPolicy } from '../../src/robots';

export const points = decisions as unknown as DraftPoint['decision'][];
export function f4Position(point: DraftPoint['decision']) {
  if (point.origin.kind !== 'seed') throw new Error('Expected seeded F4');
  const setup = startMiniBridge({ deal: dealFromSeed(point.origin.seed, point.origin.index), learnerSide: 'northSouth',
    targetDeclaringSide: point.learnerRole === 'declarer' ? 'northSouth' : 'eastWest' });
  while (setup.seatView('south').step !== 'contract-choice') setup.advance();
  const seat = setup.seatView('south').declarer!;
  const choice = point.positionKey.setup.find(e => e.kind === 'contract-choice')!;
  if (choice.kind !== 'contract-choice') throw new Error('Missing choice');
  assert.equal(setup.submit(seat, setup.controllerOf(seat), choice.action, choice.provenance).kind, 'accepted');
  const table = setup.playthrough()!;
  assert.equal(table.record().deal.dealId, point.dealId);
  assert.deepEqual(table.record().setupEvents, point.positionKey.setup);
  for (const action of point.positionKey.actions) assert.equal(table.submit(action.seat, action.controller, action.action, action.provenance).kind, 'accepted');
  assert.equal(table.seatView('south').turn, point.seatToAct);
  return table;
}
export function finish(table: Playthrough, candidate: Card) {
  const turn = table.seatView('south').turn!;
  assert.equal(table.submit(turn, 'learner', { kind: 'play-card', card: candidate }).kind, 'accepted');
  const declarer = table.record().contract.declarer;
  const dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
  while (table.record().status !== 'completed') {
    const seat = table.seatView('south').turn!;
    const controller = table.controllerOf(seat);
    const view = table.seatView(seat === dummy ? declarer : seat);
    const decision = controller === 'robot' ? principlesPolicy.decide(view, seatViewSeed(view), Infinity) : undefined;
    const action = decision ? { kind: 'play-card' as const, card: decision.card } : table.legalActions(seat)[0];
    assert.equal(table.submit(seat, controller, action, decision ? { kind: 'robot', policy: principlesPolicy.name,
      version: principlesPolicy.version, ruleId: decision.ruleId, durationMs: 0 } : undefined).kind, 'accepted');
  }
  return table.completedRecord();
}
