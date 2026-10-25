import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import type { Card, Deal, PlaythroughRecord, SeatView, ContractChoice } from '../../src/table/index';

// DEP-05: run the unchanged browser modules in Node, as the F7 generator does.
if (import.meta.main) registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    for (const suffix of ['.ts', '/index.ts', '.js']) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
} });

export type Category = 'correct-play-loses' | 'clear' | 'close';
type Role = 'declarer' | 'defender';
type Metric = { cards: readonly Card[]; sampled: number; doubleDummy: number };
export type DraftPoint = {
  deal: Deal; view: SeatView; category: Category; metrics: Metric[]; sampleCount: number;
  decision: {
    dealId: string; origin: Deal['origin']; contract: PlaythroughRecord['contract'] & { objective: ContractChoice['objective'] };
    learnerRole: Role; positionKey: { setup: NonNullable<PlaythroughRecord['setupEvents']>; actions: PlaythroughRecord['actions'] };
    seatToAct: NonNullable<SeatView['turn']>;
    candidates: { cards: readonly Card[]; labels: { teacherA: null; teacherB: null } }[];
    graders: [null, null]; resolution: null;
  };
};

// CI-3: these are selection categories, never teacher labels.
export function classify(metrics: readonly Metric[]): Category | null {
  const best = Math.max(...metrics.map(m => m.sampled));
  const actual = Math.max(...metrics.map(m => m.doubleDummy));
  const near = metrics.filter(m => best - m.sampled <= 0.25 + 1e-9);
  const top = metrics.filter(m => m.sampled === best);
  if (top.length && top.every(m => actual - m.doubleDummy >= 1)
    && metrics.some(m => best - m.sampled >= 0.25 - 1e-9)) return 'correct-play-loses';
  if (metrics.some(m => best - m.sampled >= 1 - 1e-9)
    && metrics.filter(m => m.sampled === best).every(m => m.doubleDummy === actual)) return 'clear';
  if (near.length >= 2 && new Set(near.map(m => m.doubleDummy)).size === 1) return 'close';
  return null;
}

export async function draftDeal(seed: string, index: number, role: Role,
  wanted: readonly Category[] = ['correct-play-loses', 'clear', 'close'], firstTrick = 1, deadline = Infinity): Promise<DraftPoint | null> {
  const { dealFromSeed, startMiniBridge, SEATS, SUITS, sameCard } = await import('../../src/table/index');
  const { principlesPolicy } = await import('../../src/robots/index');
  const { visibleClasses, sampledEstimate } = await import('../../src/analysis/sampledEstimate');
  const { bridgeDdsAdapter } = await import('../../src/analysis/bridgeDdsAdapter');
  const setup = startMiniBridge({ deal: dealFromSeed(seed, index), learnerSide: 'northSouth',
    targetDeclaringSide: role === 'declarer' ? 'northSouth' : 'eastWest' });
  while (setup.seatView('south').step !== 'contract-choice') {
    if (setup.seatView('south').step === 'redeal') return null;
    setup.advance();
  }
  const declarer = setup.seatView('south').declarer!;
  const visible = setup.seatView(declarer);
  const combined = [...visible.hand, ...visible.dummy!];
  const longest = [...SUITS].sort((a, b) => combined.filter(c => c.suit === b).length - combined.filter(c => c.suit === a).length)[0];
  const choice: ContractChoice = { kind: 'choose-contract', strain: index % 2 ? 'no-trumps' : longest,
    objective: index % 4 < 2 ? 'game' : 'part-score' };
  const control = setup.controllerOf(declarer);
  if (setup.submit(declarer, control, choice, control === 'robot'
    ? { kind: 'robot', policy: 'f4-scripted-contract', version: '1', durationMs: 0 } : undefined).kind !== 'accepted') throw new Error('Contract rejected');
  const table = setup.playthrough()!;
  const dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
  for (let n = 0; n < 32; n++) {
    if (Date.now() >= deadline) throw new Error('F4 time cap reached; outputs not replaced');
    const seat = table.seatView(declarer).turn!;
    const view = table.seatView(seat === dummy ? declarer : seat);
    const controller = table.controllerOf(seat);
    const legal = table.legalActions(seat).map(a => a.card);
    const groups = visibleClasses(view, legal);
    if (controller === 'learner' && view.tricks.length + 1 >= firstTrick && groups.length > 1
      && (view.dummy !== null || n !== 0)) {
      const estimate = await sampledEstimate(bridgeDdsAdapter, view, legal, 50, 'f4-v1', Infinity);
      if (Date.now() >= deadline) throw new Error('F4 time cap reached; outputs not replaced');
      if (!('abstention' in estimate) && estimate.sampleCount >= 50) {
        const layout = { north: table.seatView('north').hand, east: table.seatView('east').hand,
          south: table.seatView('south').hand, west: table.seatView('west').hand };
        const actual = await bridgeDdsAdapter.solvePosition(layout, {
          strain: view.contract.strain, leader: view.currentTrick[0]?.seat ?? seat, currentTrick: view.currentTrick });
        if (Date.now() >= deadline) throw new Error('F4 time cap reached; outputs not replaced');
        const metrics = groups.map(cards => {
          const scores = cards.map(card => actual.classes.find(c => c.cards.some(k => sameCard(k, card)))?.tricks);
          if (scores.some(s => s === undefined || s !== scores[0])) throw new Error('Inconsistent DDS class');
          return { cards, sampled: estimate.classes.find(c => c.cards.some(k => sameCard(k, cards[0])))!.tricks, doubleDummy: scores[0]! };
        });
        const category = classify(metrics);
        if (category && wanted.includes(category)) {
          const record = table.record();
          return { deal: record.deal, view, category, metrics, sampleCount: estimate.sampleCount,
            decision: { dealId: record.deal.dealId, origin: record.deal.origin,
              contract: { ...record.contract, objective: choice.objective }, learnerRole: role,
              positionKey: { setup: record.setupEvents!, actions: record.actions }, seatToAct: seat,
              candidates: groups.map(cards => ({ cards, labels: { teacherA: null, teacherB: null } })),
              graders: [null, null], resolution: null } };
        }
      }
    }
    const action = principlesPolicy.decide(view, 'f4-v1', Infinity);
    if (table.submit(seat, controller, { kind: 'play-card', card: action.card }, controller === 'robot'
      ? { kind: 'robot', policy: principlesPolicy.name, version: principlesPolicy.version, ruleId: action.ruleId, durationMs: 0 }
      : undefined).kind !== 'accepted') throw new Error('Scripted play rejected');
  }
  return null;
}

