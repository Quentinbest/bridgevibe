import { completedRecord, replay, SEATS, startPlaythrough, type Card, type CompletedPlaythroughRecord, type Contract, type PlayedCard, type Seat } from '../table';

export type Layout = Readonly<Record<Seat, readonly Card[]>>;
export type Position = { strain: Contract['strain']; leader: Seat; currentTrick: readonly PlayedCard[] };
export type Engine = { name: string; version: string };
export type CardClass = { cards: readonly Card[]; tricks: number };
export type PositionResult = Engine & { classes: readonly CardClass[] };
export type TableResult = Engine & { table: readonly (readonly number[])[] };
// §4.3.2: rows S/H/D/C/NT, columns N/E/S/W; tricks remaining for the side to act.
export type SolverPort = Engine & {
  solvePosition(layout: Layout, position: Position): Promise<PositionResult>;
  solveTable(layout: Layout): Promise<TableResult>;
};
export const bridgeDdsEngine = { name: 'bridge-dds', version: '1.4.0 / DDS 2.9' } as const;

// ADR-0001: the public service accepts only the completion capability, checked again at runtime.
export function positionAt(record: CompletedPlaythroughRecord, index: number) {
  completedRecord(record);
  if (!Number.isInteger(index) || index < 0 || index >= record.actions.length) throw new Error('Invalid position index');
  replay(record);
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide });
  for (const entry of record.actions.slice(0, index)) table.submit(entry.seat, entry.controller, entry.action, entry.provenance);
  const view = table.seatView('south');
  const layout = Object.fromEntries(SEATS.map(seat => [seat, table.seatView(seat).hand])) as Layout;
  return { layout, position: { strain: record.contract.strain, leader: view.currentTrick[0]?.seat ?? view.turn!, currentTrick: view.currentTrick },
    legalCards: table.legalActions(view.turn!).map(action => action.card) };
}
export function doubleDummy(solver: SolverPort, record: CompletedPlaythroughRecord, index: number) {
  const { layout, position } = positionAt(record, index);
  return solver.solvePosition(layout, position);
}
