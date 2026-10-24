import { expect } from 'vitest';
import { startMiniBridge, SEATS, type Deal, type Playthrough, type Seat, type Action } from '../../src/table';

export const partner = (seat: Seat): Seat => SEATS[(SEATS.indexOf(seat) + 2) % 4];
export function begin(deal: Deal) {
  const setup = startMiniBridge({ deal, learnerSide: 'northSouth' });
  for (let i = 0; i < 6; i++) setup.advance();
  const view = setup.seatView('south');
  expect(view.step).toBe('contract-choice');
  const seat = view.declarer!;
  const controller = setup.controllerOf(seat);
  expect(setup.submit(seat, controller, { kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' },
    controller === 'robot' ? { kind: 'robot', policy: 'f3-script', version: '1', durationMs: 0 } : undefined).kind).toBe('accepted');
  return setup.playthrough()!;
}

export function scripted(table: Playthrough, action?: Action) {
  const seat = table.seatView('south').turn!;
  const controller = table.controllerOf(seat);
  expect(table.submit(seat, controller, action ?? table.legalActions(seat)[0], controller === 'robot'
    ? { kind: 'authored', contentId: 'f3-prefix', version: 1 } : undefined).kind).toBe('accepted');
}

export type Position = { seed: string; index: number; actions: number; seat: Seat; kind: 'robot' | 'hint' };

// US-44.1: first-legal Table prefixes, pinned independently of the policy under test.
export const positions: readonly Position[] = [
  { seed: 'f3', index: 1, actions: 1, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 1, actions: 3, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 1, actions: 17, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 1, actions: 19, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 1, actions: 33, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 1, actions: 35, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 2, actions: 0, seat: 'west', kind: 'robot' },
  { seed: 'f3', index: 2, actions: 2, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 2, actions: 17, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 2, actions: 19, seat: 'west', kind: 'robot' },
  { seed: 'f3', index: 2, actions: 32, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 2, actions: 34, seat: 'west', kind: 'robot' },
  { seed: 'f3', index: 3, actions: 16, seat: 'east', kind: 'robot' },
  { seed: 'f3', index: 3, actions: 18, seat: 'west', kind: 'robot' },
  { seed: 'f3', index: 1, actions: 32, seat: 'south', kind: 'hint' },
  { seed: 'f3', index: 1, actions: 36, seat: 'south', kind: 'hint' },
  { seed: 'f3', index: 2, actions: 31, seat: 'south', kind: 'hint' },
  { seed: 'f3', index: 2, actions: 35, seat: 'south', kind: 'hint' },
  { seed: 'f3', index: 3, actions: 29, seat: 'north', kind: 'hint' },
  { seed: 'f3', index: 3, actions: 32, seat: 'north', kind: 'hint' },
];
