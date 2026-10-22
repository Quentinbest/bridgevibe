import { loadConfiguredSolver } from '../analysis/solverSelection';
import { completedRecord, type PlaythroughRecord } from '../table';
import { doubleDummy } from '../analysis';
import { ANALYSIS_PROTOCOL_VERSION, type AnalysisMessage, type AnalysisResponse } from './analysisProtocol';

// ADR-0001, §4.7: this worker is created only for a completed record, never for a Seat View.
export function createAnalysisHandler() {
  const active = new Map<string, object>();
  return async (data: AnalysisMessage, post: (response: AnalysisResponse) => void) => {
    if (data.type === 'cancel') { active.delete(data.cancellationId); return; }
    const token = {};
    active.set(data.cancellationId, token);
    const identity = { requestId: data.requestId, playthroughId: data.playthroughId, positionKey: data.positionKey };
    const current = () => active.get(data.cancellationId) === token;
    try {
      if (Date.now() > data.deadline) throw new Error('AnalysisTimeout');
      const solver = await loadConfiguredSolver();
      if (!current()) return;
      if (Date.now() > data.deadline) throw new Error('AnalysisTimeout');
      const result = await doubleDummy(solver, completedRecord(data.record as PlaythroughRecord), data.index);
      // §4.3.6: a running synchronous solve can't observe a cancel message, so a cancelled request's result
      // may still be posted here; the client has already settled and removed it, so it is never accepted.
      if (current()) post(Date.now() > data.deadline ? { type: 'error', ...identity, cause: 'timeout' } : { type: 'result', ...identity, result });
    } catch (error) {
      if (current()) post(error instanceof Error && error.message === 'AnalysisTimeout' ? { type: 'error', ...identity, cause: 'timeout' } : { type: 'error', ...identity });
    }
    finally { if (current()) active.delete(data.cancellationId); }
  };
}
export const handleAnalysisRequest = createAnalysisHandler();
// §4.1.3: guard permits direct handler tests without starting a Worker.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = ({ data }: MessageEvent<AnalysisMessage>) => { void handleAnalysisRequest(data, response => self.postMessage(response)); };
  // US-41.3: announce the protocol version before any request is accepted.
  self.postMessage({ type: 'hello', protocolVersion: ANALYSIS_PROTOCOL_VERSION } satisfies AnalysisResponse);
}
