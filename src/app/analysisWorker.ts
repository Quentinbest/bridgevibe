import { loadConfiguredSolver } from '../analysis/solverSelection';
import { completedRecord, type PlaythroughRecord } from '../table';
import { doubleDummy } from '../analysis';
import { ANALYSIS_PROTOCOL_VERSION, type AnalysisRequest, type AnalysisResponse } from './analysisProtocol';

// ADR-0001, §4.7: this worker is created only for a completed record, never for a Seat View.
export async function handleAnalysisRequest(data: AnalysisRequest, post: (response: AnalysisResponse) => void) {
  try {
    post({ type: 'result', requestId: data.requestId,
      result: await doubleDummy(await loadConfiguredSolver(), completedRecord(data.record as PlaythroughRecord), data.index) });
  } catch { post({ type: 'error', requestId: data.requestId }); }
}
// §4.1.3: guard permits direct handler tests without starting a Worker.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = ({ data }: MessageEvent<AnalysisRequest>) => { void handleAnalysisRequest(data, response => self.postMessage(response)); };
  // US-41.3: announce the protocol version before any request is accepted.
  self.postMessage({ type: 'hello', protocolVersion: ANALYSIS_PROTOCOL_VERSION } satisfies AnalysisResponse);
}
