import type { Layout, Position, SolverPort } from '../../analysis';
import { decodeSeatView, type Card, type SeatViewMessage } from '../../table';
import { sampledEstimate } from '../../analysis/sampledEstimate';
import type { CandidateId } from './report';

export type Request = { id: number } & ({ type: 'init'; candidate: CandidateId }
  | { type: 'position'; layout: Layout; position: Position }
  | { type: 'table'; layout: Layout }
  | { type: 'sample'; view: SeatViewMessage; cards: readonly Card[]; count: number });
export type Reply = { id: number; ms: number; sampleCount: number; solveMs: number; error?: string };
let solver: SolverPort;
// US-43.1: each candidate owns a worker; never use the VITE_SOLVER switch.
self.onmessage = async ({ data }: MessageEvent<Request>) => {
  const start = performance.now();
  let sampleCount = 0, solveMs = 0;
  try {
    if (data.type === 'init') {
      solver = data.candidate === 'bridge-dds' ? (await import('../../analysis/bridgeDdsAdapter')).bridgeDdsAdapter
        : data.candidate === 'macroxue' ? (await import('../../analysis/macroxueAdapter')).macroxueAdapter
        : (await import('../../analysis/dds31Adapter')).dds31Adapter;
    } else if (data.type === 'position') await solver.solvePosition(data.layout, data.position);
    else if (data.type === 'table') await solver.solveTable(data.layout);
    else {
      const measured: SolverPort = { ...solver, async solvePosition(layout, position) {
        const before = performance.now();
        const result = await solver.solvePosition(layout, position);
        solveMs += performance.now() - before;
        return result;
      } };
      const result = await sampledEstimate(measured, decodeSeatView(data.view), data.cards, data.count, 'bench-samples', Infinity);
      if ('abstention' in result) throw new Error(`sample-${result.abstention.reason}`);
      sampleCount = result.sampleCount;
    }
    self.postMessage({ id: data.id, ms: performance.now() - start, sampleCount, solveMs } satisfies Reply);
  } catch (error) {
    self.postMessage({ id: data.id, ms: performance.now() - start, sampleCount, solveMs, error: String(error) } satisfies Reply);
  }
};
