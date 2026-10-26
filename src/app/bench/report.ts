import { APP_VERSION } from '../appVersion';
import { bridgeDdsEngine } from '../../analysis';
import { dds31Engine, macroxueEngine } from '../../analysis/solverSelection';
import { principlesPolicy, contractChoicePolicy } from '../../robots';
import copy from './methods.json';

export const candidateIds = ['bridge-dds', 'macroxue', 'dds31'] as const;
export type CandidateId = typeof candidateIds[number];
export type Stats = { count: number; p50: number | null; p95: number | null; max: number | null };
// US-43.2: nearest-rank percentiles; no observations are null, never fabricated zeroes.
export function stats(values: readonly number[]): Stats {
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('invalid-measurement');
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
  return { count: sorted.length, p50: at(.5), p95: at(.95), max: at(1) };
}
export type Fallback = { reason: 'timeout' | 'engine-failure'; hidden: boolean; policy?: string };
export function fallbackRates(deals: readonly (readonly Fallback[])[]) {
  const visible = deals.map(events => events.filter(event => !event.hidden));
  const timeoutDeals = visible.filter(events => events.some(event => event.reason === 'timeout')).length;
  return { deals: deals.length, timeoutDeals, timeoutDealShare: deals.length ? timeoutDeals / deals.length : null,
    engineFailureFallbacks: visible.flat().filter(event => event.reason === 'engine-failure').length,
    excludedHiddenFallbacks: deals.flat().filter(event => event.hidden).length };
}
export type Configuration = { positions: number; tables: number; deals: number; coldStarts: number; samples: number };
export const fullConfiguration: Configuration = { positions: 200, tables: 100, deals: 100, coldStarts: 3, samples: 10 };
export const tinyConfiguration: Configuration = { positions: 2, tables: 1, deals: 2, coldStarts: 1, samples: 2 };
export type CandidateReport = {
  id: string; engine: { name: string; version: string }; status: string; progress: string;
  P1: Stats; P2: Stats; P3: Stats; P4: Stats;
  P5: { status: 'measured' | 'unsupported'; longestMs: number | null; tasks: Stats };
  P6: { status: 'measured' | 'unsupported'; method: string; peakBytes: number | null; crashes: string[]; interruption: boolean };
  perLayoutMs: Stats; estimatorMs: Stats; layoutSamples: number;
  fallbacks: ReturnType<typeof fallbackRates>; excludedHiddenTimings: number; completedDeals: number; errors: string[];
  policyFallbacks: { policy: string; rates: ReturnType<typeof fallbackRates> }[];
};
export type Report = {
  schemaVersion: 1; format: 'bridgevibe-device-benchmark'; appVersion: string; createdAt: string;
  device: { label: string; userAgent: string; userAgentData: unknown; conditions: string };
  runtime: { crossOriginIsolated: boolean; secureContext: boolean };
  configuration: Configuration; methods: typeof copy.methods;
  policies: { name: string; version: string }[]; candidates: CandidateReport[];
};
export function newReport(label: string, conditions: string, configuration = fullConfiguration): Report {
  const engines = [bridgeDdsEngine, macroxueEngine, dds31Engine];
  return { schemaVersion: 1, format: 'bridgevibe-device-benchmark', appVersion: APP_VERSION, createdAt: new Date().toISOString(),
    device: { label, conditions, userAgent: navigator.userAgent,
      userAgentData: (navigator as Navigator & { userAgentData?: { toJSON(): unknown } }).userAgentData?.toJSON() ?? null },
    runtime: { crossOriginIsolated: globalThis.crossOriginIsolated, secureContext: globalThis.isSecureContext },
    configuration: { ...configuration }, methods: copy.methods,
    policies: [principlesPolicy, contractChoicePolicy].map(({ name, version }) => ({ name, version })),
    candidates: [...candidateIds, ...Object.keys(copy.unavailable)].map((id, index) => ({ id,
      engine: engines[index] ?? { name: id, version: 'unavailable' },
      status: index < 3 ? 'idle' : Object.values(copy.unavailable)[index - 3], progress: 'idle',
      P1: stats([]), P2: stats([]), P3: stats([]), P4: stats([]),
      P5: { status: 'unsupported', longestMs: null, tasks: stats([]) },
      P6: { status: 'unsupported', method: 'unsupported', peakBytes: null, crashes: [], interruption: false },
      perLayoutMs: stats([]), estimatorMs: stats([]), layoutSamples: 0, fallbacks: fallbackRates([]),
      policyFallbacks: [principlesPolicy, contractChoicePolicy].map(policy => ({ policy: policy.name, rates: fallbackRates([]) })),
      excludedHiddenTimings: 0, completedDeals: 0, errors: [],
    })) };
}

