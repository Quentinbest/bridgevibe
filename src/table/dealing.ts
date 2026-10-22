import { RANKS, SEATS, SUITS, type Card, type Deal, type Hand } from './index';

export const DEALING_ALGORITHM = 'bv-deal-1';
const rotateRight = (n: number, bits: number) => (n >>> bits) | (n << (32 - bits));
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
// US-03.4: FIPS 180-4 SHA-256, synchronous and independent of platform crypto.
export function sha256(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const data = new DataView(padded.buffer);
  data.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
  data.setUint32(padded.length - 4, bytes.length * 8);
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = data.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = w[i - 16] + (rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3))
        + w[i - 7] + (rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10));
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25))
        + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22))
        + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((word, i) => { hash[i] = (hash[i] + word) >>> 0; });
  }
  return hash.map(word => word.toString(16).padStart(8, '0')).join('');
}
const cardIndex = (card: Card) => SUITS.indexOf(card.suit) * 13 + RANKS.indexOf(card.rank);
// INV-2: order within a hand and origin do not affect content identity.
export function dealIdOf(deal: Pick<Deal, 'hands' | 'dealer' | 'vulnerability'>): string {
  const content = [SEATS.map(seat => deal.hands[seat].map(cardIndex).sort((a, b) => a - b)),
    deal.dealer, deal.vulnerability.northSouth, deal.vulnerability.eastWest];
  return `deal-${sha256(JSON.stringify(content)).slice(0, 16)}`;
}
// US-03.1: xoshiro128** 1.1, seeded by the first four big-endian SHA-256 words
// of UTF-8 `${seed}:${index}`. All-zero state is replaced by [1, 0, 0, 0].
function generator(seed: string, index: number): () => number {
  const digest = sha256(`${seed}:${index}`);
  let [a, b, c, d] = Array.from({ length: 4 }, (_, i) => parseInt(digest.slice(i * 8, i * 8 + 8), 16));
  if ((a | b | c | d) === 0) a = 1;
  return () => {
    const result = Math.imul(rotateRight(Math.imul(b, 5), 25), 9) >>> 0;
    const t = b << 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotateRight(d, 21);
    return result;
  };
}
const vulnerabilities = [0, 1, 2, 3, 1, 2, 3, 0, 2, 3, 0, 1, 3, 0, 1, 2] as const;
export function dealFromSeed(seed: string, index: number): Deal {
  if (typeof seed !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(seed)
    || !Number.isSafeInteger(index) || index < 1) throw new RangeError('Invalid seed or deal index');
  const next = generator(seed, index);
  const cards: Card[] = SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
  // US-03.1: Fisher–Yates; reject the incomplete interval to avoid modulo bias.
  for (let i = cards.length - 1; i > 0; i--) {
    const bound = i + 1, limit = 0x100000000 - (0x100000000 % bound);
    let value: number;
    do { value = next(); } while (value >= limit);
    const j = value % bound;
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const hands = Object.fromEntries(SEATS.map((seat, i) => [seat,
    Object.freeze(cards.slice(i * 13, i * 13 + 13).sort((a, b) => cardIndex(a) - cardIndex(b)).map(Object.freeze)) as Hand,
  ])) as Deal['hands'];
  const board = (index - 1) % 16;
  const content = { hands: Object.freeze(hands), dealer: SEATS[board % 4],
    vulnerability: Object.freeze({ northSouth: !!(vulnerabilities[board] & 1), eastWest: !!(vulnerabilities[board] & 2) }) };
  return Object.freeze({ ...content, dealId: dealIdOf(content),
    origin: Object.freeze({ kind: 'seed', seed, index, rotation: 0, algorithm: DEALING_ALGORITHM }) });
}
export function redeal(deal: Deal): Deal {
  if (deal.origin.kind !== 'seed') throw new RangeError('Authored Deals cannot be redealt');
  return dealFromSeed(deal.origin.seed, deal.origin.index + 1);
}

// US-07.2: rotate hands clockwise while retaining the board's dealer and vulnerability.
export function rotateDeal(deal: Deal): Deal {
  if (deal.origin.kind !== 'seed') throw new RangeError('Authored Deals cannot be rotated');
  const hands = Object.freeze({ north: deal.hands.west, east: deal.hands.north,
    south: deal.hands.east, west: deal.hands.south });
  const content = { hands, dealer: deal.dealer, vulnerability: deal.vulnerability };
  const rotation = ((deal.origin.rotation + 1) % 4) as 0 | 1 | 2 | 3;
  return Object.freeze({ ...content, dealId: dealIdOf(content), origin: Object.freeze({ ...deal.origin, rotation }) });
}
