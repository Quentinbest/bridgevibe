import { SEATS, type Deal, type PlaythroughRecord, type Seat } from '../table';

// US-10.2: visibility is derived from authoritative history, never the worker payload.
export function robotAudit(deal: Deal, record: () => Pick<PlaythroughRecord, 'actions' | 'contract'>, hiddenCardFound?: () => void) {
  return (message: unknown, seat: Seat) => {
    const history = record();
    const dummySeat = SEATS[(SEATS.indexOf(history.contract.declarer) + 2) % 4];
    const visible = [...deal.hands[seat], ...history.actions.map(entry => entry.action.card),
      ...(history.actions.length ? deal.hands[dummySeat] : [])];
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
  }
}
// §4.3.6: audit builds expose evidence without sending the Deal to a worker.
export function browserRobotAudit(deal: Deal, record: () => Pick<PlaythroughRecord, 'actions' | 'contract'>, hiddenCardFound?: () => void) {
  const inspect = robotAudit(deal, record, hiddenCardFound);
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
