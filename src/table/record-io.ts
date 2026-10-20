import { RANKS, SEATS, SUITS, dealFromSeed, dealIdOf, type Card, type Deal, type Hand, type Seat } from './index';
import { sameCard, sideOf, startPlaythrough, type CompletedPlaythroughRecord, type PlaythroughRecord } from './playthrough';
import { reconstruct, replay } from './replay';

type Check = (value: unknown) => boolean;
const choice = (values: readonly unknown[]): Check => value => values.includes(value);
const string: Check = value => typeof value === 'string' && value.length > 0;
const integer = (min: number, max: number): Check => value => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const object = (fields: Record<string, Check>, optional: string[] = []): Check => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).every(key => Object.hasOwn(fields, key))
    && Object.entries(fields).every(([key, check]) => optional.includes(key) && !Object.hasOwn(data, key) || check(data[key]));
};
const array = (check: Check, max: number): Check => value => Array.isArray(value) && value.length <= max && value.every(check);
function schemas() {
  const card = object({ suit: choice(SUITS), rank: choice(RANKS) });
  const hand: Check = value => array(card, 13)(value) && (value as unknown[]).length === 13;
  const seat = choice(SEATS);
  const origin: Check = value => object({ kind: choice(['authored']), contentId: string, version: integer(1, Number.MAX_SAFE_INTEGER) })(value)
    || object({ kind: choice(['seed']), seed: value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value),
      index: integer(1, Number.MAX_SAFE_INTEGER), rotation: choice([0]), algorithm: choice(['bv-deal-1']) })(value);
  const dealShape = object({ dealId: string, origin, dealer: seat,
    vulnerability: object({ northSouth: choice([true, false]), eastWest: choice([true, false]) }),
    hands: object({ north: hand, east: hand, south: hand, west: hand }) });
  const provenance: Check = value => object({ kind: choice(['learner']) })(value)
    || object({ kind: choice(['robot']), policy: string, version: string, fallback: choice(['timeout', 'engine-failure']),
      durationMs: value => typeof value === 'number' && Number.isFinite(value) && value >= 0 }, ['fallback'])(value);
  const recordShape = object({ schemaVersion: choice([2]), playthroughId: string, deal: dealShape,
    contract: object({ level: integer(1, 7), strain: choice([...SUITS, 'no-trumps']), declarer: seat }),
    learnerSide: choice(['northSouth']), status: choice(['in-progress', 'completed']),
    result: object({ northSouth: integer(0, 13), eastWest: integer(0, 13) }),
    appVersion: string, rulesCoreVersion: string,
    engineVersions: value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(string),
    actions: array(object({ index: integer(0, 51), seat, controller: choice(['learner', 'robot']),
      action: object({ kind: choice(['play-card']), card }), provenance }, ['provenance']), 52),
  });

  return { dealShape, recordShape };
}
function validateDeal(deal: unknown): asserts deal is Deal {
  if (!schemas().dealShape(deal)) throw new Error('Invalid deal shape');
  const cards = SEATS.flatMap(seat => (deal as Deal).hands[seat]);
  if (cards.some((card, index) => cards.slice(0, index).some(other => sameCard(card, other)))) throw new Error('Deal must contain 52 distinct cards');
}

