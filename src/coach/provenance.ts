import { HINT_DEADLINE_MS } from '../information/parameters';
import { REASON_CODES, type ReasonCode, type RobotProvenance } from '../table';

export type AnalysisCause = 'timeout' | 'error' | 'worker-crash' | 'protocol-mismatch';
export type Abstention = { reason: 'not-covered'; cause: 'no-authored-hint' } | { reason: 'unavailable'; cause: AnalysisCause } | { reason: 'uncertain'; cause: 'constraints' };
export type InformationMode = 'VISIBLE' | 'ALL_HANDS';
export type Provenance =
  | { sourceKind: 'authored'; contentId: string; version: string }
  | { sourceKind: 'bidding-rule'; ruleId: string; profileVersion: string }
  | { sourceKind: 'engine'; name: string; version: string; mode: InformationMode; sampleCount: number; hint?: { sampler: string; samplerVersion: string; enumerated: boolean; templateId: string; durationMs: number; exceededTarget: boolean } }
  | { sourceKind: 'template'; templateId: string }
  | ({ sourceKind: 'table' } & ({ rulesCoreVersion: string; reasonCode?: ReasonCode } | { reasonCode: ReasonCode; rulesCoreVersion?: string }))
  | ({ sourceKind: 'robot' } & RobotProvenance);
