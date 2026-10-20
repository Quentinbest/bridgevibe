import { sameCard, SEATS, type Deal, type Seat } from '../src/table';

export { robotAudit } from '../src/app/robotAudit';

// US-10.2: useful for tests that explicitly identify a forbidden card.
export const hiddenCard = (deal: Deal, seat: Seat) => SEATS.flatMap(other => deal.hands[other])
  .find(card => !deal.hands[seat].some(own => sameCard(own, card)))!;
