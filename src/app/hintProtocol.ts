import { RANKS, SUITS, sameCard, type Card, type SeatViewMessage } from '../table';
import type { HintResult } from '../analysis/sampledEstimate';
// ADR-0001, US-41.3: no record capability crosses this versioned boundary.
export const HINT_PROTOCOL_VERSION = 1;
export type HintRequest = { type: 'hint'; requestId: number; view: SeatViewMessage; candidates: readonly Card[]; seed: string; deadline: number };
// §4.3.6, CI-5: the worker reports the engine and sampler that actually produced the result.
export type HintSource = { engine: { name: string; version: string }; sampler: { name: string; version: string } };
export type HintResponse = { type: 'hello'; protocolVersion: number } | { type: 'result'; requestId: number; result: HintResult; source: HintSource };

type Check = (value: unknown) => boolean;
const exact = (fields: Record<string, Check>): Check => value => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === Object.keys(fields).length
  && Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check((value as Record<string, unknown>)[key]));
const causes = ['timeout', 'error', 'worker-crash', 'protocol-mismatch'];
// US-12.5, US-45.1: untrusted worker data must be complete before it reaches rendering or provenance;
// every advised card must be one of the candidates this client sent.
export function validHintResponse(value: unknown, candidates: readonly Card[]): value is HintResponse {
  const card: Check = c => exact({ suit: s => SUITS.includes(s as Card['suit']), rank: r => RANKS.includes(r as Card['rank']) })(c)
    && candidates.some(candidate => sameCard(candidate, c as Card));
  const cardClass = exact({ cards: cs => Array.isArray(cs) && cs.length > 0 && cs.every(card),
    tricks: n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 13 });
  const result: Check = r => exact({ classes: cs => Array.isArray(cs) && cs.length > 0 && cs.every(cardClass),
    sampleCount: n => Number.isSafeInteger(n) && (n as number) > 0, enumerated: b => typeof b === 'boolean' })(r)
    || exact({ abstention: a => exact({ reason: x => x === 'uncertain', cause: x => x === 'constraints' })(a)
      || exact({ reason: x => x === 'unavailable', cause: x => causes.includes(x as string) })(a),
    sampleCount: n => n === 0, enumerated: b => b === false })(r);
  const identity = exact({ name: s => typeof s === 'string' && s.trim().length > 0, version: s => typeof s === 'string' && s.trim().length > 0 });
  const source = exact({ engine: identity, sampler: identity });
  return exact({ type: x => x === 'hello', protocolVersion: n => Number.isSafeInteger(n) })(value)
    || exact({ type: x => x === 'result', requestId: n => Number.isSafeInteger(n), result, source })(value);
}
