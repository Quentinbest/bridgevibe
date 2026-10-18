import { startPlaythrough, type Card, type SeatView, type Seat, type PlayedCard } from '../table';
import { fallbackPolicy } from '../robots';
import { cardName, reasonStrings, text } from '../explanation';
import { fixedDeal } from './fixture';

export type LearnerView = Readonly<Pick<SeatView,
  'positionIndex' | 'hand' | 'dummy' | 'contract' | 'turn' | 'tricksWon' | 'cardCounts' | 'status'> & {
  legalCards: readonly Card[];
  displayedTrick: readonly PlayedCard[];
  collecting: boolean;
  lastTrickWinner: Seat | null;
  reason: string;
  announcements: readonly string[];
}>;

export function createPlay() {
  const table = startPlaythrough({ deal: fixedDeal, contract: { level: 3, strain: 'no-trumps', declarer: 'south' } });
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let collecting = false;
  let displayedTrick: readonly PlayedCard[] = [];
  let reason = '';
  const announcements: string[] = [];
  function learnerView(): LearnerView {
    // ADR-0001, US-16.4: UI data comes exclusively from Declarer's Seat View.
    const { positionIndex, hand, dummy, contract, turn, tricksWon, cardCounts, status, tricks } = table.seatView('south');
    return { positionIndex, hand, dummy, contract, turn, tricksWon, cardCounts, status,
      legalCards: turn === 'south' || turn === 'north' ? table.legalActions(turn).map(action => action.card) : [],
      lastTrickWinner: tricks.at(-1)?.winner ?? null,
      displayedTrick, collecting, reason, announcements: [...announcements] };
  }
  let snapshot = learnerView();
  function publish() { snapshot = learnerView(); listeners.forEach(listener => listener()); }
  function schedule() {
    clearTimeout(timer);
    if (!running) return;
    if (collecting) {
      timer = setTimeout(() => { collecting = false; displayedTrick = []; publish(); schedule(); }, 1000);
    } else if (snapshot.turn === 'east' || snapshot.turn === 'west') {
      timer = setTimeout(() => {
        const seat = snapshot.turn;
        if (seat === 'east' || seat === 'west') accept(seat, fallbackPolicy(table.seatView(seat)), 'robot');
      }, 500);
    }
  }
  function accept(seat: 'north' | 'south' | 'east' | 'west', card: Card, controller: 'learner' | 'robot') {
    const result = table.submit(seat, controller, { kind: 'play-card', card });
    reason = '';
    if (result.kind === 'rejected') {
      reason = text(reasonStrings[result.reason], result.details.suit ? { suit: text(`suit.${result.details.suit}`) } : {});
    } else {
      for (const event of result.events) {
        if (event.kind === 'card-played') announcements.push(text('announce.play', { seat: text(`seat.${event.seat}`), card: cardName(event.card) }));
        if (event.kind === 'trick-won') announcements.push(text('announce.winner', { seat: text(`seat.${event.winner}`) }));
      }
      const view = table.seatView('south');
      collecting = result.events.some(event => event.kind === 'trick-won');
      displayedTrick = collecting ? view.tricks[view.tricks.length - 1].cards : view.currentTrick;
    }
    publish(); schedule();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { running = true; schedule(); return () => { running = false; clearTimeout(timer); }; },
    play(seat: 'north' | 'south', card: Card) { if (!collecting) accept(seat, card, 'learner'); },
  };
}
