import { RANKS, SEATS, SUITS } from '../table';
import { type Layout, type SolverPort } from './index';
import { dds31Engine } from './solverSelection';

type Module = { memory: WebAssembly.Memory; _initialize(): void; bv_init(): number;
  malloc(size: number): number; free(pointer: number): void;
  bv_table(pointer: number): number; bv_solve(pointer: number): number };
let engine: Promise<Module> | undefined;
// §4.1.4: load the inline bytes only on the first solve; concurrent callers share startup.
function module() {
  return engine ??= (async () => {
    const { default: url } = await import('./dds31/dds31.wasm?inline');
    const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), char => char.charCodeAt(0));
    const result = await WebAssembly.instantiate(bytes, {
      wasi_snapshot_preview1: {
        fd_write: () => 0, fd_read: () => 0, fd_seek: () => 0, fd_close: () => 0,
        environ_get: () => 0,
        environ_sizes_get: (count: number, size: number) => {
          const memory = new DataView(owned.memory.buffer);
          memory.setUint32(count, 0, true); memory.setUint32(size, 0, true); return 0;
        },
      },
      env: { emscripten_notify_memory_growth: () => {} },
    });
    const owned = result.instance.exports as unknown as Module;
    owned._initialize();
    owned.bv_init();
    return owned;
  })();
}
const pbn = (layout: Layout) => 'N:' + SEATS.map(seat => SUITS.map(suit => layout[seat]
  .filter(card => card.suit === suit).map(card => card.rank === '10' ? 'T' : card.rank).join('')).join('.')).join(' ');
async function solve(input: string, operation: 'bv_table' | 'bv_solve') {
  const wasm = await module();
  const bytes = new TextEncoder().encode(input + '\0');
  const pointer = wasm.malloc(bytes.length);
  if (!pointer) throw new Error('dds31 allocation failed');
  try {
    new Uint8Array(wasm.memory.buffer).set(bytes, pointer);
    const output = wasm[operation](pointer);
    // §4.3.2: solving may grow memory; read through a fresh view.
    const memory = new Uint8Array(wasm.memory.buffer);
    const end = memory.indexOf(0, output);
    if (!output || end < 0) throw new Error('Invalid dds31 output');
    const text = new TextDecoder().decode(memory.subarray(output, end)).trim();
    if (text.startsWith('error ')) throw new Error(`dds31 ${text}`);
    const values = text.split(/\s+/).map(Number);
    if (!text || values.some(value => !Number.isInteger(value))) throw new Error('Invalid dds31 values');
    return values;
  } finally { wasm.free(pointer); }
}
export const dds31Adapter: SolverPort = {
  ...dds31Engine,
  async solveTable(layout) {
    const values = await solve(pbn(layout), 'bv_table');
    if (values.length !== 20 || values.some(value => value < 0 || value > 13)) throw new Error('Invalid dds31 table');
    return { ...dds31Engine, table: Array.from({ length: 5 }, (_, i) => values.slice(i * 4, i * 4 + 4)) };
  },
  async solvePosition(layout, position) {
    const fields = [position.strain === 'no-trumps' ? 4 : SUITS.indexOf(position.strain), SEATS.indexOf(position.leader),
      ...Array.from({ length: 3 }, (_, i) => position.currentTrick[i] ? SUITS.indexOf(position.currentTrick[i].card.suit) : 0),
      ...Array.from({ length: 3 }, (_, i) => position.currentTrick[i] ? 14 - RANKS.indexOf(position.currentTrick[i].card.rank) : 0)];
    const [count, ...values] = await solve(fields.join(' ') + '\n' + pbn(layout), 'bv_solve');
    if (count < 1 || count > 13 || values.length !== count * 4) throw new Error('Invalid dds31 classes');
    // §4.3.2: DDS solutions=3, mode=1 scores every class, including forced cards.
    const classes = Array.from({ length: count }, (_, i) => {
      const [suit, rank, equals, tricks] = values.slice(i * 4, i * 4 + 4);
      if (suit < 0 || suit > 3 || rank < 2 || rank > 14 || equals < 0 || equals > 32764 || tricks < 0 || tricks > 13) {
        throw new Error('Invalid dds31 class');
      }
      return { cards: RANKS.filter((_, r) => (equals | (1 << rank)) & (1 << (14 - r)))
        .map(rank => ({ suit: SUITS[suit], rank })), tricks };
    });
    return { ...dds31Engine, classes };
  },
};
