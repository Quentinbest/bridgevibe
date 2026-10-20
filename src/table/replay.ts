import { SEATS, type Card, type Seat } from './index';
import { completedRecord, startPlaythrough, type CompletedPlaythroughRecord, type PlaythroughRecord, type Trick } from './playthrough';

export type ReplayTrick = Trick & Readonly<{ hands: Readonly<Record<Seat, readonly Card[]>> }>;

// ADR-0002, §4.8: reconstruct positions through Table; never ask a policy to decide again.
export function replay(record: CompletedPlaythroughRecord): readonly ReplayTrick[] {
  completedRecord(record);
  const { table, tricks } = reconstruct(record);
  if (table.record().status !== 'completed') throw new Error('Completed record does not contain 13 legal tricks');
  return tricks;
}

export function reconstruct(record: PlaythroughRecord) {
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide });
  const tricks: ReplayTrick[] = [];
  let hands = snapshot();
  function snapshot(): Record<Seat, readonly Card[]> {
    return { north: table.seatView('north').hand, east: table.seatView('east').hand,
      south: table.seatView('south').hand, west: table.seatView('west').hand };
  }
  record.actions.forEach((entry, index) => {
    if (entry.index !== index || !SEATS.includes(entry.seat)) throw new Error(`Invalid action index or seat at ${index}`);
    const result = table.submit(entry.seat, entry.controller, entry.action, entry.provenance);
    if (result.kind === 'rejected') throw new Error(`Illegal record action ${index}: ${result.reason} (rules ${record.rulesCoreVersion})`);
    if (index % 4 === 3) {
      tricks.push({ ...table.seatView('south').tricks.at(-1)!, hands });
      hands = snapshot();
    }
  });
  const rebuilt = table.record();
  if (rebuilt.status !== record.status || rebuilt.result.northSouth !== record.result.northSouth
    || rebuilt.result.eastWest !== record.result.eastWest) throw new Error('Record status or result disagrees with its actions');
  return { table, tricks };
}