const ranks: Record<string, string> = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack' };
export const cardName = (c: Card) => `${ranks[c.rank] ?? c.rank} of ${c.suit}`;
const cardsText = (cards: readonly Card[]) => cards.map(cardName).join(', ') || 'None';
// ADR-0001: this renderer receives only the learner's Seat View and blind candidates.
export function blindSection(view: SeatView, decision: DraftPoint['decision'], number: number): string {
  const plays = (cards: SeatView['currentTrick']) => cards.map(p => `${p.seat}: ${cardName(p.card)}`).join('; ') || 'None';
  return [`## Decision ${number}`, '',
    `Contract: ${decision.contract.strain}; Objective: ${decision.contract.objective}; Declarer: ${decision.contract.declarer}.`,
    `Learner role: ${decision.learnerRole}; viewing seat: ${view.seat}; seat to act: ${view.turn}; trick ${view.tricks.length + 1}.`,
    `Announcements (HCP): ${view.announcements.map(a => `${a.seat}: ${a.hcp}`).join('; ')}.`, '',
    `Learner's hand (${view.seat}): ${cardsText(view.hand)}.`,
    `Dummy: ${view.dummy ? cardsText(view.dummy) : 'Not exposed'}.`, '',
    'Completed tricks:', ...view.tricks.map((t, i) => `${i + 1}. ${plays(t.cards)}. Winner: ${t.winner}.`),
    ...(view.tricks.length ? [] : ['None.']), '', `Current trick: ${plays(view.currentTrick)}.`, '',
    '| Candidate (equivalent cards) | Teacher A: acceptable? (yes/no) | Teacher B: acceptable? (yes/no) | Resolution note |',
    '| --- | --- | --- | --- |', ...decision.candidates.map(c => `| ${cardsText(c.cards)} | | | |`), ''].join('\n');
}

