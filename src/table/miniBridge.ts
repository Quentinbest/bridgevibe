import { SEATS, SUITS, redeal, type Card, type Deal, type Seat } from './index';
import { startPlaythrough, sideOf, validProvenance, type ActionProvenance, type Contract, type Controller, type Submission } from './playthrough';
import { decodeSetupSeatView } from './seatViewMessage';
import { OBJECTIVES, trickTarget, type Objective } from './miniBridgeRules';

export type Announcement = Readonly<{ seat: Seat; hcp: number }>;
export type ContractChoice = Readonly<{ kind: 'choose-contract'; strain: Contract['strain']; objective: Objective }>;
export type SetupEvent = Readonly<({ kind: 'announcement' } & Announcement)
  | { kind: 'redeal'; from: Deal; to: Deal }
  | { kind: 'declarer'; seat: Seat; tied: boolean }
  | { kind: 'dummy-exposed'; seat: Seat }
  | { kind: 'contract-choice'; seat: Seat; controller: Controller; action: ContractChoice; provenance: ActionProvenance }>;
export type SetupStep = 'announcements' | 'redeal' | 'declarer' | 'dummy' | 'contract-choice' | 'complete';
export const highCardPoints = (hand: readonly Card[]): number => hand.reduce((sum, card) => sum + (card.rank === 'A' ? 4 : card.rank === 'K' ? 3 : card.rank === 'Q' ? 2 : card.rank === 'J' ? 1 : 0), 0);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const partner = (seat: Seat): Seat => SEATS[(SEATS.indexOf(seat) + 2) % 4];
// US-06: setup produces a Contract; card play remains format-independent.
export function startMiniBridge(input: Omit<Parameters<typeof startPlaythrough>[0], 'contract' | 'setupEvents' | 'gameFormat'>) {
  let deal = copy(input.deal);
  let step: SetupStep = 'announcements';
  let announcements: Announcement[] = [];
  let declarer: Seat | null = null;
  let tied = false;
  let exposed = false;
  const events: SetupEvent[] = [];
  let playthrough: ReturnType<typeof startPlaythrough> | null = null;
  if (input.learnerSide !== 'northSouth') throw new Error('The learner sits South');
  function advance() {
    if (step === 'announcements') {
      const seat = SEATS[(SEATS.indexOf(deal.dealer) + announcements.length) % 4];
      const announcement = { seat, hcp: highCardPoints(deal.hands[seat]) };
      announcements.push(announcement); events.push({ kind: 'announcement', ...announcement });
      if (announcements.length === 4) {
        const ns = announcements.filter(a => sideOf(a.seat) === 'northSouth').reduce((n, a) => n + a.hcp, 0);
        if (ns === 20) {
          if (deal.origin.kind === 'authored') throw new Error('Authored MiniBridge Deal cannot be redealt');
          step = 'redeal';
        } else {
          const candidates = announcements.filter(a => sideOf(a.seat) === (ns > 20 ? 'northSouth' : 'eastWest'));
          tied = candidates[0].hcp === candidates[1].hcp;
          declarer = candidates[1].hcp > candidates[0].hcp ? candidates[1].seat : candidates[0].seat;
          events.push({ kind: 'declarer', seat: declarer, tied }); step = 'declarer';
        }
      }
    } else if (step === 'redeal') {
      const next = redeal(deal);
      events.push({ kind: 'redeal', from: deal, to: next });
      deal = next; announcements = []; step = 'announcements';
    } else if (step === 'declarer') {
      exposed = true; events.push({ kind: 'dummy-exposed', seat: partner(declarer!) }); step = 'dummy';
    } else if (step === 'dummy') step = 'contract-choice';
  }
  const controllerOf = (seat: Seat): Controller => seat === 'south' || declarer === seat && sideOf(seat) === input.learnerSide ? 'learner' : 'robot';
  function seatView(seat: Seat) {
    return decodeSetupSeatView({ seat, hand: deal.hands[seat], dummy: exposed ? deal.hands[partner(declarer!)] : null,
      dummySeat: exposed ? partner(declarer!) : null, announcements, declarer, tied, step });
  }
  function submit(seat: unknown, controller: unknown, action: unknown, provenance?: ActionProvenance): Submission {
    const reject = (reason: 'wrong-phase' | 'not-declarer' | 'invalid-contract-choice' | 'malformed-action'): Submission => ({ kind: 'rejected', reason, details: {} });
    // US-01.5: a Contract Choice before dummy is exposed, or a card play during setup, is in the wrong phase.
    if (step !== 'contract-choice' || (!!action && typeof action === 'object' && 'kind' in action && action.kind === 'play-card')) return reject('wrong-phase');
    if (seat !== declarer || controller !== controllerOf(declarer!)) return reject('not-declarer');
    if (!action || typeof action !== 'object' || !('kind' in action) || action.kind !== 'choose-contract'
      || !('strain' in action) || ![...SUITS, 'no-trumps'].includes(action.strain as Contract['strain'])
      || !('objective' in action) || !OBJECTIVES.includes(action.objective as Objective)
      || Object.keys(action).some(key => !['kind', 'strain', 'objective'].includes(key))) return reject('invalid-contract-choice');
    const choice = copy(action as ContractChoice);
    const contract = { level: trickTarget(choice.strain, choice.objective) - 6, strain: choice.strain, declarer: declarer! };
    if (!validProvenance(controller as Controller, provenance) || provenance?.kind === 'authored' || provenance?.kind === 'imported') return reject('malformed-action');
    events.push({ kind: 'contract-choice', seat: declarer!, controller: controller as Controller, action: choice, provenance: copy(provenance ?? { kind: 'learner' }) });
    playthrough = startPlaythrough({ ...input, deal, contract, gameFormat: 'minibridge', setupEvents: events });
    step = 'complete';
    return { kind: 'accepted', events: [] };
  }
  return { advance, submit, seatView, controllerOf, playthrough: () => playthrough,
    record: () => copy({ gameFormat: 'minibridge' as const, deal, setupEvents: events }),
    positionKey: () => JSON.stringify([deal.dealId, step, events.length]) };
}