// US-04.3: JSON preserves provenance and versions; PBN has neither and is not lossless.
export function exportRecordJson(record: PlaythroughRecord): string { return JSON.stringify(record, null, 2); }
export function importRecordJson(text: string): PlaythroughRecord {
  try {
    const value: unknown = JSON.parse(text);
    if (!schemas().recordShape(value)) throw new Error('Invalid record schema (expected schemaVersion 2, deal, contract, versions and actions)');
    const record = value as PlaythroughRecord;
    validateDeal(record.deal);
    // US-03.4, US-04.3: stored identity and origin must describe the actual Deal.
    const deal = record.deal;
    if (deal.dealId !== dealIdOf(deal)) throw new Error('Invalid dealId: does not match deal content');
    if (deal.origin.kind === 'seed') {
      const generated = dealFromSeed(deal.origin.seed, deal.origin.index);
      if (generated.dealer !== deal.dealer || generated.vulnerability.northSouth !== deal.vulnerability.northSouth
        || generated.vulnerability.eastWest !== deal.vulnerability.eastWest
        || SEATS.some(seat => deal.hands[seat].some(card => !generated.hands[seat].some(other => sameCard(card, other))))) {
        throw new Error('Deal seed and index do not reproduce its hands, dealer and vulnerability');
      }
    }
    reconstruct(record);
    return record;
  } catch (error) { throw new Error(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
}
const directions = ['N', 'E', 'S', 'W'];
const suits = ['S', 'H', 'D', 'C'];
const direction = (seat: Seat) => directions[SEATS.indexOf(seat)];
const cardCode = (card: Card) => suits[SUITS.indexOf(card.suit)] + (card.rank === '10' ? 'T' : card.rank);
function parseSeat(value: string): Seat {
  const index = directions.indexOf(value);
  if (index < 0) throw new Error('Invalid seat tag');
  return SEATS[index];
}
function parseCard(value: string): Card {
  if (!/^[SHDC][AKQJT2-9]$/.test(value)) throw new Error(`Invalid card ${value}`);
  return { suit: SUITS[suits.indexOf(value[0])], rank: value[1] === 'T' ? '10' : value[1] as Card['rank'] };
}
// US-04.3: comment delimiters inside quoted tag values are literal text.
function withoutComments(text: string): string {
  let state: 'plain' | 'quoted' | 'brace' | 'line' = 'plain';
  let result = '';
  for (const char of text) {
    if (state === 'brace') {
      if (char === '}') state = 'plain';
    } else if (state === 'line') {
      if (char === '\n' || char === '\r') { state = 'plain'; result += char; }
    } else if (state === 'quoted') {
      result += char;
      if (char === '"') state = 'plain';
    } else if (char === '{' || char === ';') {
      result += ' ';
      state = char === '{' ? 'brace' : 'line';
    } else {
      result += char;
      if (char === '"') state = 'quoted';
    }
  }
  if (state === 'brace') throw new Error('Unterminated PBN comment');
  return result;
}
function parsePlay(lines: readonly string[]): Card[] {
  const cards: Card[] = [];
  // PBN 2.1 §3.6.2: annotations can wrap play across lines; only cards count.
  for (const token of lines.join(' ').replace(/\$/g, ' $').split(/\s+/).filter(Boolean)) {
    if (cards.length && /^(?:\$\d+|!!|\?\?|!\?|\?!|!|\?)$/.test(token)) continue;
    cards.push(parseCard(token.replace(/(?:!!|\?\?|!\?|\?!|!|\?)$/, '')));
  }
  if (cards.length !== 52) throw new Error('Expected 13 complete tricks');
  return cards;
}
export function exportPbn(record: CompletedPlaythroughRecord): string {
  const tricks = replay(record);
  const { deal, contract } = record;
  const leader = SEATS[(SEATS.indexOf(contract.declarer) + 1) % 4];
  const columns = SEATS.map((_, index) => SEATS[(SEATS.indexOf(leader) + index) % 4]);
  const hands = SEATS.map(seat => SUITS.map(suit => RANKS.filter(rank => deal.hands[seat].some(card => card.suit === suit && card.rank === rank))
    .map(rank => rank === '10' ? 'T' : rank).join('')).join('.')).join(' ');
  const vulnerable = deal.vulnerability.northSouth ? (deal.vulnerability.eastWest ? 'All' : 'NS') : (deal.vulnerability.eastWest ? 'EW' : 'None');
  const tags = { Event: 'BridgeVibe', Site: '?', Date: '????.??.??', Board: '?', West: '?', North: '?', East: '?', South: '?',
    Dealer: direction(deal.dealer), Vulnerable: vulnerable, Deal: `N:${hands}`, Scoring: '?', Declarer: direction(contract.declarer),
    Contract: `${contract.level}${contract.strain === 'no-trumps' ? 'NT' : suits[SUITS.indexOf(contract.strain)]}`,
    Result: String(record.result[sideOf(contract.declarer)]), Play: direction(leader) };
  // PBN 2.1 §3.6: columns remain fixed at the Play tag's seat, even when the lead changes.
  return Object.entries(tags).map(([name, value]) => `[${name} "${value}"]`).join('\n') + '\n'
    + tricks.map(trick => columns.map(seat => cardCode(trick.cards.find(card => card.seat === seat)!.card)).join(' ')).join('\n') + '\n';
}
export function importPbn(text: string): CompletedPlaythroughRecord {
  try {
    const tags: Record<string, string> = Object.create(null);
    const playLines: string[] = [];
    let playing = false;
    for (const line of withoutComments(text).trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
      if (line.startsWith('[')) {
        const match = /^\[([A-Za-z]+) "([^"\\]*)"\]$/.exec(line);
        if (!match || playing || Object.hasOwn(tags, match[1])) throw new Error('Malformed or misplaced tag');
        tags[match[1]] = match[2];
        if (match[1] === 'Play') playing = true;
      } else {
        if (!playing) throw new Error('Play must follow the Play tag');
        playLines.push(line);
      }
    }
    if (!['Event', 'Deal', 'Declarer', 'Contract', 'Result', 'Play'].every(key => Object.hasOwn(tags, key))) throw new Error('Missing required tag');
    const playedCards = parsePlay(playLines);
    const match = /^([NESW]):([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)$/.exec(tags.Deal);
    if (!match) throw new Error('Invalid Deal tag');
    const start = SEATS.indexOf(parseSeat(match[1]));
    const hands = {} as Record<Seat, Hand>;
    match.slice(2).forEach((encoded, index) => {
      const holdings = encoded.split('.');
      if (holdings.length !== 4 || holdings.some(holding => !/^[AKQJT2-9]*$/.test(holding))) throw new Error('Invalid PBN hand');
      hands[SEATS[(start + index) % 4]] = holdings.flatMap((holding, suit) => [...holding].map(rank => parseCard(suits[suit] + rank))) as unknown as Hand;
    });
    if (tags.Vulnerable && !['None', 'NS', 'EW', 'All'].includes(tags.Vulnerable)) throw new Error('Invalid Vulnerable tag');
    const deal = { hands, dealer: tags.Dealer ? parseSeat(tags.Dealer) : 'north' as const,
      vulnerability: { northSouth: ['NS', 'All'].includes(tags.Vulnerable), eastWest: ['EW', 'All'].includes(tags.Vulnerable) },
      origin: { kind: 'authored' as const, contentId: 'pbn-import', version: 1 }, dealId: 'import' };
    validateDeal(deal);
    deal.dealId = dealIdOf(deal);
    const contract = /^([1-7])(NT|[SHDC])$/.exec(tags.Contract);
    if (!contract) throw new Error('Invalid or unsupported Contract tag');
    const table = startPlaythrough({ deal, learnerSide: 'northSouth', contract: { level: Number(contract[1]),
      strain: contract[2] === 'NT' ? 'no-trumps' : SUITS[suits.indexOf(contract[2])], declarer: parseSeat(tags.Declarer) } });
    const first = SEATS.indexOf(parseSeat(tags.Play));
    if (SEATS[first] !== table.seatView('south').turn) throw new Error('Play tag must match the opening leader');
    for (let trick = 0; trick < 13; trick++) {
      const cards = playedCards.slice(trick * 4, trick * 4 + 4);
      for (let index = 0; index < 4; index++) {
        const seat = table.seatView('south').turn!;
        const result = table.submit(seat, table.controllerOf(seat), { kind: 'play-card', card: cards[(SEATS.indexOf(seat) - first + 4) % 4] });
        if (result.kind === 'rejected') throw new Error(`Illegal play: ${result.reason}`);
      }
    }
    const record = table.completedRecord();
    if (!/^(?:[0-9]|1[0-3])$/.test(tags.Result) || Number(tags.Result) !== record.result[sideOf(record.contract.declarer)]) throw new Error('Result disagrees with play');
    return record;
  } catch (error) { throw new Error(`PBN parse error: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
}
