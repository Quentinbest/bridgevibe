import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { validateEntry } from '../src/coach/provenance';
import { fullFollowSuit } from '../src/curriculum/content';
import { text } from '../src/explanation';
import { columns, csv, generateReport } from './f5/report';

// VAL-08, US-40.1: validate coverage and reproducibility before publishing teacher inputs.
// #119: two generations take ~21 s alone and ~100 s on a busy machine; headroom, not retries (#87).
test('VAL-08: F5 real composition export is complete and reproducible', async () => {
  const first = await generateReport(), second = await generateReport();
  expect(second).toEqual(first);
  const { entries } = first.json;
  const coach = entries.filter(e => e.outputKind !== 'lesson step');
  expect(coach.length).toBeGreaterThanOrEqual(20);
  expect(coach.filter(e => e.summary === 'hint.advice').length).toBeGreaterThanOrEqual(3);
  expect(coach.some(e => ['hint.forced-card', 'hint.forced-class'].includes(e.summary))).toBe(true);
  expect(new Set(coach.flatMap(e => e.abstention ? [e.abstention.reason] : []))).toEqual(new Set(['not-covered', 'uncertain', 'unavailable']));
  expect(coach.some(e => e.summary === 'hint.not-covered')).toBe(true);
  expect(coach.some(e => e.abstention?.reason === 'unavailable' && e.fault === 'error')).toBe(true);
  expect(new Set(coach.flatMap(e => 'verdict' in e && e.verdict ? [e.verdict] : []))).toEqual(new Set(['sound', 'unlucky', 'lucky', 'mistake']));
  const costs = coach.filter(e => e.outputKind === 'trick cost');
  expect(costs.length).toBeGreaterThanOrEqual(3);
  expect(costs.length).toBeLessThanOrEqual(6);
  const costValues = costs.map(e => (JSON.parse(e.summary) as { cost: number }).cost);
  expect(costValues).toContain(0);
  expect(costValues.some(cost => cost > 0)).toBe(true);
  for (const cost of costs) expect(cost.text).toContain(text('review.hindsight'));
  const alternatives = coach.filter(e => e.summary === 'moment.alternative');
  expect(alternatives.length).toBeGreaterThanOrEqual(1);
  for (const alternative of alternatives) {
    expect(alternative.informationMode).toBe('VISIBLE');
    expect(alternative.visibleContext).not.toContain('ALL_HANDS');
    expect(alternative.text).toMatch(/^An acceptable option with what you could see: /);
  }
  for (const verdict of ['sound', 'unlucky', 'lucky', 'mistake'] as const) {
    const label = coach.find(e => e.summary === `moment.${verdict}`);
    expect(label?.outputKind).toBe('moment label');
    expect(label?.text).toBe(`${text(`moment.${verdict}`)} ${text('review.hindsight')}`);
  }
  expect(coach.some(e => e.outputKind === 'sampled quality' && e.provenance.sourceKind === 'engine' && e.provenance.sampled)).toBe(true);
  expect(entries.filter(e => e.outputKind === 'lesson step')).toHaveLength(fullFollowSuit.exercises.reduce((n, e) => n + e.steps.length, 0));
  expect(new Set(entries.map(e => e.id)).size).toBe(entries.length);
  for (const [index, entry] of entries.entries()) {
    expect(validateEntry(entry), entry.ref).toEqual([]);
    expect(entry.ref).toBe(`F5-${String(index + 1).padStart(2, '0')}`);
    expect(entry.grade).toBeNull(); expect(entry.graderNote).toBeNull();
    expect(entry.text).not.toMatch(/\{\w+\}/);
    if (entry.informationMode === 'VISIBLE') expect(entry.visibleContext).not.toContain('ALL_HANDS remaining cards');
    else { expect(entry.visibleContext).toContain('ALL_HANDS remaining cards'); expect(entry.visibleContext).toContain('Reviewed play:'); }
    for (const label of ['Contract:', "Learner's seat:", 'Own hand:', 'Dummy:', 'Announcements:', 'Tricks so far:', 'Current trick:']) expect(entry.visibleContext).toContain(label);
  }
  expect(columns).toHaveLength(15);
  expect(csv([['a,b', '"quoted"', 'line\nbreak']])).toBe('"a,b","""quoted""","line\nbreak"\r\n');
  expect(first.sheet).not.toMatch(/durationMs|exportedAt|exceededTarget/);
  if (process.env.F5_REPORT === '1') {
    const dir = new URL('../docs/reports/f5/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('f5-outputs.json', dir), JSON.stringify(first.json, null, 2) + '\n');
    writeFileSync(new URL('f5-sheet.csv', dir), first.sheet);
    writeFileSync(new URL('README.md', dir), first.readme);
  }
}, 180_000);
