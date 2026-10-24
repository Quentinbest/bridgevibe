import { performance } from 'node:perf_hooks';
import { expect, vi } from 'vitest';
import { dealFromSeed, encodeSeatView, decodeSeatView, seatViewSeed, type Deal, type Playthrough, type SeatViewMessage } from '../../src/table';
import { principlesPolicy, type RobotPolicy } from '../../src/robots';
import { createRobotHost, type RobotWorker } from '../../src/app/robotHost';
import { handleRobotMessage } from '../../src/app/robotWorker';
import { ROBOT_PROTOCOL_VERSION } from '../../src/app/robotProtocol';
import { robotAudit } from '../../src/app/robotAudit';
import { createHints, hintSeat } from '../../src/app/hints';
import type { HintRunner } from '../../src/app/hintClient';
import { sampledEstimate } from '../../src/analysis/sampledEstimate';
import { bridgeDdsAdapter } from '../../src/analysis/bridgeDdsAdapter';
import { HINT_SAMPLE_COUNT, sampler } from '../../src/information/parameters';
import { createProvenanceLog } from '../../src/coach/provenance';
import { begin, partner, positions, scripted, type Position } from './positions';
import { permutations } from './permute';

type Observation = { view: SeatViewMessage; decision: unknown };
export type Failure = { position: Position; permutation: number; original: Observation; permuted: Observation };
export type PolicyFactory = (deal: Deal) => RobotPolicy;

function robot(table: Playthrough, policy: RobotPolicy): Observation {
  const turn = table.seatView('south').turn!;
  const declarer = table.record().contract.declarer;
  const view = table.seatView(turn === partner(declarer) ? declarer : turn);
  let observation: Observation | undefined;
  let sent: SeatViewMessage | undefined;
  const worker: RobotWorker = {
    onmessage: null, onerror: null, onmessageerror: null, terminate() {},
    postMessage(message) {
      if (message.type === 'decide') sent = structuredClone(message.view);
      handleRobotMessage(message, data => worker.onmessage?.({ data } as MessageEvent), policy);
    },
  };
  const host = createRobotHost({ audit: robotAudit(table.record), createWorker: () => {
    setTimeout(() => worker.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent), 0);
    return worker;
  } });
  try {
    host.decide({ view, seed: seatViewSeed(view), playthroughId: table.record().playthroughId,
      positionKey: table.positionKey(), currentPositionKey: table.positionKey,
      submit(action, provenance) {
        expect(provenance.fallback).toBeUndefined();
        expect(provenance.ruleId).toBeTruthy();
        expect(sent).toBeDefined();
        observation = { view: sent!, decision: { action, ruleId: provenance.ruleId } };
        expect(table.submit(turn, 'robot', action, provenance).kind).toBe('accepted');
        return true;
      } });
    vi.advanceTimersByTime(500);
    expect(observation).toBeDefined();
    return observation!;
  } finally { host.stop(); }
}

async function hint(table: Playthrough): Promise<Observation> {
  const log = createProvenanceLog('f3');
  let sent: SeatViewMessage | undefined;
  let pending: Promise<void> | undefined;
  const runner: HintRunner = (view, candidates, done) => {
    sent = encodeSeatView(view);
    // US-14.8: fixed sample count and no wall-clock race; every permutation really solves.
    pending = sampledEstimate(bridgeDdsAdapter, decodeSeatView(sent), candidates,
      HINT_SAMPLE_COUNT, seatViewSeed(view), Infinity).then(result => {
      expect(result).not.toHaveProperty('abstention');
      expect(result.sampleCount).toBeGreaterThan(0);
      if (!result.enumerated) expect(result.sampleCount).toBe(HINT_SAMPLE_COUNT);
      done(result, 0, { engine: { name: bridgeDdsAdapter.name, version: bridgeDdsAdapter.version }, sampler });
    });
    return () => {};
  };
  const hints = createHints(() => {}, (entry, positionIndex) => log.record({ ...entry, positionIndex,
    id: 'f3-hint', playthroughId: table.record().playthroughId, informationMode: 'VISIBLE', at: new Date().toISOString() }), runner);
  try {
    const view = table.seatView(hintSeat(table.record().contract.declarer));
    hints.sync(view, table.legalActions(view.turn!).map(a => a.card),
      { playthroughId: table.record().playthroughId, positionKey: table.positionKey() });
    hints.show();
    expect(pending, 'every hint fixture must exercise sampler and solver').toBeDefined();
    await pending;
    expect(log.entries()).toHaveLength(1);
    const entry = log.entries()[0];
    expect(entry.informationMode).toBe('VISIBLE');
    expect(entry.summary).toBe('hint.advice');
    expect(hints.snapshot()).toMatchObject({ open: true, thinking: false, abstained: false });
    return { view: sent!, decision: { templateId: entry.summary, text: entry.text, informationMode: entry.informationMode } };
  } finally { hints.stop(); }
}

// §5.3: compose the real Table/host/worker/audit/hints here because createPlay freely
// schedules other robots. Their changed private hands would legitimately change the prefix.
async function playCase(deal: Deal, position: Position, prefix: ReturnType<Playthrough['record']>, policy: RobotPolicy) {
  const table = begin(deal);
  expect(table.record().setupEvents).toEqual(prefix.setupEvents);
  for (const entry of prefix.actions) scripted(table, entry.action);
  expect(table.record().actions).toEqual(prefix.actions);
  const turn = table.seatView(position.seat).turn!;
  expect(table.controllerOf(turn)).toBe(position.kind === 'robot' ? 'robot' : 'learner');
  const observed = position.kind === 'robot' ? robot(table, policy) : await hint(table);
  expect(observed.view.seat).toBe(position.seat);
  if (position.kind === 'hint') scripted(table);
  while (table.seatView('south').status !== 'completed') {
    if (table.controllerOf(table.seatView('south').turn!) === 'robot') robot(table, principlesPolicy);
    else scripted(table);
  }
  expect(table.record().actions).toHaveLength(52);
  expect(table.completedRecord().status).toBe('completed');
  return observed;
}

export async function runF3({ policy = () => principlesPolicy }: { policy?: PolicyFactory } = {}): Promise<Failure[]> {
  const failures: Failure[] = [];
  const timings = { robot: 0, hint: 0 };
  let cases = 0;
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  try {
    for (const position of positions) {
      const started = performance.now();
      const deal = dealFromSeed(position.seed, position.index);
      const table = begin(deal);
      for (let i = 0; i < position.actions; i++) scripted(table);
      const prefix = table.record();
      const deals = permutations(deal, table.seatView(position.seat), position.index * 100 + position.actions);
      const original = await playCase(deal, position, prefix, policy(deal));
      for (const [permutation, next] of deals.entries()) {
        const permuted = await playCase(next, position, prefix, policy(next));
        if (JSON.stringify(original) !== JSON.stringify(permuted)) failures.push({ position, permutation, original, permuted });
        cases++;
      }
      timings[position.kind] += performance.now() - started;
    }
    expect(cases).toBe(200);
    console.log(`F3: ${cases} permutations + 20 baselines; robot ${timings.robot.toFixed(0)} ms; hint ${timings.hint.toFixed(0)} ms`);
    return failures;
  } finally { vi.useRealTimers(); }
}
