import { RANKS, SUITS, type Action, type Card, type SeatView, type SetupSeatView } from '../table';

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

// PLACEHOLDER (DEP-02): teacher review pending; only own cards, exposed Dummy and Announcements.
export const contractChoicePolicy = {
  name: 'bv-contract-placeholder', version: '0', ruleId: 'placeholder-dep-02',
  decide(view: SetupSeatView) {
    if (!view.dummy || !view.declarer || view.seat !== view.declarer) throw new Error('Contract choice requires declarer and exposed dummy');
    const cards = [...view.hand, ...view.dummy];
    const spades = cards.filter(card => card.suit === 'spades').length;
    const hearts = cards.filter(card => card.suit === 'hearts').length;
    const strain: 'spades' | 'hearts' | 'no-trumps' = spades >= 8 && spades >= hearts ? 'spades' : hearts >= 8 ? 'hearts' : 'no-trumps';
    const hcp = view.announcements.filter(a => a.seat === view.seat || a.seat === view.dummySeat).reduce((n, a) => n + a.hcp, 0);
    return { kind: 'choose-contract' as const, strain, objective: hcp >= 25 ? 'game' as const : 'part-score' as const };
  },
};
