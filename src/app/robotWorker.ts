import { decodeSeatView, decodeSetupSeatView } from '../table';
import { principlesPolicy, contractChoicePolicy, type RobotPolicy } from '../robots';
import { ROBOT_PROTOCOL_VERSION, type RobotMessage, type RobotResponse } from './robotProtocol';

// US-12.6: pure TypeScript policy; no solver or WebAssembly dependency.
export function handleRobotMessage(message: RobotMessage, post: (response: RobotResponse) => void,
  policy: RobotPolicy = principlesPolicy, now: () => number = Date.now) {
  // §4.3.6: synchronous policies cannot be interrupted; the host discards cancelled results.
  if (message.type === 'cancel') return;
  const started = now();
  const selected = message.type === 'choose-contract' ? contractChoicePolicy : policy;
  // §4.3.3: rule IDs belong to structured provenance on successes and errors.
  const rule = message.type === 'choose-contract' ? { ruleId: contractChoicePolicy.ruleId } : {};
  try {
    if (message.view.seat !== message.seat) throw new Error('seat-mismatch');
    const decision = message.type === 'choose-contract' ? contractChoicePolicy.decide(decodeSetupSeatView(message.view))
      : policy.decide(decodeSeatView(message.view), message.seed, message.deadline);
    const action = decision.kind === 'play-card' ? { kind: decision.kind, card: decision.card } : decision;
    const decisionRule = 'ruleId' in decision ? { ruleId: decision.ruleId as string } : rule;
    post({ type: 'decided', requestId: message.requestId, playthroughId: message.playthroughId, positionKey: message.positionKey, action,
      provenance: { kind: 'robot', policy: selected.name, version: selected.version, ...decisionRule, durationMs: now() - started } });
  } catch {
    // §4.3.6: errors carry the position identity and the engine's provenance too.
    post({ type: 'error', requestId: message.requestId, playthroughId: message.playthroughId, positionKey: message.positionKey,
      message: 'robot-policy-failed', provenance: { kind: 'robot', policy: selected.name, version: selected.version, ...rule, durationMs: now() - started } });
  }
}
// §4.1.3: guard permits direct handler tests without starting a Worker.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = (event: MessageEvent<RobotMessage>) => handleRobotMessage(event.data, response => self.postMessage(response));
  self.postMessage({ type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION });
}
