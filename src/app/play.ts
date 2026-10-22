import { createHints, hintSeat, type HintSnapshot } from './hints';
import type { HintRunner } from './hintClient';
import { createProvenanceLog, type LogEntry } from '../coach/provenance';
import { APP_VERSION } from './appVersion';
import { basicPolicy, fallbackRobotPolicy, contractChoicePolicy } from '../robots';
import { startMiniBridge, encodeSetupSeatView, sideOf, SEATS, seatViewSeed, type Playthrough, type SetupSeatView, type ContractChoice, type Objective, type Side, type Card, type Deal, type SeatView, type Seat, type PlayedCard, type ReasonCode, type RobotProvenance } from '../table';
import { createRobotHost, type RobotHostOptions } from './robotHost';
import { cardName, reasonStrings, text } from '../explanation';
import { fixedDeal } from './fixture';
import { browserRobotAudit, robotAudit } from './robotAudit';

export type LearnerView = Readonly<Pick<SeatView,
  'positionIndex' | 'hand' | 'dummy' | 'turn' | 'tricksWon' | 'cardCounts' | 'status'> & {
  hint?: HintSnapshot;
  contract: SeatView['contract'] | null;
  setup: SetupSeatView | null;
  objective: Objective | null;
  dummySeat: Seat | null;
  north: readonly Card[] | null;
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

// ADR-0001: setup identity is independent of Deal content.
let nextSetupId = 0;
// US-06: MiniBridge Setup is the entry point for every practice Deal.
export function createPlay(robotOptions: RobotHostOptions = {}, deal: Deal = fixedDeal, targetDeclaringSide: Side = 'northSouth', hintRunner?: HintRunner) {
  const setupId = `setup-${++nextSetupId}`;
  const setup = startMiniBridge({ deal, targetDeclaringSide, learnerSide: 'northSouth',
    versions: { appVersion: APP_VERSION, engineVersions: { [basicPolicy.name]: basicPolicy.version, [fallbackRobotPolicy.name]: fallbackRobotPolicy.version,
      [contractChoicePolicy.name]: contractChoicePolicy.version } } });
  let table: Playthrough | null = null;
  const record = () => { if (!table) throw new Error('setup-in-progress'); return table.record(); };
  const provenanceLog = createProvenanceLog(APP_VERSION);
  let entryId = 0;
  function log(entry: Pick<LogEntry, 'kind' | 'summary' | 'text' | 'provenance' | 'positionIndex' | 'abstention'>) {
    provenanceLog.record({ ...entry, id: `${record().playthroughId}-${++entryId}`, playthroughId: record().playthroughId,
      informationMode: 'VISIBLE', at: new Date().toISOString() });
  }
  const hints = createHints(publish, (entry, positionIndex) => log({ ...entry, positionIndex }), hintRunner);
  let options = robotOptions;
  // US-10.2, §4.3.6, US-40.2: every build that can show the debug panel's hidden-card counter
  // (development, internal, audit) audits robot messages, as test builds do; this guard removes
  // the audit from production builds.
  if (import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'test' || import.meta.env.MODE === 'internal'
    || import.meta.env.MODE === 'development') {
    const hiddenCardFound = () => { provenanceLog.hiddenCardFound(); publish(); };
    const audit = import.meta.env.MODE === 'audit' ? browserRobotAudit(() => table ? record() : setup.record(), hiddenCardFound) : robotAudit(() => table ? record() : setup.record(), hiddenCardFound);
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
    if (!table) {
      const south = setup.seatView('south');
      const view = south.declarer && sideOf(south.declarer) === 'northSouth' && south.dummy ? setup.seatView(south.declarer) : south;
      return { hint: hints.snapshot(), setup: view, objective: null, north: null, contract: null, dummySeat: view.dummySeat, hand: south.hand, dummy: view.dummy,
        positionIndex: 0, turn: null, tricksWon: { northSouth: 0, eastWest: 0 }, cardCounts: { north: 13, east: 13, south: 13, west: 13 },
        status: 'in-progress', legalCards: [], lastTrickWinner: null, displayedTrick, collecting, reason, reasonCode, rejectionId,
        rejectedCard, rejectedSeat, announcements: [...announcements] };
    }
    const history = record();
    const choice = history.setupEvents?.find(event => event.kind === 'contract-choice');
    const contractSeat = history.contract.declarer;
    const viewingSeat = hintSeat(contractSeat);
    const view = table.seatView(viewingSeat);
    const { positionIndex, dummy, contract, turn, tricksWon, cardCounts, status, tricks } = view;
    const hand = contractSeat === 'north' ? dummy! : view.hand;
    return { hint: hints.snapshot(), setup: null, objective: choice?.action.objective ?? null, north: contract.declarer === 'north' ? view.hand : contract.declarer === 'south' ? dummy : null, dummySeat: SEATS[(SEATS.indexOf(contract.declarer) + 2) % 4], positionIndex, hand, dummy, contract, turn, tricksWon, cardCounts, status,
      // ADR-0001: only seats the learner controls expose legal cards to the UI.
      legalCards: turn && table.controllerOf(turn) === 'learner' ? table.legalActions(turn).map(action => action.card) : [],
      lastTrickWinner: tricks.at(-1)?.winner ?? null,
      displayedTrick, collecting, reason, reasonCode, rejectionId, rejectedCard, rejectedSeat, announcements: [...announcements] };
  }
  let snapshot = learnerView();
  function publish() {
    const view = table && running && !collecting ? table.seatView(hintSeat(record().contract.declarer)) : null;
    const candidates = view?.turn && table?.controllerOf(view.turn) === 'learner' ? table.legalActions(view.turn).map(a => a.card) : [];
    hints.sync(view, candidates, table ? { playthroughId: record().playthroughId, positionKey: table.positionKey() } : null);
    snapshot = learnerView(); listeners.forEach(listener => listener()); }
  function schedule() {
    clearTimeout(timer);
    robots.cancel();
    if (!running) return;
    if (!table) {
      const view = setup.seatView('south');
      if (view.step === 'redeal-unavailable') return;
      if (view.step === 'contract-choice') {
        const seat = view.declarer!;
        if (setup.controllerOf(seat) === 'robot') robots.decide({ kind: 'contract', view: setup.seatView(seat), seed: JSON.stringify(encodeSetupSeatView(setup.seatView(seat))),
          playthroughId: setupId, positionKey: setup.positionKey(), currentPositionKey: setup.positionKey,
          submit: (action, provenance) => choose(action, provenance) });
      } else {
        const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches;
        timer = setTimeout(() => { setup.advance(); publish(); schedule(); }, view.step === 'redeal' ? 1500 : reduced ? 0 : 500);
      }
      return;
    }
    if (collecting) {
      timer = setTimeout(() => { collecting = false; displayedTrick = []; publish(); schedule(); }, 1000);
    } else if (snapshot.turn && table.controllerOf(snapshot.turn) === 'robot') {
      // ADR-0003: the Table decides which seats robots control.
      const seat = snapshot.turn;
      const view = table.seatView(seat);
      robots.decide({ view, seed: seatViewSeed(view),
        playthroughId: record().playthroughId, positionKey: table.positionKey(), currentPositionKey: table.positionKey,
        submit: (action, provenance) => accept(seat, action.card, 'robot', provenance) });
    }
  }
  function accept(seat: 'north' | 'south' | 'east' | 'west', card: Card, controller: 'learner' | 'robot', provenance?: RobotProvenance) {
    if (!table) return false;
    // US-40.1: provenance refers to the position where the action was decided.
    const positionIndex = table.seatView(seat).positionIndex;
    const result = table.submit(seat, controller, { kind: 'play-card', card }, provenance);
    // US-11.1: a rejected robot action goes back to the host, which falls back; it is never learner feedback.
    if (result.kind === 'rejected' && controller === 'robot') return false;
    if (controller === 'learner') clearRejection();
    if (result.kind === 'rejected') {
      rejectionId++;
      reasonCode = result.reason; rejectedCard = card; rejectedSeat = seat;
      reason = text(reasonStrings[result.reason], result.details.suit ? { suit: text(`suit.${result.details.suit}`) } : {});
      log({ positionIndex, kind: 'statement', summary: result.reason, text: reason, provenance: { sourceKind: 'template', templateId: reasonStrings[result.reason] } });
    } else {
      if (controller === 'robot' && provenance) log({ positionIndex, kind: 'robot-action', summary: JSON.stringify({ seat, action: { kind: 'play-card', card } }),
        provenance: { sourceKind: 'robot', kind: 'robot', policy: provenance.policy, version: provenance.version,
          durationMs: provenance.durationMs, ...(provenance.fallback ? { fallback: provenance.fallback } : {}) } });
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
  function choose(action: ContractChoice, provenance?: RobotProvenance): boolean {
    const seat = setup.seatView('south').declarer;
    if (!seat || table) return false;
    const result = setup.submit(seat, provenance ? 'robot' : 'learner', action, provenance);
    if (result.kind === 'rejected') return false;
    table = setup.playthrough();
    if (provenance) log({ positionIndex: 0, kind: 'robot-action', summary: JSON.stringify({ seat, action }),
      provenance: { sourceKind: 'robot', ...provenance } });
    publish(); schedule(); return true;
  }
  return {
    record,
    setupRecord: setup.record,
    chooseContract: (action: ContractChoice) => choose(action),
    provenanceLog,
    hintTimings: hints.timings,
    toggleHints: () => hints.toggle(),
    showHint: () => hints.show(),
    dismissHint: () => hints.dismiss(),
    seatView: (seat: Seat) => table ? table.seatView(seat) : setup.seatView(seat),
    completedRecord: () => { if (!table) throw new Error('setup-in-progress'); return table.completedRecord(); },
    getSnapshot: () => snapshot,
    clearRejection() { clearRejection(); publish(); },
    showRule() {
      if (!reasonCode || !table) return;
      const templateId = `rule.${reasonCode}` as const;
      log({ positionIndex: table.seatView('south').positionIndex, kind: 'statement', summary: reasonCode, text: text(templateId), provenance: { sourceKind: 'template', templateId } });
      publish();
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { running = true; publish(); schedule(); return () => { running = false; clearTimeout(timer); robots.stop(); hints.stop(); }; },
    play(seat: 'north' | 'south', card: Card) { if (!collecting) accept(seat, card, 'learner'); },
  };
}
