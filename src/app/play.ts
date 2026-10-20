import { startPlaythrough, type Card, type SeatView, type Seat, type PlayedCard, type ReasonCode } from '../table';
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
  reasonCode: ReasonCode | null;
  rejectionId: number;
  rejectedCard: Card | null;
  rejectedSeat: Seat | null;
  announcements: readonly string[];
}>;

export function createPlay() {
  const table = startPlaythrough({ deal: fixedDeal, contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let collecting = false;
  let displayedTrick: readonly PlayedCard[] = [];
  let reason = '';
  let rejectionId = 0;
  let reasonCode: ReasonCode | null = null;
  let rejectedCard: Card | null = null;
  let rejectedSeat: Seat | null = null;
  function clearRejection() { reason = ''; reasonCode = null; rejectedCard = null; rejectedSeat = null; }
  const announcements: string[] = [];
  function learnerView(): LearnerView {
    // ADR-0001, US-16.4: UI data comes exclusively from Declarer's Seat View.
    const { positionIndex, hand, dummy, contract, turn, tricksWon, cardCounts, status, tricks } = table.seatView('south');
    return { positionIndex, hand, dummy, contract, turn, tricksWon, cardCounts, status,
      legalCards: turn === 'south' || turn === 'north' ? table.legalActions(turn).map(action => action.card) : [],
      lastTrickWinner: tricks.at(-1)?.winner ?? null,
      displayedTrick, collecting, reason, reasonCode, rejectionId, rejectedCard, rejectedSeat, announcements: [...announcements] };
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
    if (controller === 'learner') clearRejection();
    if (result.kind === 'rejected') {
      rejectionId++;
      reasonCode = result.reason; rejectedCard = card; rejectedSeat = seat;
      reason = text(reasonStrings[result.reason], result.details.suit ? { suit: text(`suit.${result.details.suit}`) } : {});
    } else {
      for (const event of result.events) {
        if (event.kind === 'card-played') announcements.push(text('announce.play', { seat: text(`seat.${event.seat}`), card: cardName(event.card) }));
        // The winner is announced once, by the turn banner's live region during collection (UX §10).
      }
      const view = table.seatView('south');
      collecting = result.events.some(event => event.kind === 'trick-won');
      displayedTrick = collecting ? view.tricks[view.tricks.length - 1].cards : view.currentTrick;
    }
    publish(); schedule();
  }
  return {
    getSnapshot: () => snapshot,
    clearRejection() { clearRejection(); publish(); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { running = true; schedule(); return () => { running = false; clearTimeout(timer); }; },
    play(seat: 'north' | 'south', card: Card) { if (!collecting) accept(seat, card, 'learner'); },
  };
}
