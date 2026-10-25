import { createRobotHost } from '../robotHost';
import { validRobotResponse } from '../robotProtocol';
import { principlesPolicy, contractChoicePolicy } from '../../robots';
import { SEATS, dealFromSeed, startMiniBridge, type RobotProvenance } from '../../table';
import { visible, visibility } from './platform';
import type { Fallback } from './report';

// F7, ADR-0001: every seat is driven through the real host; Dummy uses Declarer's view.
export async function soakDeal(index: number, signal: AbortSignal, observe: (ms: number, hidden: boolean) => void,
  crash: (message: string) => void) {
  const setup = startMiniBridge({ deal: dealFromSeed('principles-soak', index + 1), learnerSide: 'northSouth' });
  while (setup.seatView('south').step !== 'contract-choice') setup.advance();
  const declarer = setup.seatView('south').declarer!;
  const dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
  const events: Fallback[] = [];
  const visibilityState = visibility();
  let start = 0, received: number | undefined;
  const host = createRobotHost({ createWorker() {
    const worker = new Worker(new URL('../robotWorker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }: MessageEvent<unknown>) => {
      if (validRobotResponse(data) && data.type === 'decided') received = performance.now() - start;
    });
    worker.addEventListener('error', () => crash('robot-worker-error'));
    return worker;
  } });
  try {
    for (let actionIndex = -1; actionIndex < 52; actionIndex++) {
      await visible(signal);
      start = performance.now(); received = undefined;
      const stamp = visibilityState.stamp();
      const table = setup.playthrough();
      const key = table?.positionKey() ?? 'setup';
      await new Promise<void>((resolve, reject) => {
        const abort = () => { host.stop(); reject(new Error('cancelled')); };
        signal.addEventListener('abort', abort, { once: true });
        const complete = (accepted: boolean, provenance: RobotProvenance) => {
          // US-11.1: let the host replace a rejected policy action with its marked fallback.
          if (!accepted && !provenance.fallback) return false;
          signal.removeEventListener('abort', abort);
          const hidden = visibilityState.hiddenSince(stamp);
          observe(provenance.fallback ? provenance.durationMs : received ?? provenance.durationMs, hidden);
          if (provenance.fallback) events.push({ reason: provenance.fallback, hidden, policy: actionIndex < 0 ? contractChoicePolicy.name : principlesPolicy.name });
          if (!accepted) reject(new Error('soak-table-rejection')); else resolve();
          return accepted;
        };
        const identity = { seed: 'principles-soak', playthroughId: `bench-${index}`, positionKey: key,
          currentPositionKey: () => table?.positionKey() ?? 'setup' };
        if (!table) host.decide({ ...identity, kind: 'contract', view: setup.seatView(declarer), submit(action, provenance) {
          const controller = setup.controllerOf(declarer);
          return complete(setup.submit(declarer, controller, action, controller === 'robot' ? provenance : undefined).kind === 'accepted', provenance);
        } });
        else {
          const seat = table.seatView(declarer).turn!;
          host.decide({ ...identity, view: table.seatView(seat === dummy ? declarer : seat), submit(action, provenance) {
            const controller = table.controllerOf(seat);
            return complete(table.submit(seat, controller, action, controller === 'robot' ? provenance : undefined).kind === 'accepted', provenance);
          } });
        }
      });
    }
    const record = setup.playthrough()!.record();
    if (record.status !== 'completed') throw new Error('incomplete-soak');
    return { events, layout: record.deal.hands };
  } finally { host.stop(); visibilityState.stop(); }
}
