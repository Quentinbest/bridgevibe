import { decodeSeatView } from '../table';
import { sampledEstimate, unavailable } from '../analysis/sampledEstimate';
import { configuredEngine, loadConfiguredSolver } from '../analysis/solverSelection';
import { HINT_SAMPLE_COUNT, REVIEW_SAMPLE_COUNT, sampler } from '../information/parameters';
import { HINT_PROTOCOL_VERSION, type HintRequest, type HintResponse } from './hintProtocol';
// §4.1.4: solver initialisation occurs only on a practice hint request.
export async function handleHintRequest(data: HintRequest, post: (response: HintResponse) => void, loadSolver = loadConfiguredSolver) {
  // CI-5: name this worker's own engine and sampler, even when the page bundle is newer.
  const { name, version } = configuredEngine();
  const source = { engine: { name, version }, sampler: { ...sampler } };
  const identity = { requestId: data.requestId, playthroughId: data.playthroughId, positionKey: data.positionKey };
  try {
    const view = decodeSeatView(data.view);
    const solver = await loadSolver();
    post({ type: 'result', ...identity, result: await sampledEstimate(solver, view, data.candidates, data.type === 'review' ? REVIEW_SAMPLE_COUNT : HINT_SAMPLE_COUNT, data.seed, data.deadline),
      source: { ...source, engine: { name: solver.name, version: solver.version } } });
  } catch { post({ type: 'result', ...identity, result: unavailable(), source }); }
}
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = ({ data }: MessageEvent<HintRequest>) => { void handleHintRequest(data, response => self.postMessage(response)); };
  self.postMessage({ type: 'hello', protocolVersion: HINT_PROTOCOL_VERSION } satisfies HintResponse);
}