export function render(points: readonly DraftPoint[], scanned: number) {
  return {
    'f4-decisions.json': JSON.stringify(points.map(p => p.decision), null, 2) + '\n',
    'labelling-sheet.md': ['# F4 blind labelling sheet', '',
      'AI-drafted selection for both teachers to label independently. Labels are intentionally blank. Under CI-3, acceptable means a reasonable decision on the information the learner could see, not how the actual layout turned out. Outcome alone never makes a decision a mistake. Resolve disagreements together; unresolved points are excluded from VAL-07 (US-18.5).', '',
      'Teacher A: __________    Teacher B: __________', '',
      ...points.map((p, i) => blindSection(p.view, p.decision, i + 1))].join('\n'),
    'selection-notes.md': ['# F4 selection notes — private', '',
      '**Do not share with graders until labelling is finished.** These algorithmic categories are selection aids, not teacher labels or validated coaching assessments. This is DEP-05 / T7a input, not an app fixture.', '',
      `Scanned ${scanned} Deals; selected ${points.length}. Seed: bv-f4-draft; sampler seed: f4-v1; 50 samples per point; bridge-dds 1.4.0 / DDS 2.9; principlesPolicy version 1.`,
      'Correct-play-loses requires every class tied for the highest sampled expected tricks to cost at least 1 double-dummy trick against the best class on the actual layout, and that sampled maximum to exceed at least one other legal class by at least 0.25 tricks. A losing near-best class alone does not qualify.',
      'Fixed scan cap: 1000 seed indices (indices for filled role or strain quotas are skipped). Safety time cap: 15 minutes (abort without replacing outputs). Runtime is printed to the console, excluded here for byte determinism. 20–20 Deals are skipped. Contract scripts alternate NT/longest combined suit and game/part-score. Target trick cycles 1–8; later decisions through trick 8 are searched. Quotas: declaring 4/7/7, defending 2/5/5 (losing/clear/close); 18 NT and 12 suit contracts.',
      'Metrics are remaining tricks for the side to act, including the current trick. Sampled continuation is double-dummy on layouts consistent with the Seat View, an approximation. Close means at least two classes within 0.25 of sampled best with equal actual-layout values; losing-layout takes precedence, then clear. No tolerance is relaxed. Full setup/actions are in positionKey; rotation events may contain full Deals, so the JSON is engineering input, not blind grading material. Give teachers only labelling-sheet.md.', '',
      ...points.flatMap((p, i) => [`## Decision ${i + 1}: ${p.deal.dealId}`, '',
        `Category: ${p.category}; trick: ${p.view.tricks.length + 1}; samples: ${p.sampleCount}; origin: ${JSON.stringify(p.deal.origin)}.`, '',
        '| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |', '| --- | --- | --- |',
        ...p.metrics.map(m => `| ${cardsText(m.cards)} | ${m.sampled.toFixed(2)} | ${m.doubleDummy} |`), '',
        `Full Deal: dealer ${p.deal.dealer}; vulnerability ${JSON.stringify(p.deal.vulnerability)}.`,
        ...(['north', 'east', 'south', 'west'] as const).map(s => `- ${s}: ${cardsText(p.deal.hands[s])}`), ''])].join('\n'),
  };
}

export async function generateDraft() {
  const quotas = { declarer: { 'correct-play-loses': 4, clear: 7, close: 7 }, defender: { 'correct-play-loses': 2, clear: 5, close: 5 } };
  const strains = { nt: 18, suit: 12 };
  const points: DraftPoint[] = [];
  const started = Date.now();
  let scanned = 0;
  for (let index = 1; index <= 1000 && points.length < 30; index++) {
    const role: Role = (index - 1) % 5 < 3 ? 'declarer' : 'defender';
    const strain = index % 2 ? 'nt' : 'suit';
    const wanted = (Object.keys(quotas[role]) as Category[]).filter(c => quotas[role][c] > 0);
    if (!wanted.length || !strains[strain]) continue;
    scanned++;
    const point = await draftDeal('bv-f4-draft', index, role, wanted, (index - 1) % 8 + 1, started + 15 * 60_000);
    if (point) { points.push(point); quotas[role][point.category]--; strains[strain]--; }
    console.log(`Scanned ${scanned}: ${points.length}/30 selected (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }
  return { points, scanned, elapsedSeconds: (Date.now() - started) / 1000, missing: quotas };
}
if (import.meta.main) {
  const result = await generateDraft();
  const directory = new URL('../../docs/domain/f4-draft/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  for (const [name, body] of Object.entries(render(result.points, result.scanned))) writeFileSync(new URL(name, directory), body);
  console.log(JSON.stringify({ scanned: result.scanned, elapsedSeconds: result.elapsedSeconds,
    categories: result.points.reduce<Record<string, number>>((counts, p) => ({ ...counts, [p.category]: (counts[p.category] ?? 0) + 1 }), {}), missing: result.missing }));
  if (result.points.length !== 30) process.exitCode = 1;
}
