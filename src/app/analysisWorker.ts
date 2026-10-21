import { bridgeDdsAdapter } from '../analysis/bridgeDdsAdapter';
import { completedRecord, type PlaythroughRecord } from '../table';
import { doubleDummy } from '../analysis';
// ADR-0001, §4.7: this worker is created only for a completed record, never for a Seat View.
self.onmessage = async ({ data }: MessageEvent<{ record: PlaythroughRecord; index: number }>) => {
  try { self.postMessage({ result: await doubleDummy(bridgeDdsAdapter, completedRecord(data.record), data.index) }); }
  catch { self.postMessage({ error: true }); }
};
