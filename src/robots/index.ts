import { RANKS, SUITS, type Action, type Card, type SeatView, type SetupSeatView, SEATS } from '../table';

// Engineering §4.6.6: deterministic fallback using only this Seat's information.
export function fallbackPolicy(view: SeatView): Card {
  return fallbackCard(view, view.hand);
}

function fallbackCard(view: SeatView, hand: readonly Card[]): Card {
  const led = view.currentTrick[0]?.card.suit;
  const following = hand.filter(card => card.suit === led);
  let candidates = following;
  if (!candidates.length) {
    const nonTrumps = hand.filter(card => card.suit !== view.contract.strain);
    const pool = led && nonTrumps.length ? nonTrumps : hand;
    const suits = SUITS.map(suit => pool.filter(card => card.suit === suit));
    candidates = suits.reduce((longest, cards) => cards.length > longest.length ? cards : longest, []);
  }
  const lowest = [...candidates].sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank))[0];
  if (!lowest) throw new Error('Fallback requires a nonempty acting hand');
  return { ...lowest };
}

// §4.3.3: policies receive only one Seat View and reproducibility/time inputs.
export type RobotPolicy = { name: string; version: string; decide(view: SeatView, seed: string, deadline: number): Action & { ruleId?: string } };
export const fallbackRobotPolicy: RobotPolicy = {
  name: 'bv-fallback', version: '1', decide: view => ({ kind: 'play-card', card: fallbackCard(view, actingHand(view)), ruleId: 'fallback-lowest' }),
};
// ADR-0001: Dummy is played from Declarer's unchanged Table view.
export function actingHand(view: SeatView): readonly Card[] {
  const dummySeat = SEATS[(SEATS.indexOf(view.contract.declarer) + 2) % 4];
  return view.seat === view.contract.declarer && view.turn === dummySeat ? view.dummy ?? [] : view.hand;
}
export { principlesPolicy } from './principles';
// Compatibility for callers explicitly exercising the old policy.
export const basicPolicy: RobotPolicy = { name: 'bv-basic', version: '1', decide: view => ({ kind: 'play-card', card: fallbackPolicy(view) }) };

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
