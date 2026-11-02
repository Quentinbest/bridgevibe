import { expect, test } from 'vitest';
import type { LogEntry } from '../src/coach/provenance';
import { integrityViolations } from './f5/integrity';

const catalogue = {
  plain: { text: 'Plain' },
  tagged: { text: 'Tagged', integrity: true as const },
  'review.hindsight': { text: 'All cards visible' },
  'review.cost-description': { text: 'Cost: {cost}', integrity: true as const },
};
const statement: LogEntry = {
  id: 'statement', playthroughId: 'playthrough', positionIndex: 0, kind: 'statement',
  summary: 'plain', text: 'Plain', informationMode: 'VISIBLE', at: '2026-10-26T00:00:00.000Z',
  provenance: { sourceKind: 'template', templateId: 'plain' },
};

test('I18N-14: reports untagged engine, abstention, hindsight and verdict templates and unmapped summaries', () => {
  expect(integrityViolations([
    { ...statement, ref: 'engine', provenance: { sourceKind: 'engine', name: 'engine', version: '1', mode: 'VISIBLE', sampleCount: 1 } },
    { ...statement, id: 'abstention', abstention: { reason: 'uncertain', cause: 'constraints' } },
    { ...statement, id: 'hindsight', summary: 'tagged', informationMode: 'ALL_HANDS', text: 'Tagged All cards visible' },
    { ...statement, id: 'verdict', verdict: 'sound' },
    { ...statement, id: 'unmapped', summary: 'unknown', informationMode: 'ALL_HANDS' },
  ], catalogue)).toEqual([
    'engine: plain is not tagged integrity',
    'abstention: plain is not tagged integrity',
    'hindsight: review.hindsight is not tagged integrity',
    'verdict: plain is not tagged integrity',
    'unmapped: no catalogue template for unknown',
  ]);
});

test('I18N-14: accepts ordinary VISIBLE statements, tagged templates and mapped trick costs', () => {
  expect(integrityViolations([
    statement,
    { ...statement, summary: 'unknown' },
    { ...statement, kind: 'robot-action', informationMode: 'ALL_HANDS' },
    { ...statement, summary: 'tagged', verdict: 'sound' },
    { ...statement, summary: '{"cost":2}', outputKind: 'trick cost', informationMode: 'ALL_HANDS' },
  ], catalogue)).toEqual([]);
});
