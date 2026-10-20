import { RANKS, SUITS, type Action, type Card, type SeatView } from '../table';

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

// §4.3.3: policies receive only one Seat View and reproducibility/time inputs.
export type RobotPolicy = { name: string; version: string; decide(view: SeatView, seed: string, deadline: number): Action };
export const fallbackRobotPolicy: RobotPolicy = {
  name: 'bv-fallback', version: '1', decide: view => ({ kind: 'play-card', card: fallbackPolicy(view) }),
};
// US-10.1: teacher-approved rules arrive with #13.
export const basicPolicy: RobotPolicy = { ...fallbackRobotPolicy, name: 'bv-basic' };
