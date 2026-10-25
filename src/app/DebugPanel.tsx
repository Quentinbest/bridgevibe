import { useState, useSyncExternalStore } from 'react';
import { SEATS, type Seat } from '../table';
import { text } from '../explanation';
import type { createPlay } from './play';

export default function DebugPanel({ play }: { play: ReturnType<typeof createPlay> }) {
  useSyncExternalStore(play.provenanceLog.subscribe, play.provenanceLog.revision);
  const [seat, setSeat] = useState<Seat>('east');
  const [showSeat, setShowSeat] = useState(false);
  const counters = play.provenanceLog.counters();
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(play.provenanceLog.export(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'bridgevibe-f5.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <aside className="debug-panel" data-testid="provenance-debug-panel" aria-labelledby="provenance-title">
    <h2 id="provenance-title">{text('debug.title')}</h2>
    <p className="debug-badge">{text('debug.internal')}</p>
    <dl className="debug-counters">
      <div><dt>{text('debug.hidden')}</dt><dd>{counters.hiddenCardsInVisibleInputs}</dd></div>
      <div><dt>{text('debug.fallbacks')}</dt><dd>{counters.silentFallbacks}</dd></div>
    </dl>
    {play.getSnapshot().hint?.durationMs != null && <p>{text('debug.hint-latency', { duration: play.getSnapshot().hint!.durationMs!, exceeded: String(play.getSnapshot().hint!.exceededTarget) })}</p>}
    {play.hintTimings().length > 0 && <pre>{JSON.stringify(play.hintTimings(), null, 2)}</pre>}
    <ol tabIndex={0} aria-label={text('debug.entries')}>{play.provenanceLog.entries().reverse().map(entry => <li key={entry.id}>
      <p>{entry.text ?? entry.summary}</p>
      <dl>
        <dt>{text('debug.mode')}</dt><dd>{text('debug.value', { value: entry.informationMode })}</dd>
        <dt>{text('debug.source')}</dt><dd>{text('debug.value', { value: entry.provenance.sourceKind })}</dd>
      </dl>
      <pre>{JSON.stringify({ ...entry.provenance, ...(entry.abstention ? { abstention: entry.abstention } : {}) }, null, 2)}</pre>
    </li>)}</ol>
    <button type="button" onClick={download}>{text('debug.export')}</button>
    <div><label htmlFor="debug-seat">{text('debug.seat')}</label><select id="debug-seat" value={seat} onChange={event => { setSeat(event.target.value as Seat); setShowSeat(true); }}>
      {SEATS.map(value => <option key={value} value={value}>{text(`seat.${value}`)}</option>)}
    </select></div>
    <button type="button" aria-expanded={showSeat} aria-controls="debug-seat-view" onClick={() => setShowSeat(value => !value)}>{text('debug.show')}</button>
    {/* ADR-0001, US-40.2: this deliberately exposes hidden cards; the panel is restricted to internal builds. */}
    {showSeat && <pre id="debug-seat-view">{JSON.stringify(play.seatView(seat), null, 2)}</pre>}
  </aside>;
}
