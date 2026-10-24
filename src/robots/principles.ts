import { RANKS, SUITS, SEATS, sideOf, sameCard, type Card, type Seat, type SeatView, type Suit } from '../table';
import { actingHand, fallbackRobotPolicy, type RobotPolicy } from './index';

const rank = (c: Card) => 14 - RANKS.indexOf(c.rank);
const low = (cards: readonly Card[]) => [...cards].sort((a, b) => rank(a) - rank(b) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit))[0];
const high = (cards: readonly Card[]) => low(cards.filter(c => rank(c) === Math.max(...cards.map(rank))));
const suited = (cards: readonly Card[], suit: string) => cards.filter(c => c.suit === suit);
const partner = (seat: Seat) => SEATS[(SEATS.indexOf(seat) + 2) % 4];
type Context = ReturnType<typeof context>;
type Rule = (c: Context) => Card | undefined;
function context(view: SeatView) {
  const hand = actingHand(view), seat = view.turn ?? view.seat, led = view.currentTrick[0];
  const following = led ? suited(hand, led.card.suit) : [];
  const legal = following.length ? following : hand;
  const declaring = sideOf(seat) === sideOf(view.contract.declarer);
  const other = declaring && view.seat === view.contract.declarer ? (seat === view.seat ? view.dummy ?? [] : view.hand) : [];
  const played = [...view.tricks.flatMap(t => t.cards), ...view.currentTrick].map(p => p.card);
  const known = [...hand, ...other, ...(view.dummy ?? []), ...played];
  const unseen = SUITS.flatMap(suit => RANKS.map(r => ({ suit, rank: r }))).filter(card => !known.some(k => sameCard(k, card)));
  const beats = (a: Card, b: Card) => a.suit === b.suit ? rank(a) > rank(b) : a.suit === view.contract.strain;
  // DEP-03: this is a policy estimate; only Table adjudicates trick winners.
  const winning = view.currentTrick.reduce<typeof led | undefined>((best, p) => !best || beats(p.card, best.card) ? p : best, undefined);
  const ours = !!winning && sideOf(winning.seat) === sideOf(seat);
  const top = (card: Card) => !unseen.some(u => u.suit === card.suit && rank(u) > rank(card));
  return { view, hand, seat, led, legal, following, declaring, other, played, unseen, beats, winning, ours, top };
}
const groups = (cards: readonly Card[]) => SUITS.map(suit => suited(cards, suit)).filter(g => g.length);
const longest = (cards: readonly Card[]) => groups(cards).filter(g => g.length === Math.max(...groups(cards).map(g => g.length)));
const forbiddenAce = (c: Context, suit: Suit) => c.view.contract.strain !== 'no-trumps'
  && c.hand.some(k => k.suit === suit && k.rank === 'A') && !c.hand.some(k => k.suit === suit && k.rank === 'K');
