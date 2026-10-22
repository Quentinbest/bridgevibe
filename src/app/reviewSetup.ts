import { sideOf, trickTarget, type CompletedPlaythroughRecord } from '../table';
import { text } from '../explanation';

// US-16.2, ADR-0002: read recorded setup facts; never regenerate setup from a seed.
export function reviewSetup(record: CompletedPlaythroughRecord) {
  if (record.gameFormat !== 'minibridge') return [];
  const events = record.setupEvents ?? [];
  let finalStart = 0;
  events.forEach((event, index) => { if (event.kind === 'redeal') finalStart = index + 1; });
  const finalEvents = events.slice(finalStart);
  const announcements = finalEvents.filter(event => event.kind === 'announcement');
  const total = (side: 'northSouth' | 'eastWest') => announcements
    .filter(event => sideOf(event.seat) === side).reduce((sum, event) => sum + event.hcp, 0);
  return [
    { title: text('review.announcements'), lines: [
      ...(events.some(event => event.kind === 'redeal') ? [text('review.redealt')] : []),
      ...announcements.map(event => text('setup.points', { seat: text(`seat.${event.seat}`), hcp: event.hcp })),
      text('setup.totals', { ns: total('northSouth'), ew: total('eastWest') }),
    ] },
    { title: text('review.declarer-dummy'), lines: finalEvents.flatMap(event =>
      event.kind === 'declarer' ? [text(event.tied ? 'setup.tie' : 'setup.declarer', { seat: text(`seat.${event.seat}`) })]
        : event.kind === 'dummy-exposed' ? [text('setup.dummy', { seat: text(`seat.${event.seat}`) })] : []) },
    { title: text('review.contract-choice'), lines: finalEvents.flatMap(event => event.kind === 'contract-choice' ? [
      text('contract.chosen', { strain: text(event.action.strain === 'no-trumps' ? 'strain.no-trumps' : `symbol.${event.action.strain}`),
        objective: text(`objective.${event.action.objective}`) }),
      text('declarer.target', { seat: text(`seat.${event.seat}`), target: trickTarget(event.action.strain, event.action.objective) }),
    ] : []) },
  ];
}
