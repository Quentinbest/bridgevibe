import { dealFromSeed, encodeSeatView, SEATS, startPlaythrough } from '../../table';
import type { Layout, Position } from '../../analysis';
import { engineClient } from './engineClient';
import { firstLesson, monitor, visible, visibility } from './platform';
import { soakDeal } from './soak';
import { stats, fallbackRates, exportReport, storageKey, type CandidateId, type Report, type Fallback } from './report';

export function samplePosition(index: number) {
  const table = startPlaythrough({ deal: dealFromSeed('bench-samples', index + 1),
    contract: { declarer: 'south', level: 1, strain: 'no-trumps' }, learnerSide: 'northSouth' });
  for (let i = 0; i < 40; i++) {
    const seat = table.seatView('south').turn!;
    const controller = table.controllerOf(seat);
    const result = table.submit(seat, controller, table.legalActions(seat)[0], controller === 'robot'
      ? { kind: 'authored', contentId: 'bench-samples', version: 1 } : undefined);
    if (result.kind !== 'accepted') throw new Error('sample-position-rejected');
  }
  const turn = table.seatView('south').turn!;
  return { view: encodeSeatView(table.seatView(turn === SEATS[0] ? 'south' : turn)), cards: table.legalActions(turn).map(action => action.card) };
}

// US-43: progress is durable before each potentially failing operation.
export async function runBench(report: Report, selected: readonly CandidateId[], signal: AbortSignal,
  update: (report: Report) => void = () => {}, storage: Pick<Storage, 'setItem'> = localStorage,
  // NFR-P1 needs the real app in a same-origin iframe; the Vitest browser runner can't serve it, so tests inject a stand-in.
  measureFirstLesson: (signal: AbortSignal) => Promise<number> = firstLesson): Promise<Report> {
  const publish = () => { storage.setItem(storageKey, exportReport(report)); update(structuredClone(report)); };
  const data = await import('../../analysis/f2-full.json');
  const fixtures = data.default as { cases: { layout: Layout; positions: { layout: Layout; position: Position }[] }[] };
  for (const id of selected) {
    if (signal.aborted) break;
    const candidate = report.candidates.find(c => c.id === id)!;
    candidate.status = 'running'; candidate.progress = 'starting'; publish();
    const stopMonitor = monitor(candidate), state = visibility();
    const values = { P1: [] as number[], P2: [] as number[], P3: [] as number[], P4: [] as number[], perLayoutMs: [] as number[], estimatorMs: [] as number[] };
    const deals: Fallback[][] = [];
    let client: ReturnType<typeof engineClient> | undefined;
    const record = (metric: keyof typeof values, ms: number, hidden: boolean) => {
      if (hidden) candidate.excludedHiddenTimings++;
      else { values[metric].push(ms); candidate[metric] = stats(values[metric]); }
    };
    const step = async (name: string) => { await visible(signal); candidate.progress = name; publish(); return state.stamp(); };
    try {
      for (let i = 0; i < report.configuration.coldStarts; i++) {
        const stamp = await step(`P1:${i + 1}`);
        record('P1', await measureFirstLesson(signal), state.hiddenSince(stamp));
      }
      client = engineClient(signal, message => { candidate.P6.crashes.push(message); });
      await client.run({ type: 'init', candidate: id });
      const positions = fixtures.cases.flatMap(item => item.positions).slice(0, report.configuration.positions);
      for (const [i, position] of positions.entries()) {
        const stamp = await step(`F2-position:${i + 1}/${positions.length}`);
        record('P2', (await client.run({ type: 'position', ...position })).ms, state.hiddenSince(stamp));
      }
      for (const [i, item] of fixtures.cases.slice(0, report.configuration.tables).entries()) {
        const stamp = await step(`F2-table:${i + 1}/${report.configuration.tables}`);
        record('P3', (await client.run({ type: 'table', layout: item.layout })).ms, state.hiddenSince(stamp));
      }
      for (let i = 0; i < 2; i++) {
        const stamp = await step(`sample:${i + 1}/2`);
        const result = await client.run({ type: 'sample', ...samplePosition(i), count: report.configuration.samples });
        if (result.sampleCount < 1) throw new Error('empty-samples');
        candidate.layoutSamples += result.sampleCount;
        record('perLayoutMs', result.solveMs / result.sampleCount, state.hiddenSince(stamp));
        record('estimatorMs', result.ms, state.hiddenSince(stamp));
      }
      for (let i = 0; i < report.configuration.deals; i++) {
        await step(`F7:${i + 1}/${report.configuration.deals}`);
        const result = await soakDeal(i, signal, (ms, hidden) => record('P4', ms, hidden), message => candidate.P6.crashes.push(message));
        deals.push(result.events); candidate.completedDeals = deals.length; candidate.fallbacks = fallbackRates(deals);
        candidate.policyFallbacks = report.policies.map(policy => ({ policy: policy.name,
          rates: fallbackRates(deals.map(events => events.filter(event => event.policy === policy.name))) }));
        await step(`F7-table:${i + 1}/${report.configuration.deals}`);
        await client.run({ type: 'table', layout: result.layout });
      }
      candidate.status = 'complete'; candidate.progress = 'complete';
    } catch (error) {
      candidate.status = signal.aborted ? 'cancelled' : 'failed'; candidate.errors.push(String(error));
    } finally { client?.stop(); state.stop(); stopMonitor(); publish(); }
  }
  return report;
}
