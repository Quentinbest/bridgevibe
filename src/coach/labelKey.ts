import type { PlaythroughRecord, SetupEvent } from '../table';

// US-18.9: identify actions, not runtime IDs, policy timing or object property order.
export function labelPositionKey(setup: readonly SetupEvent[], actions: PlaythroughRecord['actions']): string {
  return JSON.stringify({ setup: setup.map(event => {
    switch (event.kind) {
      case 'rotation': case 'redeal': return [event.kind, event.from.dealId, event.to.dealId];
      case 'announcement': return [event.kind, event.seat, event.hcp];
      case 'declarer': return [event.kind, event.seat, event.tied];
      case 'dummy-exposed': return [event.kind, event.seat];
      case 'contract-choice': return [event.kind, event.seat, event.action.strain, event.action.objective];
    }
  }), actions: actions.map(({ seat, action }) => [seat, action.card.suit, action.card.rank]) });
}
