import type { PositionResult } from '../analysis';
import type { CompletedPlaythroughRecord } from '../table';

// US-41.3: versioned envelope for the analysis worker, exchanged before the first request.
export const ANALYSIS_PROTOCOL_VERSION = 1;
export type AnalysisRequest = { type: 'solve'; requestId: number; record: CompletedPlaythroughRecord; index: number };
export type AnalysisResponse = { type: 'hello'; protocolVersion: number }
  | { type: 'result'; requestId: number; result: PositionResult }
  | { type: 'error'; requestId: number };
