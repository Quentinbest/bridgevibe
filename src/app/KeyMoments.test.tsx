// @vitest-environment jsdom
import { completedRecord } from '../table';
import { completeFixedDeal } from '../../test/strategy';
import { StrictMode } from 'react';
import { createProvenanceLog, validateEntry } from '../coach/provenance';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ReviewScreen } from './ReviewScreen';
import { KeyMoments } from './KeyMoments';
import { assessDecisions } from '../coach/decisionAssessment';
import { f4Position, finish, points } from '../../test/f4/records';
import { text } from '../explanation';
import type { TrickCost } from '../coach/trickCost';

const cost: TrickCost = { positionIndex: 4, cost: 1, statement: { id: 'test-cost', playthroughId: 'test', positionIndex: 4,
  kind: 'statement', summary: 'cost', text: text('review.cost-description', { cost: 1, name: 'test', version: '1' }),
  informationMode: 'ALL_HANDS', at: '2026-10-25T00:00:00Z',
  provenance: { sourceKind: 'engine', name: 'test', version: '1', mode: 'ALL_HANDS', sampleCount: 0 } } };
afterEach(cleanup);
test('US-18: review renders labelled card, badge, hindsight and accessible trick marker', () => {
  const record = finish(f4Position(points[1]), points[1].candidates[3].cards[0]);
  const { rerender } = render(<ReviewScreen record={record} analysis={{ running: false, costs: [cost] }} onBack={() => {}} />);
  expect(screen.getByRole('region', { name: '1 big moments' }).textContent).toContain('Better option');
  expect(screen.getByRole('heading', { name: 'Trick 2 · you played 8 of hearts' })).toBeTruthy();
  expect(document.querySelector('.key-moment')!.textContent).toContain(text('review.hindsight'));
  fireEvent.click(screen.getByRole('button', { name: 'Trick 2, big moment' }));
  expect(screen.getByRole('heading', { name: 'Trick 2 of 13' })).toBeTruthy();
  expect(document.querySelector('.moment-alternative')).toBeNull();
  rerender(<ReviewScreen record={record} analysis={{ running: false, costs: [] }} onBack={() => {}} />);
  expect(screen.getByRole('region', { name: '0 big moments' })).toBeTruthy();
  expect(screen.queryByText('Better option')).toBeNull();
});
test('US-18.6, CI-8: every verdict has an icon and text; lucky copy is not praise', () => {
  const record = finish(f4Position(points[1]), points[1].candidates[3].cards[0]);
  const base = assessDecisions(record, [cost]).find(d => d.positionIndex === 4)!;
  const moments = (['sound', 'unlucky', 'lucky', 'mistake'] as const).map((verdict, positionIndex) => ({ ...base, verdict, positionIndex }));
  render(<KeyMoments moments={moments} />);
  expect([...document.querySelectorAll('.moment-badge')].map(b => b.textContent)).toEqual(['✓Solid', '⚖Good call, bad luck', '↯Worked this time', '↻Better option']);
  expect(document.querySelectorAll('.moment-badge [aria-hidden="true"]')).toHaveLength(4);
  expect(text('moment.lucky-sentence')).toContain('supported a better choice');
  expect(text('moment.lucky-sentence')).not.toMatch(/smart|great|well done|good choice/i);
});

test('CI-5: key-moment statements validate and log once across rerenders, StrictMode and reopening', () => {
  const record = finish(f4Position(points[1]), points[1].candidates[3].cards[0]);
  const log = createProvenanceLog();
  const review = () => <StrictMode><ReviewScreen record={record} provenanceLog={log}
    analysis={{ running: false, costs: [{ ...cost }] }} onBack={() => {}} /></StrictMode>;
  const { rerender, unmount } = render(review());
  const entries = log.entries();
  expect(entries).toHaveLength(4);
  expect(entries.map(entry => entry.summary)).toEqual(['moment.mistake', 'moment.mistake-sentence', 'moment.alternative', 'review.cost-description']);
  for (const entry of entries) {
    expect(validateEntry(entry)).toEqual([]);
    expect(entry.playthroughId).toBe(record.playthroughId);
    expect(entry.positionIndex).toBe(4);
    expect(entry.provenance).toMatchObject({ templateId: entry.summary,
      quality: { contentId: 'D02-C04', source: 'ai', version: 'f4-draft' }, outcome: cost.statement.provenance });
    expect(entry.informationMode).toBe(entry.summary === 'moment.alternative' ? 'VISIBLE' : 'ALL_HANDS');
    if (entry.informationMode === 'ALL_HANDS') expect(entry.text).toContain(text('review.hindsight'));
  }
  rerender(review());
  fireEvent.click(screen.getByRole('button', { name: 'Trick 2, big moment' }));
  expect(log.entries()).toEqual(entries);
  unmount(); render(review());
  expect(log.entries()).toEqual(entries);
  expect(log.export().entries).toHaveLength(4);
});


test('US-18.4, CI-5: only displayed uncertain statements are logged, once, with no-label provenance', () => {
  const record = completedRecord(completeFixedDeal());
  const decisions = assessDecisions(record, []);
  expect(decisions.every(decision => decision.quality === 'uncertain')).toBe(true);
  const costs = decisions.map(decision => ({ ...cost, positionIndex: decision.positionIndex,
    statement: { ...cost.statement, positionIndex: decision.positionIndex, playthroughId: record.playthroughId } }));
  const log = createProvenanceLog();
  const review = (available = costs) => <StrictMode><ReviewScreen record={record} provenanceLog={log}
    analysis={{ running: false, costs: available.map(item => ({ ...item })) }} onBack={() => {}} /></StrictMode>;
  const { rerender, unmount } = render(review([]));
  expect(screen.queryAllByText(text('moment.uncertain'))).toHaveLength(0);
  expect(log.entries()).toEqual([]);
  rerender(review());
  const seen: number[] = [];
  for (let trick = 1; trick <= 13; trick++) {
    if (trick > 1) fireEvent.click(screen.getByRole('button', { name: `Trick ${trick}` }));
    const displayed = decisions.filter(decision => decision.trick === trick).map(decision => decision.positionIndex);
    expect(screen.queryAllByText(text('moment.uncertain'))).toHaveLength(displayed.length);
    seen.push(...displayed);
    expect(log.entries().map(entry => entry.positionIndex)).toEqual(seen);
    rerender(review());
    expect(log.entries()).toHaveLength(seen.length);
  }
  const entries = log.entries();
  expect(entries.length).toBeGreaterThan(1);
  for (const entry of entries) {
    expect(validateEntry(entry)).toEqual([]);
    expect(entry).toMatchObject({ playthroughId: record.playthroughId, informationMode: 'VISIBLE',
      summary: 'moment.uncertain', text: text('moment.uncertain'), abstention: { reason: 'uncertain', cause: 'no-label' },
      provenance: { sourceKind: 'template', templateId: 'moment.uncertain', quality: { source: 'no-label' },
        outcome: cost.statement.provenance } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Trick 1' }));
  expect(log.entries()).toEqual(entries);
  unmount(); render(review());
  expect(log.entries()).toEqual(entries);
  expect(log.export().entries.map(entry => entry.id)).toEqual(entries.map(entry => entry.id));
  const entry = entries[0];
  expect(validateEntry({ ...entry, provenance: { ...entry.provenance, quality: { source: 'ai' } } })).toContain('provenance.quality');
  expect(validateEntry({ ...entry, provenance: { ...entry.provenance, outcome: { sourceKind: 'engine' } } })).toContain('provenance.outcome');
});