const safeLead = (c: Context) => c.hand.filter(k => !forbiddenAce(c, k.suit));
const leadFrom = (cards: readonly Card[]) => low(longest(cards).map(g => {
  const sorted = [...g].sort((a, b) => rank(b) - rank(a));
  return sorted[g.length === 3 ? 2 : g.some(k => rank(k) >= 11) ? Math.min(3, g.length - 1) : Math.min(1, g.length - 1)];
}));
function leadSequence(c: Context) {
  return low(safeLead(c).filter(k => rank(k) >= 11 && c.hand.some(n => n.suit === k.suit && rank(n) === rank(k) - 1)
    && !c.hand.some(n => n.suit === k.suit && rank(n) === rank(k) + 1)));
}
function shortCandidates(c: Context) {
  // lead-short-suit: weak means at most 7 HCP; avoid trump singletons and honour doubletons.
  const hcp = c.hand.reduce((n, k) => n + Math.max(0, rank(k) - 10), 0);
  return c.view.contract.strain === 'no-trumps' || hcp > 7 ? [] : groups(safeLead(c))
    .filter(g => g[0].suit !== c.view.contract.strain && (g.length === 1 || g.length === 2 && g.every(k => rank(k) < 11))).map(high);
}
function leadLongSuit(c: Context) {
  if (shortCandidates(c).length) return;
  const card = leadFrom(c.hand);
  return card && !forbiddenAce(c, card.suit) ? card : undefined;
}
function leadNotAceWithoutKing(c: Context) {
  // lead-not-ace-without-king: a guard on sequence/length selection; report it when it redirects the lead.
  if (shortCandidates(c).length || !c.hand.some(k => forbiddenAce(c, k.suit))) return;
  return leadFrom(safeLead(c));
}
function leadShortSuit(c: Context) { return low(shortCandidates(c)); }
function secondHandCoverHonour(c: Context) {
  const led = c.led!;
  if (rank(led.card) < 11 || sideOf(led.seat) === sideOf(c.seat)) return;
  // second-hand-cover-honour: covering promotes a possible lower card; defer touching Dummy honours.
  if (led.seat === partner(c.view.contract.declarer) && c.view.dummy?.some(k => k.suit === led.card.suit && rank(k) === rank(led.card) - 1)) return;
  // A jack promotes nothing when all lower cards are already public/ours and none remains with partner.
  if (led.card.rank === 'J' && ![...c.hand, ...c.unseen].some(k => k.suit === led.card.suit && rank(k) < 11)) return;
  return low(c.following.filter(k => rank(k) > rank(led.card)));
}
function secondHandSplitHonours(c: Context) {
  return low(c.following.filter(k => rank(k) >= 10 && c.following.some(n => rank(n) === rank(k) + 1) && (rank(k) >= 11 || c.following.some(n => rank(n) === 12))));
}
function secondHandLow(c: Context) {
  // second-hand-low: take an ace if an opponent has publicly shown void in this suit (suit contracts).
  const voidLater = c.view.tricks.some(t => t.cards[0].card.suit === c.led!.card.suit
    && t.cards.some(p => sideOf(p.seat) !== sideOf(c.seat) && p.card.suit !== c.led!.card.suit));
  return c.view.contract.strain !== 'no-trumps' && voidLater ? c.following.find(k => k.rank === 'A') ?? low(c.legal) : low(c.legal);
}
function thirdHandWinCheaply(c: Context) { return c.ours ? low(c.legal) : undefined; }
function thirdHandHigh(c: Context) {
  if (c.led?.seat === partner(c.view.contract.declarer) || c.view.currentTrick[1]?.seat === partner(c.view.contract.declarer)) {
    const winner = low(c.legal.filter(k => rank(k) >= 11 && c.winning && c.beats(k, c.winning.card)));
    if (winner) return winner;
  }
  const highest = high(c.legal);
  // third-hand-high: equivalent cards include ranks already played; use the lowest of that class.
  return low(c.legal.filter(k => k.suit === highest.suit && !c.unseen.some(u => u.suit === k.suit && rank(u) > rank(k) && rank(u) < rank(highest))
    && !(c.view.dummy ?? []).some(u => u.suit === k.suit && rank(u) > rank(k) && rank(u) < rank(highest))));
}
function fourthHandWinCheaply(c: Context) {
  return (c.ours ? undefined : low(c.legal.filter(k => c.winning && c.beats(k, c.winning.card)))) ?? low(c.legal);
}
function ruffWhenOpponentWinning(c: Context) {
  return c.ours ? undefined : low(c.legal.filter(k => k.suit === c.view.contract.strain && c.winning && c.beats(k, c.winning.card)));
}
function discardLow(c: Context) {
  const small = groups(c.legal).filter(g => g.every(k => rank(k) < 11) && g[0].suit !== c.view.contract.strain).flat();
  return low(longest(small).flat());
}
function bothVoid(c: Context, suit: Suit) {
  const declarerVoid = c.view.tricks.some(t => t.cards[0].card.suit === suit && t.cards.some(p => p.seat === c.view.contract.declarer && p.card.suit !== suit));
  return declarerVoid && c.view.dummy !== null && !c.view.dummy.some(k => k.suit === suit);
}
function returnPartnersSuit(c: Context) {
  const suit = c.view.tricks.find(t => t.cards[0].seat === partner(c.seat))?.cards[0].card.suit;
  return suit && !bothVoid(c, suit) ? low(suited(c.hand, suit)) : undefined;
}
function leadThroughStrength(c: Context) {
  const safe = c.hand.filter(k => !bothVoid(c, k.suit));
  if (SEATS[(SEATS.indexOf(c.seat) + 1) % 4] !== partner(c.view.contract.declarer))
    return safe.length !== c.hand.length ? low(safe) : undefined;
  // lead-through-strength: weak Dummy means no J or higher; never give a known ruff and discard.
  return low(c.hand.filter(k => !bothVoid(c, k.suit) && !c.view.dummy?.some(d => d.suit === k.suit && rank(d) >= 11)));
}
function needsRuff(c: Context) {
  const trump = c.view.contract.strain, a = suited(c.hand, trump), b = suited(c.other, trump);
  const shorter = a.length < b.length ? c.hand : c.other, longer = a.length < b.length ? c.other : c.hand;
  return suited(shorter, trump).length > 0 && longer.some(k => k.suit !== trump && !c.top(k) && !shorter.some(s => s.suit === k.suit));
}
function declarerDrawTrumps(c: Context) {
  if (c.led || needsRuff(c)) return;
  const outstanding = suited(c.unseen, c.view.contract.strain), trumps = suited(c.hand, c.view.contract.strain);
  // declarer-draw-trumps: outstanding means not in either visible hand or played; don't chase a lone master trump.
  if (!outstanding.length || outstanding.length === 1 && [...trumps, ...suited(c.other, c.view.contract.strain)].every(k => rank(k) < rank(outstanding[0]))) return;
  return high(trumps);
}
function declarerRuffInShortHand(c: Context) {
  const trumps = suited(c.hand, c.view.contract.strain), otherTrumps = suited(c.other, c.view.contract.strain);
  // declarer-ruff-in-short-hand: afford the highest trump; ties in length are not the shorter hand.
  if (c.led && !c.following.length && !c.ours && trumps.length < otherTrumps.length)
    return high(trumps.filter(k => c.winning && c.beats(k, c.winning.card)));
  if (!c.led && needsRuff(c) && trumps.length > otherTrumps.length)
    return low(c.hand.filter(k => k.suit !== c.view.contract.strain && !c.top(k) && !c.other.some(o => o.suit === k.suit)));
}
function declarerEstablishLongSuit(c: Context) {
  if (c.led) return;
  // declarer-establish-long-suit: require a sure side-suit entry and a non-master honour to drive out defenders.
  const combined = [...c.hand, ...c.other].filter(k => k.suit !== c.view.contract.strain);
  return low(longest(combined).flatMap(g => c.hand.filter(k => k.suit === g[0].suit && rank(k) >= 11 && !c.top(k)
    && combined.some(entry => entry.suit !== k.suit && c.top(entry)))));
}
function declarerHighFromShortSide(c: Context) {
  // declarer-high-from-short-side: preserve the longer side's entry; overtake a blocking partner winner only with a master.
  if (c.led) {
    if (c.ours && c.winning?.seat === partner(c.seat) && !c.other.some(k => k.suit === c.led!.card.suit) && c.following.length > 1)
      return low(c.following.filter(k => c.top(k) && c.beats(k, c.winning!.card)));
    return;
  }
  return high(c.hand.filter(k => c.top(k) && suited(c.hand, k.suit).length < suited(c.other, k.suit).length));
}
function declarerFinesse(c: Context) {
  // declarer-finesse: try the Q under a missing K, or K under a missing A, only when no lower rule promises a winner.
  const targets = c.other.filter(k => (k.rank === 'Q' && c.unseen.some(u => u.suit === k.suit && u.rank === 'K'))
    || (k.rank === 'K' && c.unseen.some(u => u.suit === k.suit && u.rank === 'A')));
  if (!c.led) return low(c.hand.filter(k => rank(k) < 11 && targets.some(t => t.suit === k.suit)));
  // Continue only after a low lead towards the honour; an honour lead keeps partner's winner.
  if (c.view.currentTrick.length === 2 && c.led.seat === partner(c.seat) && rank(c.led.card) < 11)
    return low(c.following.filter(k => (k.rank === 'Q' || k.rank === 'K') && c.winning && c.beats(k, c.winning.card)));
}
function declarerCashWinners(c: Context) {
  if (c.led) return;
  return high(c.hand.filter(c.top)) ?? low(longest(c.hand).flat());
}

