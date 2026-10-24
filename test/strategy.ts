import { fallbackPolicy, principlesPolicy } from '../src/robots';
import { startPlaythrough, type Playthrough, type Seat } from '../src/table';
import { fixedDeal } from '../src/app/fixture';

// US-01 / §5.2: shared first-legal learner strategy at Table and UI seams.
export function firstLegal(table: Playthrough, seat: Seat) { return table.legalActions(seat)[0]; }
export function fixedPlaythrough() {
  return startPlaythrough({ deal: fixedDeal, contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
}
// #13: Node compositions have no worker, so robots fall back; e2e workers run the principles policy.
export function completeFixedDeal(robots: 'fallback' | 'principles' = 'fallback') {
  const table = fixedPlaythrough();
  while (table.seatView('south').turn) {
    const seat = table.seatView('south').turn!;
    const controller = seat === 'north' || seat === 'south' ? 'learner' : 'robot';
    const action = controller === 'learner' ? firstLegal(table, seat) : { kind: 'play-card', card: robots === 'fallback' ? fallbackPolicy(table.seatView(seat)) : principlesPolicy.decide(table.seatView(seat), 'fixed', Infinity).card };
    const result = table.submit(seat, controller, action, controller === 'robot' ? { kind: 'robot', policy: 'test-policy', version: '1', durationMs: 0 } : undefined);
    if (result.kind !== 'accepted') throw new Error(result.reason);
  }
  return table.record();
}
