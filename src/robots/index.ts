import { RANKS, SUITS, type Card, type SeatView } from '../table';

// Engineering §4.6.6: deterministic fallback using only this Seat's information.
export function fallbackPolicy(view: SeatView): Card {
  const led = view.currentTrick[0]?.card.suit;
  const following = view.hand.filter(card => card.suit === led);
  let candidates = following;
  if (!candidates.length) {
    const nonTrumps = view.hand.filter(card => card.suit !== view.contract.strain);
    const pool = led && nonTrumps.length ? nonTrumps : view.hand;
    const suits = SUITS.map(suit => pool.filter(card => card.suit === suit));
    candidates = suits.reduce((longest, cards) => cards.length > longest.length ? cards : longest, []);
  }
  const lowest = [...candidates].sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank))[0];
  if (!lowest) throw new Error('Fallback requires a nonempty acting hand');
  return { ...lowest };
}
