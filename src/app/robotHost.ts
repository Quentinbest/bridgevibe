import { seatViewSeed, encodeSeatView, encodeSetupSeatView, type SetupSeatView, type ContractChoice, type Action, type RobotProvenance, type Seat, type SeatView } from '../table';
import { positionDigest } from '../table/positionKey';
import { fallbackRobotPolicy, contractChoicePolicy } from '../robots';
import { ROBOT_PROTOCOL_VERSION, validRobotResponse, type RobotMessage, type RobotRequest, type ContractRequest } from './robotProtocol';

export interface RobotWorker {
  postMessage(message: RobotMessage): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}
export type RobotHostOptions = {
  createWorker?: () => RobotWorker;
  clock?: { now(): number; setTimeout(callback: () => void, ms: number): ReturnType<typeof setTimeout>; clearTimeout(timer: ReturnType<typeof setTimeout> | undefined): void };
  visibility?: { hidden(): boolean; subscribe(callback: () => void): () => void };
  policyDeadlineMs?: number; displayDelayMs?: number; failureThreshold?: number;
  audit?: (message: RobotMessage, seat: Seat) => void;
};
// ADR-0001: positionKey is host-private; begin() derives the worker key from its encoded view.
type Identity = { seed: string; playthroughId: string; positionKey: string;
  currentPositionKey(): string };
type Decision = Identity & ({ kind?: 'play'; view: SeatView; submit(action: Action, provenance: RobotProvenance): boolean }
  | { kind: 'contract'; view: SetupSeatView; submit(action: ContractChoice, provenance: RobotProvenance): boolean });