export type LogEntry = {
  id: string; playthroughId: string; positionIndex: number; kind: 'statement' | 'robot-action';
  abstention?: Abstention;
  summary: string; text?: string; informationMode: InformationMode; provenance: Provenance; at: string;
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const mode = (value: unknown) => value === 'VISIBLE' || value === 'ALL_HANDS';
const integer = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;

// US-40.1: validate at the recording seam so incomplete outputs fail composition checks.
export function validateEntry(entry: unknown): string[] {
  if (!object(entry)) return ['entry'];
  const errors: string[] = [];
  for (const key of ['id', 'playthroughId', 'summary', 'at']) if (!nonempty(entry[key])) errors.push(key);
  if (!nonempty(entry.at) || !Number.isFinite(Date.parse(entry.at))) errors.push('at.timestamp');
  if (!integer(entry.positionIndex)) errors.push('positionIndex');
  if (entry.kind !== 'statement' && entry.kind !== 'robot-action') errors.push('kind');
  if (entry.kind === 'statement' && !nonempty(entry.text)) errors.push('text');
  if (entry.text !== undefined && !nonempty(entry.text)) errors.push('text');
  if (!mode(entry.informationMode)) errors.push('informationMode');
  if (entry.abstention !== undefined) {
    const a = entry.abstention;
    if (!object(a) || !((a.reason === 'not-covered' && a.cause === 'no-authored-hint') || (a.reason === 'uncertain' && a.cause === 'constraints') || (a.reason === 'unavailable' && ['timeout', 'error', 'worker-crash', 'protocol-mismatch'].includes(String(a.cause))))) errors.push('abstention');
    if (entry.kind !== 'statement') errors.push('abstention.kind');
  }
  const p = entry.provenance;
  if (!object(p)) return [...errors, 'provenance'];
  // US-14.11: forced plays and uncovered Setup use VISIBLE templates without an engine.
  const templateHint = p.sourceKind === 'template' && p.templateId === entry.summary
    && ['hint.forced-card', 'hint.forced-class', 'hint.not-covered'].includes(String(entry.summary)) && entry.informationMode === 'VISIBLE';
  if (typeof entry.summary === 'string' && entry.summary.startsWith('hint.')
    && (p.sourceKind === 'engine' ? !object(p.hint) : !(templateHint || (p.sourceKind === 'authored' && entry.informationMode === 'VISIBLE')))) errors.push('provenance.hint');
  // US-14.11: forced plays bypass sampling, so their templates never carry engine provenance.
  if (['hint.forced-card', 'hint.forced-class', 'hint.not-covered'].includes(String(entry.summary)) && p.sourceKind !== 'template') errors.push('provenance.template');
  // INV-7: a not-covered template is itself an abstention and must carry its reason and cause.
  if (entry.summary === 'hint.not-covered' && !(object(entry.abstention) && entry.abstention.reason === 'not-covered')) errors.push('abstention.not-covered');
  // US-14.11: not-covered belongs only to the uncovered contract-choice template; engines abstain
  // only as uncertain or unavailable.
  if (object(entry.abstention)) {
    const notCovered = entry.abstention.reason === 'not-covered';
    const template = p.sourceKind === 'template' && entry.summary === 'hint.not-covered' && p.templateId === 'hint.not-covered';
    if (notCovered ? !template : p.sourceKind !== 'engine') errors.push('abstention.provenance');
  }
  const fields = (...keys: string[]) => { for (const key of keys) if (!nonempty(p[key])) errors.push(`provenance.${key}`); };
  switch (p.sourceKind) {
    case 'authored': fields('contentId', 'version'); break;
    case 'bidding-rule': fields('ruleId', 'profileVersion'); break;
    case 'engine':
      fields('name', 'version');
      if (!mode(p.mode) || p.mode !== entry.informationMode) errors.push('provenance.mode');
      if (!integer(p.sampleCount)) errors.push('provenance.sampleCount');
      if (p.hint !== undefined) {
        const h = p.hint;
        if (!object(h) || !['sampler', 'samplerVersion', 'templateId'].every(key => nonempty(h[key]))
          || typeof h.enumerated !== 'boolean' || typeof h.durationMs !== 'number' || !Number.isFinite(h.durationMs) || h.durationMs < 0
          || h.exceededTarget !== (h.durationMs > HINT_DEADLINE_MS) || entry.informationMode !== 'VISIBLE') errors.push('provenance.hint');
      }
      break;
    case 'template': fields('templateId'); break;
    case 'table':
      if (!nonempty(p.rulesCoreVersion) && !REASON_CODES.some(code => code === p.reasonCode)) errors.push('provenance.table');
      if (p.rulesCoreVersion !== undefined) fields('rulesCoreVersion');
      if (p.reasonCode !== undefined && !REASON_CODES.some(code => code === p.reasonCode)) errors.push('provenance.reasonCode');
      break;
    case 'robot':
      fields('policy', 'version');
      if (p.ruleId !== undefined) fields('ruleId');
      if (p.kind !== 'robot') errors.push('provenance.kind');
      if (typeof p.durationMs !== 'number' || !Number.isFinite(p.durationMs) || p.durationMs < 0) errors.push('provenance.durationMs');
      if (p.fallback !== undefined && p.fallback !== 'timeout' && p.fallback !== 'engine-failure') errors.push('provenance.fallback');
      break;
    default: errors.push('provenance.sourceKind');
  }
  if ((entry.kind === 'robot-action') !== (p.sourceKind === 'robot')) errors.push('provenance.entryKind');
  return errors;
}

// A-05, U-07: memory only; callers receive independent snapshots, including exports.
export function createProvenanceLog(appVersion = 'development') {
  const entries: LogEntry[] = [];
  let hiddenCardsInVisibleInputs = 0;
  let silentFallbacks = 0;
  const analysisFailures = new Set<string>();
  return {
    record(entry: LogEntry) {
      const errors = validateEntry(entry);
      if (errors.length) throw new Error(`Incomplete provenance: ${errors.join(', ')}`);
      if (entries.some(existing => existing.id === entry.id)) throw new Error('Duplicate provenance id');
      entries.push(structuredClone(entry));
      if (entry.abstention) analysisFailures.delete(entry.id);
      if (entry.provenance.sourceKind === 'robot' && entry.provenance.policy === 'bv-fallback' && !entry.provenance.fallback) silentFallbacks++;
    },
    entries: () => structuredClone(entries),
    hiddenCardFound() { hiddenCardsInVisibleInputs++; },
    // VAL-06: failures remain counted until a validated abstention accounts for them.
    analysisFailed(id: string) { analysisFailures.add(id); },
    counters: () => ({ hiddenCardsInVisibleInputs, silentFallbacks: silentFallbacks + analysisFailures.size }),
    export: () => ({ schemaVersion: 1 as const, format: 'bridgevibe-f5' as const, exportedAt: new Date().toISOString(), appVersion,
      entries: structuredClone(entries).map(entry => ({ ...entry, grade: null, graderNote: null })) }),
  };
}
