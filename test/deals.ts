import { dealIdOf, RANKS, SEATS, SUITS, sameCard, type Card, type Deal, type Hand, type Seat } from '../src/table';

export const card = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank });
export function dealWith(prefix: Partial<Record<Seat, readonly Card[]>> = {}): Deal {
  const hands = { north: [...prefix.north ?? []], east: [...prefix.east ?? []], south: [...prefix.south ?? []], west: [...prefix.west ?? []] };
  const reserved = Object.values(hands).flat();
  const remaining = SUITS.flatMap(suit => RANKS.map(rank => card(suit, rank))).filter(candidate => !reserved.some(held => sameCard(held, candidate)));
  let index = 0;
  while (remaining.length) {
    const seat = SEATS[index++ % 4];
    if (hands[seat].length < 13) hands[seat].push(remaining.shift()!);
  }
  const content = { hands: hands as unknown as Record<Seat, Hand>, dealer: 'south' as const, vulnerability: { northSouth: false, eastWest: false } };
  return { ...content, dealId: dealIdOf(content), origin: { kind: 'authored', contentId: 'test.fixture', version: 1 } };
}