function submitDecision(decision: Decision, action: Action | ContractChoice, provenance: RobotProvenance): boolean {
  if (!action || typeof action !== 'object') return false;
  return decision.kind === 'contract' ? action.kind === 'choose-contract' && decision.submit(action, provenance)
    : action.kind === 'play-card' && decision.submit(action, provenance);
}
function fallbackAction(decision: Decision, now: number): Action | ContractChoice {
  return decision.kind === 'contract' ? contractChoicePolicy.decide(decision.view)
    : { kind: 'play-card', card: fallbackRobotPolicy.decide(decision.view, decision.seed, now).card };
}
export function createRobotHost(options: RobotHostOptions = {}) {
  // Browser timer functions throw "Illegal invocation" when called as methods of another object,
  // so the default clock wraps each one instead of storing the bare function.
  const clock = options.clock ?? { now: () => Date.now(), setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: timer => clearTimeout(timer) };
  const visibility = options.visibility ?? {
    hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    subscribe: (callback: () => void) => {
      if (typeof document === 'undefined') return () => {};
      document.addEventListener('visibilitychange', callback);
      return () => document.removeEventListener('visibilitychange', callback);
    },
  };
  // US-10.4: NFR-P4's later 1.5 s policies will need a longer display delay.
  const deadlineMs = options.policyDeadlineMs ?? 400;
  const displayMs = options.displayDelayMs ?? 500;
  const threshold = options.failureThreshold ?? 3;
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0 || !Number.isFinite(displayMs) || deadlineMs >= displayMs
    || !Number.isInteger(threshold) || threshold < 1) throw new Error('invalid-robot-timing');
  const createWorker = options.createWorker ?? (() => new Worker(new URL('./robotWorker.ts', import.meta.url), { type: 'module' }));
  let worker: RobotWorker | undefined;
  let ready = false;
  let failures = 0;
  let sequence = 0;
  let active: Decision | undefined;
  let request: RobotRequest | ContractRequest | undefined;
  let inFlight = false;
  let result: { action: Action | ContractChoice; provenance: RobotProvenance } | undefined;
  let started = 0;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let displayTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  function clearTimers() { clock.clearTimeout(deadlineTimer); clock.clearTimeout(displayTimer); }
  function post(message: RobotMessage) {
    if (!active || !worker) return;
    // US-10.2: audit failures propagate to the test, never become engine fallbacks.
    try { options.audit?.(message, active.view.seat); } catch (error) {
      clearTimers(); active = undefined; request = undefined; result = undefined;
      throw error;
    }
    try { worker.postMessage(message); } catch { fail(); }
  }
  function cancelRequest() {
    request = undefined;
    clock.clearTimeout(deadlineTimer);
    // §4.3: a synchronous policy can't read a cancel message until it returns, so cancelling an
    // in-flight decision terminates the worker; the next decision starts a fresh one. Not a failure.
    if (inFlight) { inFlight = false; terminate(); }
  }
  function terminate() {
    const previous = worker; worker = undefined; ready = false; inFlight = false;
    if (previous) { previous.onmessage = null; previous.onerror = null; previous.onmessageerror = null; previous.terminate(); }
  }
  function fallback(reason: 'timeout' | 'engine-failure') {
    if (!active || result || visibility.hidden()) return;
    // US-41.3, US-12.5: a worker still without its handshake at the deadline is replaced, and
    // counts toward the failure threshold, so a stale or hung worker can't time out forever.
    if (reason === 'timeout' && worker && !ready) { failures++; terminate(); }
    const policy = active.kind === 'contract' ? contractChoicePolicy : fallbackRobotPolicy;
    result = { action: fallbackAction(active, clock.now()),
      provenance: { kind: 'robot', policy: policy.name, version: policy.version,
        ...(active.kind === 'contract' ? { ruleId: contractChoicePolicy.ruleId } : { ruleId: 'fallback-lowest' }),
        fallback: reason, durationMs: clock.now() - started } };
    cancelRequest();
  }
  function fail() {
    failures++; terminate();
    fallback('engine-failure');
    ensureWorker();
  }
  function ensureWorker() {
    if (worker || failures >= threshold || !active) return;
    try { worker = createWorker(); } catch { fail(); return; }
    const owned = worker;
    owned.onmessage = event => {
      if (worker !== owned) return;
      const message = event.data;
      if (!validRobotResponse(message, request?.type)) { fail(); return; }
      if (message.type === 'hello') {
        if (message.protocolVersion !== ROBOT_PROTOCOL_VERSION) {
          failures++; terminate();
          if (failures >= threshold) fallback('engine-failure');
          else ensureWorker();
          return;
        }
        ready = true; send(); return;
      }
      if (!active || !request || message.requestId !== request.requestId || visibility.hidden()) return;
      // §4.3.6: only a response for this exact position counts, success or error.
      if (message.playthroughId !== request.playthroughId || message.positionKey !== request.positionKey) return;
      inFlight = false;
      if (active.currentPositionKey() !== active.positionKey) { cancel(); return; }
      // US-12.2: anything arriving after the deadline is a timeout, even an error.
      if (clock.now() >= request.deadline) { fallback('timeout'); return; }
      if (message.type === 'error') { fail(); return; }
      result = { action: message.action, provenance: message.provenance };
      request = undefined; clock.clearTimeout(deadlineTimer);
    };
    owned.onerror = owned.onmessageerror = () => { if (worker === owned) fail(); };
  }
  function send() {
    if (!ready || !active || !request || result || inFlight || visibility.hidden()) return;
    inFlight = true;
    post(request);
  }
  function display() {
    if (!active || visibility.hidden()) return;
    if (active.currentPositionKey() !== active.positionKey) { cancel(); return; }
    if (!result) fallback('timeout');
    const decision = active; const chosen = result;
    active = undefined; result = undefined; request = undefined; clearTimers();
    if (!chosen || submitDecision(decision, chosen.action, chosen.provenance) || chosen.provenance.fallback) return;
    // US-11.1, INV-7: an action the Table rejects is an engine failure, never a retry loop.
    failures++; terminate();
    const policy = decision.kind === 'contract' ? contractChoicePolicy : fallbackRobotPolicy;
    submitDecision(decision, fallbackAction(decision, clock.now()), { kind: 'robot',
      policy: policy.name, version: policy.version,
      ...(decision.kind === 'contract' ? { ruleId: contractChoicePolicy.ruleId } : { ruleId: 'fallback-lowest' }),
      fallback: 'engine-failure', durationMs: clock.now() - started });
  }
  function begin() {
    if (!active || visibility.hidden()) return;
    started = clock.now();
    displayTimer = clock.setTimeout(display, displayMs);
    if (result) return;
    request = { ...(active.kind === 'contract' ? { type: 'choose-contract' as const, view: encodeSetupSeatView(active.view) }
      : { type: 'decide' as const, view: encodeSeatView(active.view) }), requestId: String(++sequence), cancellationId: String(sequence),
      playthroughId: active.playthroughId, positionKey: active.kind === 'contract' ? positionDigest(encodeSetupSeatView(active.view)) : seatViewSeed(active.view), deadline: started + deadlineMs,
      seat: active.view.seat, seed: active.seed };
    deadlineTimer = clock.setTimeout(() => fallback('timeout'), deadlineMs);
    if (failures >= threshold) fallback('engine-failure');
    else { ensureWorker(); send(); }
  }
  function cancel() { cancelRequest(); clearTimers(); active = undefined; result = undefined; }
  function visibilityChanged() {
    if (!active) return;
    if (visibility.hidden()) {
      cancelRequest(); clearTimers();
    } else {
      // US-10.4, US-12.4: every resume restarts the whole display window, whether or not the
      // decision finished before the page was hidden, so display time never reveals decision time.
      begin();
    }
  }
  return {
    decide(decision: Decision) {
      cancel(); active = decision;
      unsubscribe ??= visibility.subscribe(visibilityChanged);
      begin();
    },
    cancel,
    // US-10.2 audit builds: a decision is pending until the worker answers or a fallback replaces it.
    pending: () => !!active && !result,
    stop() { cancel(); terminate(); unsubscribe?.(); unsubscribe = undefined; },
  };
}
