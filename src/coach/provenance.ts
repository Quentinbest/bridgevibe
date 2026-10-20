import { REASON_CODES, type ReasonCode, type RobotProvenance } from '../table';

export type InformationMode = 'VISIBLE' | 'ALL_HANDS';
export type Provenance =
  | { sourceKind: 'authored'; contentId: string; version: string }
  | { sourceKind: 'bidding-rule'; ruleId: string; profileVersion: string }
  | { sourceKind: 'engine'; name: string; version: string; mode: InformationMode; sampleCount: number }
  | { sourceKind: 'template'; templateId: string }
  | ({ sourceKind: 'table' } & ({ rulesCoreVersion: string; reasonCode?: ReasonCode } | { reasonCode: ReasonCode; rulesCoreVersion?: string }))
  | ({ sourceKind: 'robot' } & RobotProvenance);
export type LogEntry = {
  id: string; playthroughId: string; positionIndex: number; kind: 'statement' | 'robot-action';
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
  const p = entry.provenance;
  if (!object(p)) return [...errors, 'provenance'];
  const fields = (...keys: string[]) => { for (const key of keys) if (!nonempty(p[key])) errors.push(`provenance.${key}`); };
  switch (p.sourceKind) {
    case 'authored': fields('contentId', 'version'); break;
    case 'bidding-rule': fields('ruleId', 'profileVersion'); break;
    case 'engine':
      fields('name', 'version');
      if (!mode(p.mode) || p.mode !== entry.informationMode) errors.push('provenance.mode');
      if (!integer(p.sampleCount)) errors.push('provenance.sampleCount');
      break;
    case 'template': fields('templateId'); break;
    case 'table':
      if (!nonempty(p.rulesCoreVersion) && !REASON_CODES.some(code => code === p.reasonCode)) errors.push('provenance.table');
      if (p.rulesCoreVersion !== undefined) fields('rulesCoreVersion');
      if (p.reasonCode !== undefined && !REASON_CODES.some(code => code === p.reasonCode)) errors.push('provenance.reasonCode');
      break;
    case 'robot':
      fields('policy', 'version');
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
  return {
    record(entry: LogEntry) {
      const errors = validateEntry(entry);
      if (errors.length) throw new Error(`Incomplete provenance: ${errors.join(', ')}`);
      if (entries.some(existing => existing.id === entry.id)) throw new Error('Duplicate provenance id');
      entries.push(structuredClone(entry));
      if (entry.provenance.sourceKind === 'robot' && entry.provenance.policy === 'bv-fallback' && !entry.provenance.fallback) silentFallbacks++;
    },
    entries: () => structuredClone(entries),
    hiddenCardFound() { hiddenCardsInVisibleInputs++; },
    counters: () => ({ hiddenCardsInVisibleInputs, silentFallbacks }),
    export: () => ({ schemaVersion: 1 as const, format: 'bridgevibe-f5' as const, exportedAt: new Date().toISOString(), appVersion,
      entries: structuredClone(entries).map(entry => ({ ...entry, grade: null, graderNote: null })) }),
  };
}
