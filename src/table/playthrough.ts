import { RANKS, SEATS, SUITS, type Card, type Deal, type Seat, type Side, type Suit } from './index';

import { decodeSeatView, type SeatView } from './seatViewMessage';
import type { SetupEvent } from './miniBridge';
import { positionDigest } from './positionKey';

export type RobotProvenance = Readonly<{ kind: 'robot'; policy: string; version: string; ruleId?: string; fallback?: 'timeout' | 'engine-failure'; durationMs: number }>;
// US-04.3: a play read from a PBN file has no robot or learner provenance; say so instead of inventing one.
export type ImportedProvenance = Readonly<{ kind: 'imported'; format: 'pbn' }>;
export type AuthoredProvenance = Readonly<{ kind: 'authored'; contentId: string; version: number }>;
export type ActionProvenance = AuthoredProvenance | RobotProvenance | Readonly<{ kind: 'learner' }> | ImportedProvenance;
export type Contract = Readonly<{ level: number; strain: Suit | 'no-trumps'; declarer: Seat }>;
export type Controller = 'learner' | 'robot';
export type Action = Readonly<{ kind: 'play-card'; card: Card }>;
export type Status = 'in-progress' | 'completed';
export const REASON_CODES = ['playthrough-complete', 'malformed-action', 'not-your-turn', 'only-declarer-plays-dummy', 'card-not-held', 'must-follow-suit', 'not-declarer', 'invalid-contract-choice', 'wrong-phase'] as const;
export type ReasonCode = typeof REASON_CODES[number];
export type PlayedCard = Readonly<{ seat: Seat; card: Card }>;
export type Trick = Readonly<{ cards: readonly PlayedCard[]; winner: Seat }>;
export type { SeatView } from './seatViewMessage';
export type PlaythroughRecord = Readonly<{
  schemaVersion: 2;
  gameFormat?: 'contract-bridge' | 'minibridge';
  setupEvents?: readonly SetupEvent[];
  appVersion: string;
  engineVersions: Readonly<Record<string, string>>;
  rulesCoreVersion: string;
  playthroughId: string;
  deal: Deal;
  contract: Contract;
  learnerSide: Side;
  actions: readonly Readonly<{ index: number; seat: Seat; controller: Controller; action: Action; provenance: ActionProvenance }>[];
  status: Status;
  result: Readonly<Record<Side, number>>;
}>;
// §4.3.5: only Table can construct the completion capability.
const completedRecordBrand: unique symbol = Symbol('CompletedPlaythroughRecord');
export type CompletedPlaythroughRecord = PlaythroughRecord & { readonly status: 'completed'; readonly [completedRecordBrand]: true };
export const RULES_CORE_VERSION = '1';
export function completedRecord(record: PlaythroughRecord): CompletedPlaythroughRecord {
  if (record.status !== 'completed') throw new Error('Review requires a completed Playthrough Record');
  return { ...JSON.parse(JSON.stringify(record)), [completedRecordBrand]: true };
}
export type TableEvent = Readonly<{ kind: 'card-played'; seat: Seat; card: Card }>
  | Readonly<{ kind: 'trick-won'; winner: Seat }>
  | Readonly<{ kind: 'status-changed'; status: 'completed' }>;
export type Submission = { kind: 'accepted'; events: readonly TableEvent[] }
  | { kind: 'rejected'; reason: ReasonCode; details: Readonly<{ cause?: 'controller' | 'duplicate'; suit?: Suit }> };
