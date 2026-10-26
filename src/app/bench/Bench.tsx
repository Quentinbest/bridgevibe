import { useEffect, useRef, useState } from 'react';
import { candidateIds, exportReport, newReport, recoverReport, storageKey, type CandidateId, type Report } from './report';
import { runBench } from './run';
import methods from './methods.json';
import { text } from '../../explanation';
import './bench.css';

// US-43: a unique production-exclusion sentinel, also identifying report UI in browser checks.
const marker = 'bridgevibe-device-bench-T2-v1';
export default function Bench() {
  const [report, setReport] = useState<Report | null>(() => {
    try { return recoverReport(localStorage.getItem(storageKey)); } catch { return null; }
  });
  const [label, setLabel] = useState('');
  const [conditions, setConditions] = useState('');
  const [candidate, setCandidate] = useState<CandidateId>('bridge-dds');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const control = useRef<AbortController | null>(null);
  useEffect(() => () => control.current?.abort(), []);
  async function run(ids: readonly CandidateId[]) {
    if (control.current) return;
    const controller = new AbortController(); control.current = controller;
    setRunning(true); setError('');
    try {
      const next = newReport(label, conditions);
      localStorage.setItem(storageKey, exportReport(next));
      await runBench(next, ids, controller.signal, setReport);
    } catch { setError(text('bench.storageError')); }
    finally { control.current = null; setRunning(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([exportReport(report)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `bench-${report.createdAt.replaceAll(':', '-')}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="bench" data-bench={marker}>
    <h1>{text('bench.title')}</h1><p>{text('bench.notice')}</p>
    <label>{text('bench.label')}<input value={label} disabled={running} onChange={event => setLabel(event.target.value)} /></label>
    <label>{text('bench.conditions')}<input value={conditions} disabled={running} onChange={event => setConditions(event.target.value)} /></label>
    <label>{text('bench.candidate')}<select value={candidate} disabled={running} onChange={event => setCandidate(event.target.value as CandidateId)}>
      {candidateIds.map(id => <option key={id} value={id}>{String(id)}</option>)}
    </select></label>
    <div className="bench-buttons">
      <button disabled={running} onClick={() => void run(candidateIds)}>{text('bench.runAll')}</button>
      <button disabled={running} onClick={() => void run([candidate])}>{text('bench.run')}</button>
      <button disabled={!running} onClick={() => control.current?.abort()}>{text('bench.cancel')}</button>
      <button disabled={!report} onClick={download}>{text('bench.download')}</button>
    </div>
    <p role="alert">{error}</p>
    <div role="status" aria-live="polite">{report ? report.candidates.map(item =>
      <p key={item.id}>{[item.id, item.status, item.progress].join(':')}</p>) : text('bench.idle')}</div>
    {!report && Object.entries(methods.unavailable).map(([id, status]) => <p key={id}>{[id, status].join(':')}</p>)}
    {Object.entries(methods.methods).map(([id, description]) => <p key={id}><strong>{id}</strong>{': '}{description}</p>)}
    {report && <pre>{exportReport(report)}</pre>}
  </main>;
}
