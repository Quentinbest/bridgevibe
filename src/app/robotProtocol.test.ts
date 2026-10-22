import { expect, test } from 'vitest';
import { ROBOT_PROTOCOL_VERSION, validRobotResponse } from './robotProtocol';

const provenance = { kind: 'robot', policy: 'bv-basic', version: '1', durationMs: 1 };
const identity = { requestId: '1', playthroughId: 'playthrough-1', positionKey: 'position-1', provenance };
const action = { kind: 'play-card', card: { suit: 'spades', rank: 'A' } };
const decided = { type: 'decided', ...identity, action };
const error = { type: 'error', ...identity, message: 'failed' };
const hello = { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION };

test('§4.3.6: accepts each exact response envelope and optional robot provenance fields', () => {
  for (const response of [hello, error, decided,
    { ...decided, provenance: { ...provenance, ruleId: 'rule-1', fallback: 'engine-failure' } },
    { ...decided, action: { kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' } }]) {
    expect(validRobotResponse(response)).toBe(true);
    expect(validRobotResponse(Object.assign(Object.create(null), response))).toBe(true);
  }
});

test.each([
  { ...hello, extra: true }, { type: 'hello' }, { ...hello, protocolVersion: '3' },
  { ...hello, protocolVersion: NaN }, { ...hello, protocolVersion: 1.5 },
  { ...error, extra: true }, { ...error, message: null }, { ...error, provenance: null },
  { ...decided, requestId: 1 }, { ...decided, playthroughId: null }, { ...decided, positionKey: undefined },
  { ...decided, [Symbol('extra')]: true },
  { ...decided, action: Object.assign(new Date(), action) },
  { ...decided, action: { ...action, card: Object.assign([], action.card) } },
  { ...decided, provenance: Object.assign(new Date(), provenance) },
  ...[
    { policy: '' }, { version: '' }, { ruleId: '' }, { ruleId: undefined }, { fallback: undefined },
    { fallback: 'other' }, { durationMs: NaN }, { durationMs: Infinity }, { durationMs: -1 },
    { [Symbol('extra')]: true },
  ].map(fields => ({ ...decided, provenance: { ...provenance, ...fields } })),
])('US-12.5: rejects malformed envelopes and nested objects: %j', response => {
  expect(validRobotResponse(response)).toBe(false);
});

test('US-12.5: every required response field must be present', () => {
  for (const response of [hello, error, decided]) {
    for (const key of Object.keys(response)) {
      const incomplete: Record<string, unknown> = { ...response };
      delete incomplete[key];
      expect(validRobotResponse(incomplete)).toBe(false);
    }
  }
  for (const key of Object.keys(provenance)) {
    const incomplete: Record<string, unknown> = { ...provenance };
    delete incomplete[key];
    expect(validRobotResponse({ ...decided, provenance: incomplete })).toBe(false);
  }
});
