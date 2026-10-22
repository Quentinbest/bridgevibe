import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { SUITS, sameCard, type Card as TableCard, type Suit } from '../table';
import { cardName, text } from '../explanation';
import { Card } from './Card';

type Props = { cards: readonly TableCard[]; dummy?: boolean; active: boolean; legalCards: readonly TableCard[]; ledSuit?: Suit;
  rejectionId?: number; rejectedCard?: TableCard | null; selected: TableCard | null; onSelect: (card: TableCard | null) => void; onPlay: (card: TableCard) => void };
// UX §10: track system changes as well as the initial reduced-motion preference.
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion:reduce)').matches ?? false;
function subscribeMotion(listener: () => void) {
  const query = window.matchMedia?.('(prefers-reduced-motion:reduce)');
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
}
export function Hand({ cards, dummy = false, active, legalCards, ledSuit, selected, onSelect, onPlay, rejectedCard, rejectionId = 0 }: Props) {
  const reduceMotion = useSyncExternalStore(subscribeMotion, reducedMotion);
  const ordered = SUITS.flatMap(suit => cards.filter(card => card.suit === suit));
  const [focusIndex, setFocusIndex] = useState(0);
  // UX §10: keep a tab stop when the previously focused last card is removed.
  const clampedIndex = Math.max(0, Math.min(focusIndex, ordered.length - 1));
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  // UX §10: when the turn reaches this hand, focus moves into it only from nowhere or from the table,
  // never away from a control the learner is using (the header's deal controls or an open dialog).
  const mayTakeFocus = () => {
    const current = document.activeElement;
    return !current || current === document.body || (!!current.closest('main') && !current.closest('.rotation-notice'));
  };
  useEffect(() => { if (active && mayTakeFocus()) buttons.current[clampedIndex]?.focus({ preventScroll: true }); }, [active, clampedIndex]);
  // UX §10: when the confirmation button unmounts (a play was rejected), focus returns to the hand's tab stop,
  // which is the card the learner last focused, unless focus is already on one of this hand's cards.
  useEffect(() => {
    if (active && !selected && mayTakeFocus() && !buttons.current.some(button => button === document.activeElement)) buttons.current[clampedIndex]?.focus({ preventScroll: true });
  }, [active, selected, clampedIndex]);
  // UX §3.4: restart even when React batches clearing and repeating the same rejection.
  useEffect(() => {
    if (reduceMotion || !rejectedCard) return;
    const button = buttons.current.find(button => button?.dataset.suit === rejectedCard.suit && button.dataset.rank === rejectedCard.rank);
    for (const animation of button?.getAnimations?.() ?? []) { animation.cancel(); animation.play(); }
  }, [rejectionId, rejectedCard, reduceMotion]);
  function choose(card: TableCard) {
    if (selected && sameCard(selected, card)) onPlay(card);
    else onSelect(card);
  }
  return <div className={dummy ? 'suit-columns' : 'hand'}>{SUITS.map(suit => <div className={dummy ? 'suit-column' : 'hand-suit'} key={suit} data-suit={suit}>
    {ordered.filter(card => card.suit === suit).map(card => {
      const index = ordered.indexOf(card);
      const raised = !!selected && sameCard(selected, card);
      const legal = legalCards.some(candidate => sameCard(candidate, card));
      return active ? <button key={card.rank} type="button" className={rejectedCard && sameCard(rejectedCard, card) && !reduceMotion ? 'card rejected-card' : 'card'} data-suit={card.suit} data-rank={card.rank} data-rejection-id={rejectedCard && sameCard(rejectedCard, card) ? rejectionId : undefined} data-selected={raised}
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

// UX §3.2: session memory only, shared by practice and lessons; no persistence.
let rotationExplained = false;
export function RotationNotice() {
  const [visible, setVisible] = useState(() => !rotationExplained);
  const description = useId();
  const dismissal = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!visible) return;
    rotationExplained = true;
    const focused = document.activeElement;
    if (!focused || focused === document.body || focused.closest('main')) dismissal.current?.focus({ preventScroll: true });
  }, [visible]);
  if (!visible) return null;
  return <aside className="rotation-notice">
    <p id={description} role="status">{text('rotation.notice')}</p>
    <button ref={dismissal} aria-describedby={description} type="button" onClick={event => {
      // UX §10: move focus before removing the focused dismissal control.
      event.currentTarget.closest('main')?.querySelector<HTMLElement>('.turn-banner')?.focus({ preventScroll: true });
      setVisible(false);
    }}>{text('rotation.dismiss')}</button>
  </aside>;
}
