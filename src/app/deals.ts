import { dealFromSeed, redeal, type Deal } from '../table';
import { fixedDeal } from './fixture';
import { createPlay } from './play';

export function dealFromUrl(search: string): { deal: Deal; invalid: boolean } {
  const params = new URLSearchParams(search);
  if (!params.has('seed') && !params.has('deal')) return { deal: fixedDeal, invalid: false };
  const seed = params.get('seed'), index = params.get('deal');
  try {
    if (seed === null || index === null || !/^[1-9][0-9]*$/.test(index)
      || params.getAll('seed').length !== 1 || params.getAll('deal').length !== 1) throw new RangeError();
    return { deal: dealFromSeed(seed, Number(index)), invalid: false };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { deal: fixedDeal, invalid: true };
  }
}
export function nextDeal(deal: Deal): Deal {
  if (deal.origin.kind === 'seed' && deal.origin.index < Number.MAX_SAFE_INTEGER) return redeal(deal);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const seed = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => alphabet[byte & 63]).join('');
  return dealFromSeed(seed, 1);
}
// US-16.4: only metadata and the Seat View projection reach React, never four hands.
export function dealSession(deal: Deal, invalid = false, playthroughIndex = 0) {
  const play = createPlay({}, deal, playthroughIndex % 2 === 0 ? 'northSouth' : 'eastWest');
  let info = { dealId: deal.dealId, origin: deal.origin };
  // US-06: a redeal updates metadata without remounting the dialog or debug disclosure.
  return { key: deal.dealId, get info() {
    const current = play.setupRecord().deal;
    if (current.dealId !== info.dealId) info = { dealId: current.dealId, origin: current.origin };
    return info;
  }, invalid, play,
    next() {
      const next = nextDeal(play.setupRecord().deal);
      if (next.origin.kind === 'seed') {
        const url = new URL(window.location.href);
        url.searchParams.set('seed', next.origin.seed);
        url.searchParams.set('deal', String(next.origin.index));
        window.history.replaceState(null, '', url);
      }
      return dealSession(next, false, playthroughIndex + 1);
    } };
}
