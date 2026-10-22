import { RANKS, SEATS, SUITS, type Card, type Seat } from '../table';
import { type CardClass, type Layout, type Position } from './index';

// GLOSSARY Equivalent Actions, US-17.2: scores do not determine equivalence.
// Cards in no hand were played in earlier tricks; a card on the current trick can still win it, so it
// separates ranks like a card in another hand (matches DDS's `equals`, checked in F2).
export function equivalentClasses(layout: Layout, position: Position, acting: Seat, scored: readonly { card: Card; tricks: number }[]): CardClass[] {
  const classes: { cards: Card[]; tricks: number }[] = [];
  for (const suit of SUITS) {
    const cards = scored.filter(entry => entry.card.suit === suit)
      .sort((a, b) => RANKS.indexOf(a.card.rank) - RANKS.indexOf(b.card.rank));
    const otherRanks = [...SEATS.filter(seat => seat !== acting).flatMap(seat => layout[seat]), ...position.currentTrick.map(play => play.card)]
      .filter(card => card.suit === suit).map(card => RANKS.indexOf(card.rank));
    let group: typeof classes[number] | undefined;
    for (const entry of cards) {
      const previous = group?.cards.at(-1);
      const separated = previous && otherRanks.some(rank => rank > RANKS.indexOf(previous.rank) && rank < RANKS.indexOf(entry.card.rank));
      if (!group || separated) {
        group = { cards: [entry.card], tricks: entry.tricks };
        classes.push(group);
      } else {
        if (entry.tricks !== group.tricks) throw new Error('Equivalent cards have different solver scores');
        group.cards.push(entry.card);
      }
    }
  }
  return classes;
}
