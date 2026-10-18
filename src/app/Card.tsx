import type { Card as TableCard } from '../table';
import { text } from '../explanation';
export type Deck = 'two-colour' | 'four-colour';
export function Card({ card, deck = 'two-colour' }: { card: TableCard; deck?: Deck }) {
  return <div role="img" className="card" data-suit={card.suit} data-deck={deck}
    aria-label={text('card.name', { rank: text(`rank.${card.rank}`), suit: text(`suit.${card.suit}`) })}>
    <span>{text(`face.${card.rank}`)}</span><span>{text(`symbol.${card.suit}`)}</span>
  </div>;
}
export function CardBack() { return <div className="card-back" aria-hidden="true" />; }
