import { afterEach, expect, test, vi } from 'vitest';
import { dealIdOf, highCardPoints, type Deal, type Hand, type Seat } from '../table';
import { positionDigest } from '../table/positionKey';
import { fixedDeal } from './fixture';
import type { RobotWorker } from './robotHost';
import type { RobotMessage } from './robotProtocol';
import type { HintWorker } from './hintClient';
import type { HintRequest } from './hintProtocol';

afterEach(() => { vi.useRealTimers(); vi.resetModules(); });
function swapHidden(deal: Deal, a: Seat, b: Seat): Deal {
  const hands = structuredClone(deal.hands) as Record<Seat, [...Hand]>;
  const ai = hands[a].findIndex(card => card.rank === '6');
  const bi = hands[b].findIndex(card => card.rank === '8');
  [hands[a][ai], hands[b][bi]] = [hands[b][bi], hands[a][ai]];
  expect(highCardPoints(hands[a])).toBe(highCardPoints(deal.hands[a]));
  expect(highCardPoints(hands[b])).toBe(highCardPoints(deal.hands[b]));
  const changed = { ...deal, hands };
  return { ...changed, dealId: dealIdOf(changed) };
}

// ADR-0001, US-10.3, US-44: compare independent sessions with equal clocks and opaque
// counters. No field is removed or normalised from the actual posted messages.
test.each(['robot-play', 'robot-setup', 'hint'] as const)('%s posts byte-identical messages when only hidden cards change', async operation => {
  const setupDeal = { ...fixedDeal, hands: { north: fixedDeal.hands.east, east: fixedDeal.hands.south,
    south: fixedDeal.hands.west, west: fixedDeal.hands.north } };
  const base = operation === 'robot-setup' ? { ...setupDeal, dealId: dealIdOf(setupDeal) } : fixedDeal;
  // West leads with North exposed; South/East are hidden. For East's setup choice,
  // North/South are hidden. For South's hint, East/West are hidden.
  const hidden: [Seat, Seat] = operation === 'robot-play' ? ['south', 'east'] : operation === 'robot-setup' ? ['north', 'south'] : ['east', 'west'];
  const changed = swapHidden(base, ...hidden);
  expect(changed.dealId).not.toBe(base.dealId);
  const messages: (RobotMessage | HintRequest)[] = [];
  for (const deal of [base, changed]) {
    vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { createPlay } = await import('./play');
    const { runHint } = await import('./hintClient');
    const { handleRobotMessage } = await import('./robotWorker');
    const { ROBOT_PROTOCOL_VERSION } = await import('./robotProtocol');
    const { HINT_PROTOCOL_VERSION } = await import('./hintProtocol');
    const robots: RobotMessage[] = [], hints: HintRequest[] = [];
    const play = createPlay({ createWorker: () => {
      const worker: RobotWorker = { onmessage: null, onerror: null, onmessageerror: null, terminate: vi.fn(), postMessage(message) {
        robots.push(structuredClone(message));
        // US-10.3: hold the accepted opening lead fixed so both hints see the same public history.
        if (operation === 'hint') handleRobotMessage(message, response => worker.onmessage?.({ data: response } as MessageEvent), {
          name: 'test', version: '1', decide: () => ({ kind: 'play-card', card: { suit: 'spades', rank: '9' } }),
        });
      } };
      setTimeout(() => worker.onmessage?.({ data: { type: 'hello', protocolVersion: ROBOT_PROTOCOL_VERSION } } as MessageEvent), 0);
      return worker;
    } }, deal, operation === 'robot-setup' ? 'eastWest' : 'northSouth', (view, candidates, done, identity) => runHint(view, candidates, done, identity, () => {
      const worker: HintWorker = { onmessage: null, onerror: null, terminate: vi.fn(), postMessage(message: HintRequest) { hints.push(structuredClone(message)); } };
      setTimeout(() => worker.onmessage?.({ data: { type: 'hello', protocolVersion: HINT_PROTOCOL_VERSION } } as MessageEvent), 0);
      return worker;
    }));
    const stop = play.start();
    try {
      vi.advanceTimersByTime(3000);
      if (operation !== 'robot-setup') {
        expect(play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'game' })).toBe(true);
        vi.advanceTimersByTime(operation === 'hint' ? 500 : 0);
      }
      vi.advanceTimersByTime(1);
      const posted = operation === 'hint' ? hints : robots;
      expect(posted).toHaveLength(1);
      const request = posted[0];
      expect(request.type).toBe(operation === 'hint' ? 'hint' : operation === 'robot-setup' ? 'choose-contract' : 'decide');
      if (request.type === 'cancel') throw new Error('Unexpected cancellation');
      expect(request.positionKey).toBe(positionDigest(request.view));
      expect(request.playthroughId).toMatch(operation === 'robot-setup' ? /^setup-\d+$/ : /^playthrough-\d+$/);
      expect(JSON.stringify(request)).not.toContain(deal.dealId);
      messages.push(request);
    } finally { stop(); vi.clearAllTimers(); }
  }
  expect(JSON.stringify(messages[1])).toBe(JSON.stringify(messages[0]));
});