// DEP-03: exact rule IDs, in document order within each position. Opening guards precede selection;
// void play precedes positional following rules; declarer plans precede generic trick tactics.
const opening: [string, Rule][] = [['lead-sequence', leadSequence], ['lead-long-suit', leadLongSuit], ['lead-not-ace-without-king', leadNotAceWithoutKing], ['lead-short-suit', leadShortSuit]];
const second: [string, Rule][] = [['second-hand-cover-honour', secondHandCoverHonour], ['second-hand-split-honours', secondHandSplitHonours], ['second-hand-low', secondHandLow]];
const third: [string, Rule][] = [['third-hand-win-cheaply', thirdHandWinCheaply], ['third-hand-high', thirdHandHigh]];
const fourth: [string, Rule][] = [['fourth-hand-win-cheaply', fourthHandWinCheaply]];
const voidRules: [string, Rule][] = [['ruff-when-opponent-winning', ruffWhenOpponentWinning], ['discard-low', discardLow]];
const later: [string, Rule][] = [['return-partners-suit', returnPartnersSuit], ['lead-through-strength', leadThroughStrength]];
const declarer: [string, Rule][] = [['declarer-draw-trumps', declarerDrawTrumps], ['declarer-ruff-in-short-hand', declarerRuffInShortHand], ['declarer-establish-long-suit', declarerEstablishLongSuit], ['declarer-high-from-short-side', declarerHighFromShortSide], ['declarer-finesse', declarerFinesse], ['declarer-cash-winners', declarerCashWinners]];
export const PRINCIPLE_RULE_IDS = [...opening, ...second, ...third, ...fourth, ...voidRules, ...later, ...declarer].map(([id]) => id);
export const principlesPolicy: RobotPolicy = {
  name: 'bv-principles', version: '1',
  decide(view, seed, deadline) {
    const c = context(view), position = view.currentTrick.length;
    const tactics = position === 0 ? view.tricks.length ? later : opening : !c.following.length ? voidRules : position === 1 ? second : position === 2 ? third : fourth;
    for (const [ruleId, rule] of [...(c.declaring ? declarer : []), ...tactics]) {
      const card = rule(c);
      if (card && c.legal.some(k => sameCard(k, card))) return { kind: 'play-card', card: { ...card }, ruleId };
    }
    return fallbackRobotPolicy.decide(view, seed, deadline);
  },
};
