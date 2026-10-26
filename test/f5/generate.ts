import assert from 'node:assert/strict';
import { bridgeDdsAdapter } from '../../src/analysis/bridgeDdsAdapter';
import { positionAt } from '../../src/analysis';
import { handleHintRequest } from '../../src/app/hintWorker';
import { createHints, hintSeat } from '../../src/app/hints';
import { faultHintRunner } from '../../src/app/hintFaults';
import type { HintRunner } from '../../src/app/hintClient';
import { APP_VERSION } from '../../src/app/appVersion';
import { runReviewSampling } from '../../src/app/reviewSampling';
import { assessDecisions } from '../../src/coach/decisionAssessment';
import { momentLogEntries } from '../../src/coach/momentStatement';
import { qualityTemplate, sampledQualityEntry, samplingPositions } from '../../src/coach/sampledQuality';
import { createProvenanceLog, validateEntry, type LogEntry } from '../../src/coach/provenance';
import { teacherLabels } from '../../src/coach/teacherLabels';
import { trickCosts, type TrickCost } from '../../src/coach/trickCost';
import { cardName, text } from '../../src/explanation';
import { dealFromSeed, startMiniBridge, encodeSeatView, seatViewSeed, startPlaythrough, type Card, type CompletedPlaythroughRecord, type SeatView } from '../../src/table';
import { f4Position, finish, points } from '../f4/records';
import { sampledPractice } from '../sampledPractice';

export const card = (c: Card) => `${text(`symbol.${c.suit}`)}${c.rank}`;
const cards = (cs: readonly Card[]) => cs.map(card).join(' ') || 'none';
// ADR-0001: this formatter accepts only the Table's Seat View, never a Deal or Layout.
export function visibleContext(view: SeatView) {
  const plays = (ps: SeatView['currentTrick']) => ps.map(p => `${p.seat} ${card(p.card)}`).join(', ') || 'none';
  return [`Contract: ${view.contract.level} ${view.contract.strain}, declarer ${view.contract.declarer}`,
    `Learner's seat: ${view.seat}; acting seat: ${view.turn ?? 'none'}`,
    `Own hand: ${cards(view.hand)}`, `Dummy: ${view.dummy ? cards(view.dummy) : 'not exposed'}`,
    `Announcements: ${view.announcements.map(a => `${a.seat} ${a.hcp} HCP`).join(', ') || 'none'}`,
    `Tricks so far: ${view.tricks.map((t, i) => `${i + 1}: ${plays(t.cards)}; winner ${t.winner}`).join('; ') || 'none'}`,
    `Current trick: ${plays(view.currentTrick)}`].join('\n');
}
export function historicalView(record: CompletedPlaythroughRecord, index: number) {
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide,
    gameFormat: record.gameFormat, setupEvents: record.setupEvents });
  for (const a of record.actions.slice(0, index)) assert.equal(table.submit(a.seat, a.controller, a.action, a.provenance).kind, 'accepted');
  return table.seatView(hintSeat(record.contract.declarer));
}
export type Output = { entry: LogEntry; outputKind: 'hint' | 'abstention' | 'trick cost' | 'moment verdict' | 'moment label' | 'moment alternative' | 'sampled quality';
  visibleContext: string; fault: string | null; verdict?: string };
