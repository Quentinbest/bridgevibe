import { decodeSeatView } from '../table';
import { sampledEstimate, unavailable } from '../analysis/sampledEstimate';
import { loadConfiguredSolver } from '../analysis/solverSelection';
import { HINT_SAMPLE_COUNT } from '../information/parameters';
import { HINT_PROTOCOL_VERSION, type HintRequest, type HintResponse } from './hintProtocol';
// §4.1.4: solver initialisation occurs only on a practice hint request.
export async function handleHintRequest(data: HintRequest, post: (response: HintResponse) => void) {
  try {
    const view = decodeSeatView(data.view);
    post({ type: 'result', requestId: data.requestId, result: await sampledEstimate(await loadConfiguredSolver(), view, data.candidates, HINT_SAMPLE_COUNT, data.seed, data.deadline) });
  } catch { post({ type: 'result', requestId: data.requestId, result: unavailable() }); }
}
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = ({ data }: MessageEvent<HintRequest>) => { void handleHintRequest(data, response => self.postMessage(response)); };
  self.postMessage({ type: 'hello', protocolVersion: HINT_PROTOCOL_VERSION } satisfies HintResponse);
}
