import { positionDigest } from './positionKey';
import { RANKS, SEATS, SUITS, type Card, type Seat, type Side } from './index';
import type { Contract, PlayedCard, Status, Trick } from './playthrough';

// ADR-0001: the brand and reconstruction stay inside Table.
const seatViewBrand: unique symbol = Symbol('SeatView');
export type SeatView = Readonly<{
  [seatViewBrand]: true;
  seat: Seat;
  positionIndex: number;
  hand: readonly Card[];
  dummy: readonly Card[] | null;
  contract: Contract;
  tricks: readonly Trick[];
  currentTrick: readonly PlayedCard[];
  turn: Seat | null;
  tricksWon: Readonly<Record<Side, number>>;
  cardCounts: Readonly<Record<Seat, number>>;
  status: Status;
}>;
export type SeatViewMessage = Omit<SeatView, typeof seatViewBrand>;
type Check = (value: unknown) => boolean;
const choice = (values: readonly unknown[]): Check => value => values.includes(value);
const integer = (max: number): Check => value => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
const array = (check: Check, max: number): Check => value => Array.isArray(value) && value.length <= max
  && Reflect.ownKeys(value).length === value.length + 1 && Array.from(value).every(check);
const object = (fields: Record<string, Check>): Check => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === Object.keys(fields).length && keys.every(key => typeof key === 'string'
    && Object.hasOwn(fields, key) && fields[key]((value as Record<string, unknown>)[key]));
};
function valid(value: unknown): boolean {
  const seat = choice(SEATS);
  const card = object({ suit: choice(SUITS), rank: choice(RANKS) });
  const played = object({ seat, card });
  const schema = object({
    seat, positionIndex: integer(52), hand: array(card, 13), dummy: value => value === null || array(card, 13)(value),
    contract: object({ level: value => integer(7)(value) && value !== 0, strain: choice([...SUITS, 'no-trumps']), declarer: seat }),
    tricks: array(object({ cards: value => array(played, 4)(value) && (value as unknown[]).length === 4, winner: seat }), 13),
    currentTrick: array(played, 3), turn: value => value === null || seat(value),
    tricksWon: object({ northSouth: integer(13), eastWest: integer(13) }),
    cardCounts: object({ north: integer(13), east: integer(13), south: integer(13), west: integer(13) }),
    status: choice(['in-progress', 'completed']),
  });
  return schema(value);
}
export function encodeSeatView(view: SeatView): SeatViewMessage {
  // ADR-0001: explicit fields prevent accidental additions leaking across the boundary.
  const { seat, positionIndex, hand, dummy, contract, tricks, currentTrick, turn, tricksWon, cardCounts, status } = view;
  return JSON.parse(JSON.stringify({ seat, positionIndex, hand, dummy, contract, tricks, currentTrick, turn, tricksWon, cardCounts, status }));
}
export function decodeSeatView(data: unknown): SeatView {
  if (!valid(data)) throw new Error('Invalid SeatView message');
  return { ...JSON.parse(JSON.stringify(data)), [seatViewBrand]: true };
}

// US-10.3, ADR-0001: policy randomness must not depend on hidden cards.
export function seatViewSeed(view: SeatView): string {
  return positionDigest(encodeSeatView(view));
}

// ADR-0001: setup has its own brand and no Contract until the Table accepts a choice.
const setupSeatViewBrand: unique symbol = Symbol('SetupSeatView');
export type SetupSeatView = Readonly<{
  [setupSeatViewBrand]: true;
  seat: Seat; hand: readonly Card[]; dummy: readonly Card[] | null; dummySeat: Seat | null;
  announcements: readonly import('./miniBridge').Announcement[];
  declarer: Seat | null; tied: boolean; step: import('./miniBridge').SetupStep;
}>;
export type SetupSeatViewMessage = Omit<SetupSeatView, typeof setupSeatViewBrand>;
export function encodeSetupSeatView(view: SetupSeatView): SetupSeatViewMessage {
  const { seat, hand, dummy, dummySeat, announcements, declarer, tied, step } = view;
  return JSON.parse(JSON.stringify({ seat, hand, dummy, dummySeat, announcements, declarer, tied, step }));
}
export function decodeSetupSeatView(data: unknown): SetupSeatView {
  const seat = choice(SEATS), card = object({ suit: choice(SUITS), rank: choice(RANKS) });
  const nullableSeat: Check = value => value === null || seat(value);
  if (!object({ seat, hand: array(card, 13), dummy: value => value === null || array(card, 13)(value), dummySeat: nullableSeat,
    announcements: array(object({ seat, hcp: integer(40) }), 4), declarer: nullableSeat, tied: choice([true, false]),
    step: choice(['announcements', 'redeal', 'declarer', 'dummy', 'contract-choice', 'complete']) })(data)) throw new Error('Invalid SetupSeatView message');
  return { ...JSON.parse(JSON.stringify(data)), [setupSeatViewBrand]: true };
}