const costWords = (cost: number, name: string, version: string) => text('review.cost-description', { cost, name, version });
const runner: HintRunner = (view, candidates, done, identity) => {
  void handleHintRequest({ type: 'hint', requestId: 1, ...identity, view: encodeSeatView(view), candidates,
    seed: seatViewSeed(view), deadline: Infinity, cancellationId: 'f5' }, response => {
    if (response.type === 'result') done(response.result, 0, response.source);
  }, async () => bridgeDdsAdapter);
  return () => {};
};
// VAL-08: real seeded F4 replays, production sample counts, fixed continuation by principles robots.
export async function generateCoach() {
  const outputs: Output[] = [];
  function add(entry: LogEntry, outputKind: Output['outputKind'], view: SeatView, fault: string | null = null, verdict?: string) {
    // US-40.1: validate the unmodified real output before any export normalization.
    assert.deepEqual(validateEntry(entry), [], `${entry.summary}: invalid composition output`);
    outputs.push({ entry, outputKind, visibleContext: `${entry.informationMode === 'ALL_HANDS' ? 'ALL_HANDS review: hindsight using all four hands. Historical learner Seat View follows.\n' : ''}${visibleContext(view)}`, fault, verdict });
  }
  function review(entry: LogEntry, kind: 'trick cost' | 'moment verdict' | 'moment label', record: CompletedPlaythroughRecord, verdict?: string) {
    assert.equal(entry.informationMode, 'ALL_HANDS');
    add(entry, kind, historicalView(record, entry.positionIndex), null, verdict);
    const played = record.actions[entry.positionIndex];
    // ADR-0001, CI-3: only explicitly ALL_HANDS review context receives the real layout.
    outputs.at(-1)!.visibleContext += `\nReviewed play: ${played.seat} ${card(played.action.card)}\nALL_HANDS remaining cards (hindsight):\n${Object.entries(positionAt(record, entry.positionIndex).layout).map(([seat, hand]) => `${seat}: ${cards(hand)}`).join('\n')}`;
  }
  async function hint(view: SeatView, candidates: readonly Card[], playthroughId: string, usedRunner = runner, fault: string | null = null) {
    await new Promise<void>(resolve => {
      const hints = createHints(() => {}, statement => {
        const entry: LogEntry = { ...statement, id: `f5-hint-${outputs.length}`, playthroughId,
          positionIndex: view.positionIndex, informationMode: 'VISIBLE', at: new Date().toISOString() };
        add(entry, entry.abstention ? 'abstention' : 'hint', view, fault); resolve();
      }, usedRunner);
      hints.sync(view, candidates, { playthroughId, positionKey: seatViewSeed(view) }); hints.show();
    });
  }
  for (const point of points.slice(0, 3)) {
    const table = f4Position(point), view = table.seatView(hintSeat(table.record().contract.declarer));
    const legal = table.legalActions(view.turn!).map(a => a.card);
    await hint(view, legal, table.record().playthroughId);
    if (outputs.length === 1) {
      await hint(view, legal, table.record().playthroughId, faultHintRunner('no-layout'), 'no-layout');
      await hint(view, legal, table.record().playthroughId, faultHintRunner('error'), 'error');
    }
  }
  const setup = startMiniBridge({ deal: dealFromSeed('bv-issue-27', 1), learnerSide: 'northSouth', targetDeclaringSide: 'northSouth' });
  while (setup.seatView('south').step !== 'contract-choice') setup.advance();
  const setupView = setup.seatView(setup.seatView('south').declarer!);
  const setupHints = createHints(() => {}, statement => {
    const entry: LogEntry = { ...statement, id: 'f5-setup', playthroughId: 'f5-setup', positionIndex: 0,
      informationMode: 'VISIBLE', at: new Date().toISOString() };
    assert.deepEqual(validateEntry(entry), []);
    outputs.push({ entry, outputKind: 'abstention', fault: null, visibleContext: [
      'Contract: not chosen (MiniBridge contract-choice)', `Learner's seat: ${setupView.seat}`,
      `Own hand: ${cards(setupView.hand)}`, `Dummy: ${setupView.dummy ? cards(setupView.dummy) : 'not exposed'}`,
      `Announcements: ${setupView.announcements.map(a => `${a.seat} ${a.hcp} HCP`).join(', ')}`,
      'Tricks so far: none', 'Current trick: none'].join('\n') });
  }, runner);
  setupHints.syncSetup('f5-contract-choice'); setupHints.show();
  const verdicts = new Set<string>();
  const costPool: { cost: TrickCost; record: CompletedPlaythroughRecord }[] = [];
  for (const [index, point] of points.entries()) {
    for (const candidate of teacherLabels[index].candidates) {
      const table = f4Position(point), view = table.seatView(hintSeat(table.record().contract.declarer));
      const record = finish(table, candidate.cards[0]);
      const log = createProvenanceLog(APP_VERSION), costs: TrickCost[] = [];
      await trickCosts(record, bridgeDdsAdapter, log, 'f5', costWords, cost => costs.push(cost));
      const decision = assessDecisions(record, costs).find(d => d.positionIndex === view.positionIndex)!;
      if (decision?.verdict && !verdicts.has(decision.verdict)) {
        const entries = momentLogEntries(decision, record.playthroughId, key => key === 'review.cost-description' ? decision.outcome!.statement.text!
          : key === 'moment.alternative' ? text(key, { card: cardName(decision.alternative!) }) : `${text(key)} ${text('review.hindsight')}`);
        for (const entry of entries) assert.deepEqual(validateEntry(entry), [], `${entry.summary}: invalid composition output`);
        const entry = entries.find(e => e.summary.endsWith('-sentence'))!;
        review(entry, 'moment verdict', record, decision.verdict); verdicts.add(decision.verdict);
        // VAL-08: KeyMoments renders the badge and sentence in separate paragraphs.
        review(entries.find(e => e.summary === `moment.${decision.verdict}`)!, 'moment label', record, decision.verdict);
        const alternative = entries.find(e => e.summary === 'moment.alternative');
        if (alternative) add(alternative, 'moment alternative', view, null, decision.verdict);
      }
      costPool.push(...costs.map(cost => ({ cost, record })));
      if (verdicts.size === 4) break;
    }
    if (verdicts.size === 4) break;
  }
  const record = sampledPractice(), log = createProvenanceLog(APP_VERSION), costs: TrickCost[] = [];
  await trickCosts(record, bridgeDdsAdapter, log, 'f5-sampled', costWords, cost => costs.push(cost));
  costPool.push(...costs.map(cost => ({ cost, record })));
  // VAL-08: owner's six-value selection includes the largest reached cost, seven.
  costPool.sort((a, b) => a.cost.positionIndex - b.cost.positionIndex);
  const selected = [0, 1, 2, 3, 4, 7].map(value => {
    const candidate = costPool.find(({ cost }) => cost.cost === value);
    assert.ok(candidate, `F5 did not reach required trick cost ${value}`);
    return candidate;
  });
  for (const { cost, record: source } of selected) review(cost.statement, 'trick cost', source);
  const positions = samplingPositions(record, assessDecisions(record, costs));
  const first = positions[0];
  const decisions = await runReviewSampling(record, [first.decision], [], request => new Promise(resolve => {
    void handleHintRequest(request, response => { if (response.type === 'result') resolve(response); }, async () => bridgeDdsAdapter);
  }), Infinity);
  const quality = sampledQualityEntry(decisions[0], record.playthroughId, text(qualityTemplate(decisions[0])))!;
  add(quality, 'sampled quality', first.view);
  outputs.at(-1)!.visibleContext += `\nReviewed play: ${first.view.turn} ${card(first.decision.card)}`;
  // US-14.11: find an actual forced play on the same real practice line.
  const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide,
    gameFormat: record.gameFormat, setupEvents: record.setupEvents });
  for (const a of record.actions) {
    const view = table.seatView(hintSeat(record.contract.declarer));
    const legal = table.legalActions(a.seat).map(action => action.card);
    if (a.controller === 'learner' && legal.length === 1) { await hint(view, legal, record.playthroughId); break; }
    assert.equal(table.submit(a.seat, a.controller, a.action, a.provenance).kind, 'accepted');
  }
  return outputs;
}
