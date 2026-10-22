import type { Seat } from '../table';
import { text } from '../explanation';

export type ScreenPosition = 'bottom' | 'top' | 'left' | 'right';

// US-02.4, UX §3.2: map display positions only; true seats never change.
export function tablePositions(declarer: Seat | null): Readonly<Record<Seat, ScreenPosition>> {
  return declarer === 'north'
    ? { north: 'bottom', south: 'top', east: 'left', west: 'right' }
    : { north: 'top', south: 'bottom', east: 'right', west: 'left' };
}

export function seatLabel(seat: Seat, declarer: Seat | null): string {
  const declaring = declarer === 'north' || declarer === 'south';
  return text(declaring && (seat === 'north' || seat === 'south') ? 'seat.you-play' : seat === 'south' ? 'seat.you' : 'seat.label', {
    seat: text(`seat.${seat}`), letter: text(`seat.letter.${seat}`),
  });
}

export function declaringTurn(seat: Seat, declarer: Seat): string {
  return text(seat === declarer ? 'turn.declarer-seat' : 'turn.dummy-seat', { seat: text(`seat.${seat}`) });
}
