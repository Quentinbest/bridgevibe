export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const SEATS = ['north', 'east', 'south', 'west'] as const;
export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export type Seat = typeof SEATS[number];
export type Card = Readonly<{ suit: Suit; rank: Rank }>;
export type Hand = readonly [Card, Card, Card, Card, Card, Card, Card, Card, Card, Card, Card, Card, Card];
export type Side = 'northSouth' | 'eastWest';
export type Vulnerability = Readonly<Record<Side, boolean>>;
export type DealOrigin = Readonly<{ kind: 'seed'; seed: string; index: number; rotation: 0; algorithm: 'bv-deal-1' }>
  | Readonly<{ kind: 'authored'; contentId: string; version: number }>;
export type Deal = Readonly<{ dealId: string; origin: DealOrigin; hands: Readonly<Record<Seat, Hand>>; dealer: Seat; vulnerability: Vulnerability }>;
export * from './playthrough';
export { DEALING_ALGORITHM, dealFromSeed, dealIdOf, redeal } from './dealing';
export { encodeSeatView, decodeSeatView, seatViewSeed, type SeatViewMessage } from './seatViewMessage';
export * from './scoring';
export { replay, type ReplayTrick } from './replay';
export { exportRecordJson, importRecordJson, exportPbn, importPbn } from './record-io';

export * from './miniBridge';
export * from './miniBridgeRules';
export { encodeSetupSeatView, decodeSetupSeatView, type SetupSeatView, type SetupSeatViewMessage } from './seatViewMessage';
