// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ReviewScreen } from './ReviewScreen';
import { reviewSampling } from './reviewSampling';
import { sampledPractice } from '../../test/sampledPractice';
import { validateEntry } from '../coach/provenance';
import DebugPanel from './DebugPanel';
import { createPlay } from './play';
import { sampledQuality } from '../coach/sampledQuality';
import { assessDecisions } from '../coach/decisionAssessment';
import type { TrickCost } from '../coach/trickCost';

vi.mock('./reviewSampling', () => ({ reviewSampling: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
test('CI-5: displayed sampled quality is VISIBLE and logged once across reopening, with separate ALL_HANDS outcomes', async () => {
  const record = sampledPractice();
  const cost: TrickCost = { positionIndex: assessDecisions(record, [])[0].positionIndex, cost: 1, candidatesDiffered: true,
    statement: { id: 'cost', playthroughId: record.playthroughId, positionIndex: 0, kind: 'statement', summary: 'cost', text: 'X-ray cost',
      informationMode: 'ALL_HANDS', at: '2026-10-25T00:00:00Z',
      provenance: { sourceKind: 'engine', name: 'test', version: '1', mode: 'ALL_HANDS', sampleCount: 0 } } };
  const initial = assessDecisions(record, [cost]);
  const quality = sampledQuality(initial[0], { classes: [{ cards: [initial[0].card], tricks: 2 }], sampleCount: 50, enumerated: false },
    { sourceKind: 'engine', name: 'engine', version: '1', mode: 'VISIBLE', sampleCount: 50,
      sampled: { qualitySource: 'sampled', seed: 'digest', seedDerivation: 'seatViewSeed', sampler: 'bv-layout', samplerVersion: '1', enumerated: false } }, false);
  let resolve!: (decisions: typeof initial) => void;
  vi.mocked(reviewSampling).mockReturnValue(new Promise(done => { resolve = done; }));
  const play = createPlay();
  const log = play.provenanceLog;
  const props = { record, analysis: { running: false, costs: [cost] }, provenanceLog: log, onBack() {} };
  const ui = <><ReviewScreen {...props} /><DebugPanel play={play} /></>;
  const mounted = render(ui);
  expect(screen.getByRole('status').textContent).toContain('Checking your choices');
  await act(async () => resolve([quality, ...initial.slice(1)]));
  expect(screen.queryByRole('status')).toBeNull();
  expect(document.querySelector('.moment-quality')!.textContent).toContain('Decision quality: acceptable on the cards');
  expect(screen.getByTestId('provenance-debug-panel').textContent).toContain('"qualitySource": "sampled"');
  const qualityEntries = () => log.entries().filter(e => e.id.startsWith('sampled-quality-'));
  expect(qualityEntries()).toHaveLength(1);
  expect(qualityEntries()[0]).toMatchObject({ informationMode: 'VISIBLE', provenance: quality.sampling });
  expect(log.entries().filter(e => e.summary.endsWith('-sentence')).every(e => e.informationMode === 'ALL_HANDS')).toBe(true);
  expect(log.entries().every(e => validateEntry(e).length === 0)).toBe(true);
  mounted.unmount();
  await act(async () => { render(ui); });
  expect(qualityEntries()).toHaveLength(1);
});
