// @vitest-environment jsdom
import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { bridgeDdsAdapter } from '../analysis/bridgeDdsAdapter';
import { bridgeDdsEngine, positionAt, type SolverPort } from '../analysis';
import { completedRecord, replay } from '../table';
import { completeFixedDeal } from '../../test/strategy';
import { createProvenanceLog, validateEntry } from '../coach/provenance';
import { analysisClient, type AnalysisWorker } from './analysisClient';
import { ANALYSIS_PROTOCOL_VERSION, type AnalysisRequest } from './analysisProtocol';
import { faultSolver, faultWorker } from './analysisFaults';
import { createAnalysisHost } from './analysisHost';
import { ReviewScreen } from './ReviewScreen';

afterEach(cleanup);
const record = completedRecord(completeFixedDeal());
// §5.1: transport harness delegates every result to the real engine adapter.
class AdapterWorker implements AnalysisWorker {
  onmessage: AnalysisWorker['onmessage'] = null;
  onerror: AnalysisWorker['onerror'] = null;
  terminated = false;
  constructor() { queueMicrotask(() => this.onmessage?.({ data: { type: 'hello', protocolVersion: ANALYSIS_PROTOCOL_VERSION } } as MessageEvent)); }
  postMessage({ requestId, index }: AnalysisRequest) {
    const { layout, position } = positionAt(record, index);
    void bridgeDdsAdapter.solvePosition(layout, position).then(result => {
      if (!this.terminated) this.onmessage?.({ data: { type: 'result', requestId, result } } as MessageEvent);
    });
  }
  terminate() { this.terminated = true; }
}
for (const fault of ['timeout', 'error', 'crash', 'protocol-mismatch', 'success'] as const) {
  test(`VAL-06: ${fault} shows honest review, record replay and zero silent fallbacks; retry recovers`, async () => {
    const workers: AdapterWorker[] = [];
    let selected: typeof fault | 'success' = fault;
    const host = createAnalysisHost(completed => {
      const make = () => { const worker = new AdapterWorker(); workers.push(worker); return worker; };
      const client = analysisClient(completed, selected === 'crash' || selected === 'protocol-mismatch' ? faultWorker(make, selected) : make, 1000);
      return { ...client, solver: selected === 'timeout' || selected === 'error' ? faultSolver(client.solver, selected, 1) : client.solver };
    });
    const log = createProvenanceLog();
    function Review() {
      const state = useSyncExternalStore(host.subscribe, () => host.snapshot(record));
      return <ReviewScreen record={record} analysis={state} onBack={() => {}} onTryAgain={() => { host.retry(record, log); }} />;
    }
    host.start(record, log); render(<Review />);
    await waitFor(() => expect(host.snapshot(record).running).toBe(false));
    if (fault !== 'success') {
      const abstention = host.snapshot(record).abstention!;
      expect(abstention).toMatchObject({ abstention: { reason: 'unavailable', cause: fault === 'crash' ? 'worker-crash' : fault }, provenance: bridgeDdsEngine });
      expect(validateEntry(abstention)).toEqual([]);
      expect(screen.getByRole('status').textContent).toBe("X-ray view isn't available right now");
      expect(host.snapshot(record).costs).toEqual([]);
      expect(log.counters().silentFallbacks).toBe(0);
      fireEvent.click(screen.getByRole('button', { name: 'Next trick' }));
      expect(screen.getByText('Trick 2 of 13')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Previous trick' }));
      // CI-4: another failed attempt also abstains without duplicate provenance IDs.
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(host.snapshot(record).running).toBe(false));
      expect(host.snapshot(record).abstention?.id).not.toBe(abstention.id);
      expect(log.counters().silentFallbacks).toBe(0);
      const before = workers.length;
      selected = 'success';
      const retry = screen.getByRole('button', { name: 'Try again' }); retry.focus();
      fireEvent.click(retry);
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Hand review' }));
      expect(screen.getByRole('status').textContent).toBe('Working out the X-ray view…');
      await waitFor(() => expect(host.snapshot(record).running).toBe(false));
      expect(workers.length).toBeGreaterThan(before);
      expect(host.snapshot(record).abstention).toBeUndefined();
    }
    expect(host.snapshot(record).costs.length).toBeGreaterThan(0);
    for (const [index, trick] of replay(record).entries()) {
      expect(screen.getByText(`Trick ${index + 1} of 13`)).toBeTruthy();
      expect(screen.getByText(`${trick.winner[0].toUpperCase()}${trick.winner.slice(1)} won it`)).toBeTruthy();
      if (index < 12) fireEvent.click(screen.getByRole('button', { name: 'Next trick' }));
    }
    expect(log.counters().silentFallbacks).toBe(0);
    expect(workers.every(worker => worker.terminated)).toBe(true);
  });
}
test('CI-4: startup errors abstain; a partial run keeps verified costs and retry does not duplicate IDs', async () => {
  const log = createProvenanceLog();
  const startup = createAnalysisHost(() => { throw new Error('startup'); });
  startup.start(record, createProvenanceLog());
  expect(startup.snapshot(record)).toMatchObject({ running: false, abstention: { abstention: { cause: 'error' } } });
  let calls = 0;
  const port: SolverPort = { ...bridgeDdsAdapter, solvePosition: (...args) => ++calls === 2
    ? faultSolver(bridgeDdsAdapter, 'error').solvePosition(...args) : bridgeDdsAdapter.solvePosition(...args) };
  const host = createAnalysisHost();
  host.start(record, log, port);
  await waitFor(() => expect(host.snapshot(record).running).toBe(false));
  expect(host.snapshot(record).costs).toHaveLength(1);
  expect(host.snapshot(record).abstention?.positionIndex).toBeGreaterThan(1);
  await act(async () => { host.retry(record, log, port); });
  await waitFor(() => expect(host.snapshot(record).running).toBe(false));
  expect(host.snapshot(record).costs.length).toBeGreaterThan(1);
  expect(host.snapshot(record).abstention).toBeUndefined();
  expect(log.counters().silentFallbacks).toBe(0);
});

test('VAL-06: an unrelated entry between adapter failure and abstention does not split failure accounting', async () => {
  const log = createProvenanceLog();
  let interleaved = false;
  const observedLog = { ...log, analysisFailed(id: string) {
    log.analysisFailed(id);
    if (interleaved) return;
    interleaved = true;
    expect(log.counters().silentFallbacks).toBe(1);
    log.record({ id: 'unrelated-statement', playthroughId: record.playthroughId, positionIndex: 0,
      kind: 'statement', summary: 'Unrelated authored statement', text: 'Unrelated authored statement',
      informationMode: 'VISIBLE', at: new Date().toISOString(),
      provenance: { sourceKind: 'authored', contentId: 'unrelated', version: '1' } });
  } };
  const host = createAnalysisHost();
  host.start(record, observedLog, faultSolver(bridgeDdsAdapter, 'error'));
  await waitFor(() => expect(host.snapshot(record).running).toBe(false));
  expect(interleaved).toBe(true);
  expect(log.entries().filter(entry => entry.abstention)).toHaveLength(1);
  expect(log.entries()).toHaveLength(2);
  expect(log.counters().silentFallbacks).toBe(0);
});
