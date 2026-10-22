import type { PositionResult } from '../analysis';
import type { CompletedPlaythroughRecord } from '../table';

// US-41.3: versioned envelope for the analysis worker, exchanged before the first request.
export const ANALYSIS_PROTOCOL_VERSION = 2;
export type AnalysisRequest = { type: 'solve'; requestId: number; record: CompletedPlaythroughRecord; index: number; playthroughId: string; positionKey: string; deadline: number; cancellationId: string };
export type AnalysisMessage = AnalysisRequest | { type: 'cancel'; cancellationId: string };
export type AnalysisResponse = { type: 'hello'; protocolVersion: number }
  | { type: 'result'; requestId: number; playthroughId: string; positionKey: string; result: PositionResult }
  | { type: 'error'; requestId: number; playthroughId: string; positionKey: string };
