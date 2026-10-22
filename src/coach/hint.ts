import type { HintResult } from '../analysis/sampledEstimate';
import { sampler } from '../information/parameters';
import { HINT_DEADLINE_MS } from '../information/parameters';
import type { LogEntry } from './provenance';
// US-14.3, CI-5: rendering is supplied by the catalogue at composition, never invented by an engine.
export function hintStatement(result: HintResult, engine: { name: string; version: string }, durationMs: number,
  rendered: { text: string; templateId: string }, usedSampler: { name: string; version: string } = sampler): Pick<LogEntry, 'kind' | 'summary' | 'text' | 'provenance' | 'abstention'> {
  return { kind: 'statement', summary: rendered.templateId, text: rendered.text,
    ...('abstention' in result ? { abstention: result.abstention } : {}),
    provenance: { sourceKind: 'engine', ...engine, mode: 'VISIBLE', sampleCount: result.sampleCount,
      hint: { sampler: usedSampler.name, samplerVersion: usedSampler.version, enumerated: result.enumerated, templateId: rendered.templateId,
        durationMs, exceededTarget: durationMs > HINT_DEADLINE_MS } } };
}
