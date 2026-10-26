import type { CandidateReport } from './report';
import { stats } from './report';

export function visibility() {
  let generation = 0;
  const changed = () => { if (document.hidden) generation++; };
  document.addEventListener('visibilitychange', changed);
  return { stamp: () => generation, hiddenSince: (stamp: number) => document.hidden || stamp !== generation,
    stop: () => document.removeEventListener('visibilitychange', changed) };
}
export async function visible(signal: AbortSignal) {
  signal.throwIfAborted();
  if (!document.hidden) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { document.removeEventListener('visibilitychange', change); signal.removeEventListener('abort', abort); };
    const change = () => { if (!document.hidden) { cleanup(); resolve(); } };
    const abort = () => { cleanup(); reject(new Error('cancelled')); };
    document.addEventListener('visibilitychange', change); signal.addEventListener('abort', abort);
  });
}
// NFR-P1: observe actual lesson controls in a fresh navigation, without modifying the lesson.
export async function firstLesson(signal: AbortSignal): Promise<number> {
  const frame = document.createElement('iframe');
  frame.className = 'bench-lesson'; frame.title = 'P1'; frame.tabIndex = -1; frame.setAttribute('aria-hidden', 'true');
  frame.src = `/?lesson=follow-suit&benchNavigation=${Date.now()}`;
  document.body.append(frame);
  try {
    return await new Promise<number>((resolve, reject) => {
      const cleanup = () => { clearInterval(poll); clearTimeout(timeout); signal.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); reject(new Error('cancelled')); };
      const poll = setInterval(() => {
        const win = frame.contentWindow;
        if (!win || !frame.contentDocument?.querySelector('.lesson-screen')?.querySelector('button:not(:disabled)')) return;
        cleanup(); resolve(win.performance.now());
      }, 20);
      const timeout = setTimeout(() => { cleanup(); reject(new Error('lesson-watchdog-60s')); }, 60000);
      signal.addEventListener('abort', abort);
      if (signal.aborted) abort();
    });
  } finally { frame.remove(); }
}
type MemoryPerformance = Performance & { memory?: { usedJSHeapSize: number }; measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> };
export function monitor(candidate: CandidateReport) {
  const tasks: number[] = [];
  let observer: PerformanceObserver | undefined, stopped = false, pending = false;
  const collect = (entries: PerformanceEntry[]) => {
    tasks.push(...entries.map(entry => entry.duration));
    candidate.P5 = { status: 'measured', longestMs: Math.max(0, ...tasks), tasks: stats(tasks) };
  };
  if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    try { observer = new PerformanceObserver(list => collect(list.getEntries())); observer.observe({ type: 'longtask' }); collect([]); }
    catch { observer = undefined; }
  }
  const memory = performance as MemoryPerformance;
  const record = (bytes: number, method: string) => {
    if (!stopped && Number.isFinite(bytes) && bytes >= 0) candidate.P6 = { ...candidate.P6, status: 'measured', method,
      peakBytes: Math.max(candidate.P6.peakBytes ?? 0, bytes) };
  };
  const sample = () => {
    if (pending) return;
    if (memory.measureUserAgentSpecificMemory) {
      pending = true;
      void Promise.resolve().then(() => memory.measureUserAgentSpecificMemory!()).then(result => record(result.bytes, 'measureUserAgentSpecificMemory'))
        .catch(() => { if (memory.memory) record(memory.memory.usedJSHeapSize, 'performance.memory-main-JS-heap'); })
        .finally(() => { pending = false; });
    } else if (memory.memory) record(memory.memory.usedJSHeapSize, 'performance.memory-main-JS-heap');
  };
  sample();
  const interval = setInterval(sample, 1000);
  return () => { sample(); stopped = true; clearInterval(interval); if (observer) { collect(observer.takeRecords()); observer.disconnect(); } };
}
