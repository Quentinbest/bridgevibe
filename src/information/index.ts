import type { Card, Seat, SeatView, Suit } from '../table';
import { HINT_ENUMERATION_LIMIT, HINT_MAX_TRIES } from './parameters';


export type LayoutSample = Record<Seat, Card[]>;
export type SamplingResult = { layouts: LayoutSample[]; enumerated: boolean }
  | { abstention: { reason: 'uncertain'; cause: 'constraints' } };
const seats: Seat[] = ['north', 'east', 'south', 'west'];
const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const ranks: Card['rank'][] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const key = (card: Card) => `${card.suit}:${card.rank}`;
const points: Partial<Record<Card['rank'], number>> = { A: 4, K: 3, Q: 2, J: 1 };
const hcp = (cards: readonly Card[]) => cards.reduce((sum, card) => sum + (points[card.rank] ?? 0), 0);
function random(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => { state += 0x6D2B79F5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
// ADR-0001, §4.2: only Table types enter this module. Caller supplies seatViewSeed(view).
export function sampleLayouts(view: SeatView, count: number, seed: string, maxTries = HINT_MAX_TRIES): SamplingResult {
  const visible: Partial<LayoutSample> = { [view.seat]: [...view.hand] };
  const dummySeat = seats[(seats.indexOf(view.contract.declarer) + 2) % 4];
  if (view.dummy) visible[dummySeat] = [...view.dummy];
  const hidden = seats.filter(seat => !visible[seat]);
  const plays = [...view.tricks.flatMap(trick => trick.cards), ...view.currentTrick];
  const known = [...Object.values(visible).flat(), ...plays.map(play => play.card)];
  const used = new Set(known.map(key));
  const remaining = suits.flatMap(suit => ranks.map(rank => ({ suit, rank }))).filter(card => !used.has(key(card)));
  const voids = new Set<string>();
  for (const trick of [...view.tricks.map(trick => trick.cards), view.currentTrick]) {
    for (const play of trick) if (play.card.suit !== trick[0].card.suit) voids.add(`${play.seat}:${trick[0].card.suit}`);
  }
  const fits = (layout: LayoutSample) => seats.every(seat => layout[seat].length === view.cardCounts[seat]
    && layout[seat].every(card => !voids.has(`${seat}:${card.suit}`))
    && view.announcements.filter(a => a.seat === seat).every(a => hcp(layout[seat]) + hcp(plays.filter(p => p.seat === seat).map(p => p.card)) === a.hcp));
  const failure: SamplingResult = { abstention: { reason: 'uncertain', cause: 'constraints' } };
  if (!Number.isSafeInteger(count) || count < 1 || used.size !== known.length || remaining.length !== hidden.reduce((n, seat) => n + view.cardCounts[seat], 0)) return failure;
  const layoutFrom = (cards: Card[]) => {
    let offset = 0;
    return Object.fromEntries(seats.map(seat => [seat, visible[seat] ?? cards.slice(offset, offset += view.cardCounts[seat])])) as LayoutSample;
  };
  let possibilities = 1, left = remaining.length;
  for (const seat of hidden) {
    const size = view.cardCounts[seat];
    for (let i = 1; i <= size; i++) possibilities *= (left - i + 1) / i;
    left -= size;
  }
  if (Math.round(possibilities) <= HINT_ENUMERATION_LIMIT) {
    const layouts: LayoutSample[] = [];
    const assign = (index: number, cards: Card[], chosen: Card[]) => {
      if (index === hidden.length) { const layout = layoutFrom(chosen); if (fits(layout)) layouts.push(layout); return; }
      const size = view.cardCounts[hidden[index]];
      const choose = (start: number, indices: number[]) => {
        if (indices.length === size) { const selected = new Set(indices); assign(index + 1, cards.filter((_, i) => !selected.has(i)), [...chosen, ...indices.map(i => cards[i])]); return; }
        for (let i = start; i <= cards.length - (size - indices.length); i++) choose(i + 1, [...indices, i]);
      };
      choose(0, []);
    };
    assign(0, remaining, []);
    return layouts.length ? { layouts, enumerated: true } : failure;
  }
  const layouts: LayoutSample[] = [];
  for (let sample = 0; sample < count; sample++) {
    const next = random(`${seed}:${sample}`);
    let accepted = false;
    for (let attempt = 0; attempt < maxTries; attempt++) {
      const cards = [...remaining];
      for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
      const layout = layoutFrom(cards);
      if (fits(layout)) { layouts.push(layout); accepted = true; break; }
    }
    if (!accepted) return failure;
  }
  return { layouts, enumerated: false };
}
