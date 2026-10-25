import type { Request, Reply } from './engineWorker';
type Operation = Request extends infer R ? R extends Request ? Omit<R, 'id'> : never : never;
export function engineClient(signal: AbortSignal, crash: (message: string) => void) {
  const worker = new Worker(new URL('./engineWorker.ts', import.meta.url), { type: 'module' });
  let sequence = 0;
  let pending: { id: number; resolve(value: Reply): void; reject(error: Error): void } | undefined;
  const fail = (message: string) => { pending?.reject(new Error(message)); pending = undefined; };
  const abort = () => { fail('cancelled'); worker.terminate(); };
  signal.addEventListener('abort', abort);
  worker.onerror = () => { crash('solver-worker-error'); fail('solver-worker-error'); };
  worker.onmessageerror = () => { crash('solver-message-error'); fail('solver-message-error'); };
  worker.onmessage = ({ data }: MessageEvent<Reply>) => {
    if (!pending || data.id !== pending.id) return;
    if (data.error) fail(data.error);
    else if (![data.ms, data.solveMs, data.sampleCount].every(n => Number.isFinite(n) && n >= 0)) fail('invalid-worker-measurement');
    else { pending.resolve(data); pending = undefined; }
  };
  return {
    async run(operation: Operation): Promise<Reply> {
      signal.throwIfAborted();
      if (pending) throw new Error('overlapping-benchmark');
      // US-43: infrastructure watchdog, not a gate budget; preserve failures in the report.
      const timer = setTimeout(() => { fail('solver-watchdog-120s'); worker.terminate(); }, 120000);
      try {
        return await new Promise<Reply>((resolve, reject) => {
          pending = { id: ++sequence, resolve, reject };
          worker.postMessage({ ...operation, id: sequence });
        });
      } finally { clearTimeout(timer); }
    },
    stop() { abort(); signal.removeEventListener('abort', abort); },
  };
}
