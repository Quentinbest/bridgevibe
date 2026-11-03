import type { LogEntry } from '../../src/coach/provenance';
import type { Entry } from '../../src/explanation';

type IntegrityEntry = Pick<LogEntry, 'id' | 'kind' | 'summary' | 'text' | 'informationMode' | 'provenance' | 'abstention'>
  & { ref?: string; outputKind?: string; verdict?: string };

// I18N-14, CI-1–3: check every template composing a certainty-sensitive statement.
export function integrityViolations(entries: readonly IntegrityEntry[], catalogue: Readonly<Record<string, Pick<Entry, 'text' | 'integrity'>>>): string[] {
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'statement' || !(entry.abstention || entry.informationMode === 'ALL_HANDS'
      || entry.provenance.sourceKind === 'engine' || entry.verdict !== undefined)) continue;
    const ref = entry.ref ?? entry.id;
    const keys = new Set<string>();
    const key = entry.outputKind === 'trick cost' ? 'review.cost-description' : entry.summary;
    if (Object.hasOwn(catalogue, key)) keys.add(key);
    const hindsight = catalogue['review.hindsight']?.text;
    if (hindsight && entry.text?.includes(hindsight)) keys.add('review.hindsight');
    if (!keys.size) found.push(`${ref}: no catalogue template for ${entry.summary}`);
    for (const key of keys) {
      if (catalogue[key]?.integrity !== true) found.push(`${ref}: ${key} is not tagged integrity`);
    }
  }
  return found;
}
