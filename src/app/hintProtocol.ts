import type { Card, SeatViewMessage } from '../table';
import type { HintResult } from '../analysis/sampledEstimate';
// ADR-0001, US-41.3: no record capability crosses this versioned boundary.
export const HINT_PROTOCOL_VERSION = 1;
export type HintRequest = { type: 'hint'; requestId: number; view: SeatViewMessage; candidates: readonly Card[]; seed: string; deadline: number };
export type HintResponse = { type: 'hello'; protocolVersion: number } | { type: 'result'; requestId: number; result: HintResult };
