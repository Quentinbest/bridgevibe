import { startPlaythrough, seatViewSeed, type Card, type Deal, type SeatView, type Seat, type PlayedCard, type RobotProvenance } from '../table';
import { createRobotHost, type RobotHostOptions } from './robotHost';
import { cardName, reasonStrings, text } from '../explanation';
import { fixedDeal } from './fixture';
import { browserRobotAudit, robotAudit } from './robotAudit';

export type LearnerView = Readonly<Pick<SeatView,
  'positionIndex' | 'hand' | 'dummy' | 'contract' | 'turn' | 'tricksWon' | 'cardCounts' | 'status'> & {
  legalCards: readonly Card[];
  displayedTrick: readonly PlayedCard[];
  collecting: boolean;
  lastTrickWinner: Seat | null;
  reason: string;
  announcements: readonly string[];
}>;

// The learner declares 3NT from South until the table turns for other declarers (#16, ADR-0003).
export function createPlay(robotOptions: RobotHostOptions = {}, deal: Deal = fixedDeal) {
  const table = startPlaythrough({ deal, contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
  let options = robotOptions;
  // US-10.2, §4.3.6: audit and test builds audit every robot message; this constant guard
  // removes the audit from production builds.
  if (import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'test') {
    const audit = import.meta.env.MODE === 'audit' ? browserRobotAudit(table.record().deal, table.record) : robotAudit(table.record().deal, table.record);
    options = { ...robotOptions, audit(message, seat) { audit(message, seat); robotOptions.audit?.(message, seat); } };
  }
  const robots = createRobotHost(options);
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
      // ADR-0001: only seats the learner controls expose legal cards to the UI.
      legalCards: turn && table.controllerOf(turn) === 'learner' ? table.legalActions(turn).map(action => action.card) : [],
      lastTrickWinner: tricks.at(-1)?.winner ?? null,
      displayedTrick, collecting, reason, announcements: [...announcements] };
  }
  let snapshot = learnerView();
  function publish() { snapshot = learnerView(); listeners.forEach(listener => listener()); }
  function schedule() {
    clearTimeout(timer);
    robots.cancel();
    if (!running) return;
    if (collecting) {
      timer = setTimeout(() => { collecting = false; displayedTrick = []; publish(); schedule(); }, 1000);
    } else if (snapshot.turn && table.controllerOf(snapshot.turn) === 'robot') {
      // ADR-0003: the Table decides which seats robots control.
      const seat = snapshot.turn;
      const view = table.seatView(seat);
      robots.decide({ view, seed: seatViewSeed(view),
        playthroughId: table.record().playthroughId, positionKey: table.positionKey(), currentPositionKey: table.positionKey,
        submit: (action, provenance) => accept(seat, action.card, 'robot', provenance) });
    }
  }
  function accept(seat: 'north' | 'south' | 'east' | 'west', card: Card, controller: 'learner' | 'robot', provenance?: RobotProvenance) {
    const result = table.submit(seat, controller, { kind: 'play-card', card }, provenance);
    reason = '';
    if (result.kind === 'rejected') {
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
    record: table.record,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { running = true; schedule(); return () => { running = false; clearTimeout(timer); robots.stop(); }; },
    play(seat: 'north' | 'south', card: Card) { if (!collecting) accept(seat, card, 'learner'); },
  };
}