type Check = (value: unknown) => boolean;
const object = (fields: Record<string, Check>): Check => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === Object.keys(fields).length && Object.entries(fields).every(([key, check]) => check(record[key]));
};
const string: Check = v => typeof v === 'string';
const boolean: Check = v => typeof v === 'boolean';
const number: Check = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const integer: Check = v => number(v) && Number.isSafeInteger(v);
const nullable = (check: Check): Check => v => v === null || check(v);
const array = (check: Check): Check => v => Array.isArray(v) && v.every(check);
const choice = (values: unknown[]): Check => v => values.includes(v);
const engine = object({ name: string, version: string });
const statistic: Check = v => {
  if (!object({ count: integer, p50: nullable(number), p95: nullable(number), max: nullable(number) })(v)) return false;
  const s = v as Stats;
  return s.count === 0 ? s.p50 === null && s.p95 === null && s.max === null
    : s.p50 !== null && s.p95 !== null && s.max !== null && s.p50 <= s.p95 && s.p95 <= s.max;
};
const configuration = object(Object.fromEntries(Object.entries(fullConfiguration).map(([key, max]) =>
  [key, (v: unknown) => integer(v) && Number(v) > 0 && Number(v) <= max])));
const rates = object({ deals: integer, timeoutDeals: integer, timeoutDealShare: nullable(v => number(v) && Number(v) <= 1), engineFailureFallbacks: integer, excludedHiddenFallbacks: integer });
export const validReport: (value: unknown) => value is Report = (value): value is Report => {
  const valid = object({ schemaVersion: choice([1]), format: choice(['bridgevibe-device-benchmark']), appVersion: string,
    createdAt: v => string(v) && Number.isFinite(Date.parse(String(v))),
    device: object({ label: string, userAgent: string, userAgentData: v => v === null || typeof v === 'object', conditions: string }),
    runtime: object({ crossOriginIsolated: boolean, secureContext: boolean }), configuration,
    methods: object(Object.fromEntries(Object.keys(copy.methods).map(key => [key, string]))), policies: array(engine),
    candidates: array(object({ id: string, engine, status: choice(['idle', 'running', 'complete', 'failed', 'cancelled', 'interrupted', ...Object.values(copy.unavailable)]), progress: string,
      P1: statistic, P2: statistic, P3: statistic, P4: statistic,
      P5: object({ status: choice(['measured', 'unsupported']), longestMs: nullable(number), tasks: statistic }),
      P6: object({ status: choice(['measured', 'unsupported']), method: string, peakBytes: nullable(number), crashes: array(string), interruption: boolean }),
      perLayoutMs: statistic, estimatorMs: statistic, layoutSamples: integer,
      fallbacks: rates, policyFallbacks: array(object({ policy: string, rates })),
      excludedHiddenTimings: integer, completedDeals: integer, errors: array(string),
    })),
  })(value);
  if (!valid) return false;
  const report = value as Report;
  const ids = [...candidateIds, ...Object.keys(copy.unavailable)];
  return report.candidates.length === ids.length && report.candidates.every((c, i) => c.id === ids[i]
    && (i < 3 ? !Object.values(copy.unavailable).includes(c.status) : c.status === Object.values(copy.unavailable)[i - 3])
    && c.completedDeals === c.fallbacks.deals && c.fallbacks.timeoutDeals <= c.completedDeals
    && c.fallbacks.timeoutDealShare === (c.completedDeals ? c.fallbacks.timeoutDeals / c.completedDeals : null)
    && c.policyFallbacks.length === report.policies.length && c.policyFallbacks.every((p, index) => p.policy === report.policies[index].name
      && p.rates.deals === c.completedDeals && p.rates.timeoutDeals <= c.completedDeals
      && p.rates.timeoutDealShare === (c.completedDeals ? p.rates.timeoutDeals / c.completedDeals : null))
    && (c.P5.status === 'unsupported' ? c.P5.longestMs === null : c.P5.longestMs === (c.P5.tasks.max ?? 0))
    && (c.P6.status === 'unsupported' ? c.P6.peakBytes === null : c.P6.peakBytes !== null));
};
export function exportReport(report: Report): string {
  if (!validReport(report)) throw new Error('invalid-benchmark-report');
  return JSON.stringify(report, null, 2);
}
export const storageKey = 'bridgevibe-device-benchmark-v1';
// NFR-P6: surviving checkpoints identify an interrupted run without claiming its cause.
export function recoverReport(json: string | null): Report | null {
  if (!json) return null;
  try {
    const report: unknown = JSON.parse(json);
    if (!validReport(report)) return null;
    for (const candidate of report.candidates) if (candidate.status === 'running') {
      candidate.status = 'interrupted'; candidate.P6.interruption = true;
    }
    return report;
  } catch { return null; }
}
