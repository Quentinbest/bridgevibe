import { createProvenanceLog, type LogEntry } from '../coach/provenance';
import { startPlaythrough, seatViewSeed, type Card, type Deal, type SeatView, type Seat, type PlayedCard, type ReasonCode, type RobotProvenance } from '../table';
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
  reasonCode: ReasonCode | null;
  rejectionId: number;
  rejectedCard: Card | null;
  rejectedSeat: Seat | null;
  announcements: readonly string[];
}>;

// The learner declares 3NT from South until the table turns for other declarers (#16, ADR-0003).
export function createPlay(robotOptions: RobotHostOptions = {}, deal: Deal = fixedDeal) {
  const table = startPlaythrough({ deal, contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
  const provenanceLog = createProvenanceLog('0.0.0');
  let entryId = 0;
  function log(entry: Pick<LogEntry, 'kind' | 'summary' | 'text' | 'provenance'>) {
    provenanceLog.record({ ...entry, id: `${table.record().playthroughId}-${++entryId}`, playthroughId: table.record().playthroughId,
      positionIndex: table.seatView('south').positionIndex, informationMode: 'VISIBLE', at: new Date().toISOString() });
  }
  let options = robotOptions;
  // US-10.2, §4.3.6, US-40.2: every build that can show the debug panel's hidden-card counter
  // (development, internal, audit) audits robot messages, as test builds do; this guard removes
  // the audit from production builds.
  if (import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'test' || import.meta.env.MODE === 'internal'
    || import.meta.env.MODE === 'development') {
    const hiddenCardFound = () => { provenanceLog.hiddenCardFound(); publish(); };
    const audit = import.meta.env.MODE === 'audit' ? browserRobotAudit(table.record().deal, table.record, hiddenCardFound) : robotAudit(table.record().deal, table.record, hiddenCardFound);
    options = { ...robotOptions, audit(message, seat) { audit(message, seat); robotOptions.audit?.(message, seat); } };
  }
  const robots = createRobotHost(options);
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
      // ADR-0001: only seats the learner controls expose legal cards to the UI.
      legalCards: turn && table.controllerOf(turn) === 'learner' ? table.legalActions(turn).map(action => action.card) : [],
      lastTrickWinner: tricks.at(-1)?.winner ?? null,
      displayedTrick, collecting, reason, reasonCode, rejectionId, rejectedCard, rejectedSeat, announcements: [...announcements] };
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
    // US-11.1: a rejected robot action goes back to the host, which falls back; it is never learner feedback.
    if (result.kind === 'rejected' && controller === 'robot') return false;
    if (controller === 'learner') clearRejection();
    if (result.kind === 'rejected') {
      rejectionId++;
      reasonCode = result.reason; rejectedCard = card; rejectedSeat = seat;
      reason = text(reasonStrings[result.reason], result.details.suit ? { suit: text(`suit.${result.details.suit}`) } : {});
      log({ kind: 'statement', summary: result.reason, text: reason, provenance: { sourceKind: 'template', templateId: reasonStrings[result.reason] } });
    } else {
      if (controller === 'robot' && provenance) log({ kind: 'robot-action', summary: JSON.stringify({ seat, action: { kind: 'play-card', card } }),
        provenance: { sourceKind: 'robot', ...provenance } });
      for (const event of result.events) {
        if (event.kind === 'card-played') announcements.push(text('announce.play', { seat: text(`seat.${event.seat}`), card: cardName(event.card) }));
        // The winner is announced once, by the turn banner's live region during collection (UX §10).
      }
      const view = table.seatView('south');
      collecting = result.events.some(event => event.kind === 'trick-won');
      displayedTrick = collecting ? view.tricks[view.tricks.length - 1].cards : view.currentTrick;
    }
    publish(); schedule();
    return true;
  }
  return {
    record: table.record,
    provenanceLog,
    seatView: table.seatView,
    getSnapshot: () => snapshot,
    clearRejection() { clearRejection(); publish(); },
    showRule() {
      if (!reasonCode) return;
      const templateId = `rule.${reasonCode}` as const;
      log({ kind: 'statement', summary: reasonCode, text: text(templateId), provenance: { sourceKind: 'template', templateId } });
      publish();
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { running = true; schedule(); return () => { running = false; clearTimeout(timer); robots.stop(); }; },
    play(seat: 'north' | 'south', card: Card) { if (!collecting) accept(seat, card, 'learner'); },
  };
}
