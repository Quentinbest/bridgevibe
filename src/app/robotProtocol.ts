import type { Action, RobotProvenance, Seat, SeatViewMessage, SetupSeatViewMessage, ContractChoice } from '../table';

// US-41.3, §4.3.6: versioned worker envelope.
export const ROBOT_PROTOCOL_VERSION = 3;
export type RobotRequest = {
  type: 'decide'; requestId: string; playthroughId: string; positionKey: string; deadline: number;
  cancellationId: string; seat: Seat; view: SeatViewMessage; seed: string;
};
export type ContractRequest = Omit<RobotRequest, 'type' | 'view'> & { type: 'choose-contract'; view: SetupSeatViewMessage };
export type RobotMessage = RobotRequest | ContractRequest | { type: 'cancel'; cancellationId: string };
export type RobotResponse = { type: 'hello'; protocolVersion: number }
  | { type: 'decided'; requestId: string; playthroughId: string; positionKey: string; action: Action | ContractChoice; provenance: RobotProvenance }
  | { type: 'error'; requestId: string; playthroughId: string; positionKey: string; message: string; provenance: RobotProvenance };
