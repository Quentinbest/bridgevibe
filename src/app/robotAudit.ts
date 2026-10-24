import { SEATS, type Deal, type PlaythroughRecord, type SetupEvent, type Seat } from '../table';

type AuditRecord = { deal: Deal; actions?: PlaythroughRecord['actions']; contract?: PlaythroughRecord['contract']; setupEvents?: readonly SetupEvent[] };
// US-10.2: visibility is derived from authoritative history, never the worker payload.
export function robotAudit(record: () => AuditRecord, hiddenCardFound?: () => void) {
  return (message: unknown, seat: Seat) => {
    const history = record();
    const deal = history.deal;
    const exposure = [...(history.setupEvents ?? [])].reverse().find(event => event.kind === 'dummy-exposed');
    const dummySeat = exposure?.seat ?? (history.contract ? SEATS[(SEATS.indexOf(history.contract.declarer) + 2) % 4] : null);
    const visible = [...deal.hands[seat], ...(history.actions ?? []).map(entry => entry.action.card),
      ...(dummySeat && (exposure || history.actions?.length) ? deal.hands[dummySeat] : [])];
    function inspect(value: unknown) {
      if (!value || typeof value !== 'object') return;
      if ('suit' in value && 'rank' in value && !visible.some(card => card.suit === value.suit && card.rank === value.rank)) {
        hiddenCardFound?.();
        throw new Error('robot-audit-hidden-card');
      }
      for (const child of Object.values(value)) inspect(child);
    }
    inspect(message);
  };
}

declare global {
  interface Window {
    __robotAuditCount?: number;
    __robotAuditViolations?: string[];
    __robotPending?: () => boolean;
  }
}
// §4.3.6: audit builds expose evidence without sending the Deal to a worker.
export function browserRobotAudit(record: () => AuditRecord, hiddenCardFound?: () => void) {
  const inspect = robotAudit(record, hiddenCardFound);
  window.__robotAuditCount ??= 0;
  window.__robotAuditViolations ??= [];
  return (message: unknown, seat: Seat) => {
    window.__robotAuditCount!++;
    try { inspect(message, seat); } catch (error) {
      const violation = 'robot-audit-hidden-card';
      window.__robotAuditViolations!.push(violation);
      console.error(violation);
      throw error;
    }
  };
}
// #13: e2e pauses the clock; it advances only once the worker has answered, so the 400 ms deadline
// can't fall back merely because fake time outran a real-time worker.
export function exposeRobotPending(pending: () => boolean) { window.__robotPending = pending; }
