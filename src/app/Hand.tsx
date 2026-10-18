import { useEffect, useRef, useState } from 'react';
import { SUITS, sameCard, type Card as TableCard, type Suit } from '../table';
import { cardName, text } from '../explanation';
import { Card } from './Card';

type Props = { cards: readonly TableCard[]; dummy?: boolean; active: boolean; legalCards: readonly TableCard[]; ledSuit?: Suit;
  selected: TableCard | null; onSelect: (card: TableCard | null) => void; onPlay: (card: TableCard) => void };
export function Hand({ cards, dummy = false, active, legalCards, ledSuit, selected, onSelect, onPlay }: Props) {
  const ordered = SUITS.flatMap(suit => cards.filter(card => card.suit === suit));
  const [focusIndex, setFocusIndex] = useState(0);
  // UX §10: keep a tab stop when the previously focused last card is removed.
  const clampedIndex = Math.max(0, Math.min(focusIndex, ordered.length - 1));
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => { if (active) buttons.current[clampedIndex]?.focus({ preventScroll: true }); }, [active, clampedIndex]);
  // UX §10: when the confirmation button unmounts (a play was rejected), focus returns to the hand's tab stop,
  // which is the card the learner last focused, unless focus is already on one of this hand's cards.
  useEffect(() => {
    if (active && !selected && !buttons.current.some(button => button === document.activeElement)) buttons.current[clampedIndex]?.focus({ preventScroll: true });
  }, [active, selected, clampedIndex]);
  function choose(card: TableCard) {
    if (selected && sameCard(selected, card)) onPlay(card);
    else onSelect(card);
  }
  return <div className={dummy ? 'suit-columns' : 'hand'}>{SUITS.map(suit => <div className={dummy ? 'suit-column' : 'hand-suit'} key={suit} data-suit={suit}>
    {ordered.filter(card => card.suit === suit).map(card => {
      const index = ordered.indexOf(card);
      const raised = !!selected && sameCard(selected, card);
      const legal = legalCards.some(candidate => sameCard(candidate, card));
      return active ? <button key={card.rank} type="button" className="card" data-suit={card.suit} data-selected={raised}
        ref={element => { buttons.current[index] = element; }} tabIndex={index === clampedIndex ? 0 : -1}
        aria-pressed={raised}
        onFocus={() => setFocusIndex(index)} onClick={() => choose(card)} onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            buttons.current[(index + (event.key === 'ArrowRight' ? 1 : ordered.length - 1)) % ordered.length]?.focus();
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); choose(card);
          } else if (event.key === 'Escape') { event.preventDefault(); onSelect(null); }
        }}>
        {/* UX §10 names cards in full ("Jack of spades, playable"). The name comes from content, not
            aria-label, so the abbreviated face isn't a visible label missing from the name (WCAG 2.5.3). */}
        <span aria-hidden="true">{text(`face.${card.rank}`)}</span><span aria-hidden="true">{text(`symbol.${card.suit}`)}</span>
        <span className="sr-only">{legal ? text('card.playable', { card: cardName(card) })
          : ledSuit ? text('card.unplayable', { card: cardName(card), suit: text(`suit.${ledSuit}`) }) : cardName(card)}</span>
      </button> : <Card key={card.rank} card={card} />;
    })}
  </div>)}</div>;
}
