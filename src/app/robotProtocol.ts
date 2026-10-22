import type { Action, RobotProvenance, Seat, SeatViewMessage, SetupSeatViewMessage, ContractChoice } from '../table';
import { SUITS, RANKS, OBJECTIVES, validProvenance } from '../table';

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

type Check = (value: unknown) => boolean;
const choice = (values: readonly unknown[]): Check => value => values.includes(value);
const string: Check = value => typeof value === 'string';
const object = (fields: Record<string, Check>, optional: Record<string, Check> = {}): Check => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(fields).every(key => Object.hasOwn(data, key))
    && Reflect.ownKeys(data).every(key => typeof key === 'string'
      && (Object.hasOwn(fields, key) ? fields[key](data[key]) : Object.hasOwn(optional, key) && optional[key](data[key])));
};
const provenance: Check = value => object({ kind: choice(['robot']), policy: string, version: string,
  durationMs: value => typeof value === 'number' }, { ruleId: string, fallback: choice(['timeout', 'engine-failure']) })(value)
  && validProvenance('robot', value as RobotProvenance);
const cardAction = object({ kind: choice(['play-card']), card: object({ suit: choice(SUITS), rank: choice(RANKS) }) });
const contractAction = object({ kind: choice(['choose-contract']), strain: choice([...SUITS, 'no-trumps']), objective: choice(OBJECTIVES) });

// US-12.5, §4.3.6: untrusted worker data must be complete before it reaches display or the record.
export function validRobotResponse(value: unknown, operation?: RobotRequest['type'] | ContractRequest['type']): value is RobotResponse {
  const identity = { requestId: string, playthroughId: string, positionKey: string, provenance };
  return object({ type: choice(['hello']), protocolVersion: value => typeof value === 'number' && Number.isSafeInteger(value) })(value)
    || object({ type: choice(['error']), ...identity, message: string })(value)
    || object({ type: choice(['decided']), ...identity, action: action => operation === 'decide' ? cardAction(action)
      : operation === 'choose-contract' ? contractAction(action) : cardAction(action) || contractAction(action) })(value);
}