export const sideOf = (seat: Seat): Side => seat === 'north' || seat === 'south' ? 'northSouth' : 'eastWest';
export const sameCard = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank;
const nextSeat = (seat: Seat): Seat => SEATS[(SEATS.indexOf(seat) + 1) % 4];
const copyCard = (card: Card): Card => ({ suit: card.suit, rank: card.rank });
const copyPlay = (play: PlayedCard): PlayedCard => ({ seat: play.seat, card: copyCard(play.card) });
function isAction(value: unknown): value is Action {
  if (!value || typeof value !== 'object' || !('kind' in value) || value.kind !== 'play-card' || !('card' in value)) return false;
  const card = value.card;
  return !!card && typeof card === 'object' && 'suit' in card && 'rank' in card
    && SUITS.some(suit => suit === card.suit) && RANKS.some(rank => rank === card.rank);
}
// CI-5: shared by card plays and Contract Choices.
export function validProvenance(controller: Controller, provenance?: ActionProvenance): boolean {
  if ((controller === 'robot' && !provenance) || (provenance && provenance.kind !== controller && provenance.kind !== 'imported' && provenance.kind !== 'authored')) return false;
  // US-04.1, CI-5: authored Script actions belong only to robot-controlled seats.
  if (provenance?.kind === 'authored' && (controller !== 'robot'
    || typeof provenance.contentId !== 'string' || !provenance.contentId.trim()
    || !Number.isSafeInteger(provenance.version) || provenance.version < 1
    || Reflect.ownKeys(provenance).some(key => key !== 'kind' && key !== 'contentId' && key !== 'version'))) return false;
  if (provenance?.kind === 'imported' && (provenance.format !== 'pbn'
    || Reflect.ownKeys(provenance).some(key => key !== 'kind' && key !== 'format'))) return false;
  // US-01.6, CI-5: unknown fields must not escape into downstream provenance records.
  if (provenance?.kind === 'robot' && Reflect.ownKeys(provenance).some(key =>
    !['kind', 'policy', 'version', 'ruleId', 'fallback', 'durationMs'].includes(key as string))) return false;
  if (provenance?.kind === 'robot' && (typeof provenance.policy !== 'string' || !provenance.policy.trim()
    || typeof provenance.version !== 'string' || !provenance.version.trim()
    || (provenance.ruleId !== undefined && (typeof provenance.ruleId !== 'string' || !provenance.ruleId.trim()))
    || !Number.isFinite(provenance.durationMs) || provenance.durationMs < 0
    || (provenance.fallback !== undefined && provenance.fallback !== 'timeout' && provenance.fallback !== 'engine-failure'))) return false;
  return true;
}
let nextId = 0;
export function startPlaythrough(input: { deal: Deal; contract: Contract; learnerSide: Side; gameFormat?: 'contract-bridge' | 'minibridge'; setupEvents?: readonly SetupEvent[]; versions?: { appVersion: string; engineVersions: Readonly<Record<string, string>> } }) {
  // INV-2: take ownership of the input; no returned object aliases mutable Table state.
  const deal: Deal = JSON.parse(JSON.stringify(input.deal));
  const contract = { ...input.contract };
  const gameFormat = input.gameFormat ?? 'contract-bridge';
  const setupEvents: readonly SetupEvent[] = JSON.parse(JSON.stringify(input.setupEvents ?? []));
  const appVersion = input.versions?.appVersion ?? 'unknown';
  const engineVersions = { ...input.versions?.engineVersions };
  const playthroughId = `playthrough-${++nextId}`;
  const hands = { north: [...deal.hands.north], east: [...deal.hands.east], south: [...deal.hands.south], west: [...deal.hands.west] };
  const dummySeat = nextSeat(nextSeat(contract.declarer));
  // US-02.1: the learner sits South, so their side is North–South.
  if (input.learnerSide !== 'northSouth') throw new Error('The learner sits South: learnerSide must be northSouth');
  const learnerSide = input.learnerSide;
  // ADR-0003: when the learner's side declares, the learner controls Declarer and Dummy; in defence,
  // only South. Robots control every other Seat, and Dummy always follows Declarer's controller.
  const learnerSeats: readonly Seat[] = sideOf(contract.declarer) === learnerSide ? [contract.declarer, dummySeat] : ['south'];
  const controllerOf = (seat: Seat): Controller => (learnerSeats.includes(seat) ? 'learner' : 'robot');
  let turn: Seat | null = nextSeat(contract.declarer);
  let status: Status = 'in-progress';
  let currentTrick: PlayedCard[] = [];
  const tricks: Trick[] = [];
  const actions: Array<PlaythroughRecord['actions'][number]> = [];
  const tricksWon = { northSouth: 0, eastWest: 0 };
  function legalActions(seat: Seat): Action[] {
    if (seat !== turn || status === 'completed') return [];
    const led = currentTrick[0]?.card.suit;
    const following = hands[seat].filter(card => card.suit === led);
    return (following.length ? following : hands[seat]).map(card => ({ kind: 'play-card', card: copyCard(card) }));
  }
  function seatView(seat: Seat): SeatView {
    return decodeSeatView({
      seat, positionIndex: actions.length,
      hand: hands[seat].map(copyCard), dummy: actions.length || gameFormat === 'minibridge' ? hands[dummySeat].map(copyCard) : null,
      contract: { ...contract }, tricks: tricks.map(trick => ({ cards: trick.cards.map(copyPlay), winner: trick.winner })),
      currentTrick: currentTrick.map(copyPlay), turn, tricksWon: { ...tricksWon },
      cardCounts: { north: hands.north.length, east: hands.east.length, south: hands.south.length, west: hands.west.length }, status,
    });
  }
  function record(): PlaythroughRecord {
    return JSON.parse(JSON.stringify({ schemaVersion: 2, appVersion, engineVersions, rulesCoreVersion: RULES_CORE_VERSION, playthroughId, deal, contract, learnerSide, gameFormat, setupEvents, actions, status, result: tricksWon }));
  }
  function submit(seat: unknown, controller: unknown, action: unknown, provenance?: ActionProvenance): Submission {
    const reject = (reason: ReasonCode, details: { cause?: 'controller' | 'duplicate'; suit?: Suit } = {}): Submission => ({ kind: 'rejected', reason, details });
    // US-01.6: validate everything before mutating any state, in reason-code precedence order.
    if (status === 'completed') return reject('playthrough-complete');
    if (!SEATS.some(candidate => candidate === seat) || (controller !== 'learner' && controller !== 'robot') || !isAction(action)) return reject('malformed-action');
    // US-01.6, CI-5: controller and complete provenance must agree before any mutation.
    if (provenance?.kind === 'authored' && controllerOf(seat as Seat) !== 'robot') return reject('malformed-action');
    if (!validProvenance(controller, provenance)) return reject('malformed-action');
    // US-01.5: a card that has already been played is duplicate-card input, not merely a card not held.
    if (actions.some(entry => sameCard(entry.action.card, action.card))) return reject('malformed-action', { cause: 'duplicate' });
    const actingSeat = seat as Seat;
    if (actingSeat !== dummySeat && controller !== controllerOf(actingSeat)) return reject('malformed-action', { cause: 'controller' });
    if (actingSeat !== turn) return reject('not-your-turn');
    // ADR-0003: Dummy belongs to Declarer's controller, never an independent robot.
    if (actingSeat === dummySeat && controller !== controllerOf(contract.declarer)) return reject('only-declarer-plays-dummy');
    const index = hands[actingSeat].findIndex(card => sameCard(card, action.card));
    if (index < 0) return reject('card-not-held');
    const led = currentTrick[0]?.card.suit;
    if (led && action.card.suit !== led && hands[actingSeat].some(card => card.suit === led)) return reject('must-follow-suit', { suit: led });
    const card = copyCard(action.card);
    hands[actingSeat].splice(index, 1);
    // US-04.1: every accepted learner action records its provenance even when the caller omits it.
    const recorded: ActionProvenance = provenance ?? { kind: 'learner' };
    actions.push({ index: actions.length, seat: actingSeat, controller, action: { kind: 'play-card', card }, provenance: { ...recorded } });
    currentTrick.push({ seat: actingSeat, card });
    const events: TableEvent[] = [{ kind: 'card-played', seat: actingSeat, card: copyCard(card) }];
    turn = nextSeat(actingSeat);
    if (currentTrick.length === 4) {
      // US-01.7: only trumps or cards in the led suit can overtake the current winner.
      const winningPlay = currentTrick.reduce((winner, play) => {
        if (play.card.suit === winner.card.suit) return RANKS.indexOf(play.card.rank) < RANKS.indexOf(winner.card.rank) ? play : winner;
        return play.card.suit === contract.strain ? play : winner;
      });
      tricks.push({ cards: currentTrick, winner: winningPlay.seat });
      currentTrick = [];
      tricksWon[sideOf(winningPlay.seat)]++;
      turn = winningPlay.seat;
      events.push({ kind: 'trick-won', winner: winningPlay.seat });
      if (tricks.length === 13) {
        status = 'completed'; turn = null;
        events.push({ kind: 'status-changed', status });
      }
    }
    return { kind: 'accepted', events };
  }
  const positionKey = () => positionDigest({ deal, contract, actions: actions.map(({ seat, action }) => ({ seat, action })) });
  return { legalActions, seatView, record, completedRecord: () => completedRecord(record()), submit, controllerOf, positionKey };
}
export type Playthrough = ReturnType<typeof startPlaythrough>;
