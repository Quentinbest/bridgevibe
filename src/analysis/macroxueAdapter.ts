import { RANKS, SEATS, SUITS, type Card } from '../table';
import { type Layout, type SolverPort } from './index';
import { equivalentClasses } from './equivalentClasses';
import { macroxueEngine } from './solverSelection';

type Module = { memory: WebAssembly.Memory; _initialize(): void; malloc(size: number): number;
  free(pointer: number): void; bv_table(pointer: number): number; bv_position(pointer: number): number };
let engine: Promise<Module> | undefined;
// §4.1.4: even the inline bytes are imported only at the first solve.
function module() {
  return engine ??= (async () => {
    const { default: url } = await import('./macroxue/solver.wasm?inline');
    const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), char => char.charCodeAt(0));
    const result = await WebAssembly.instantiate(bytes, {
      wasi_snapshot_preview1: {
        fd_write: () => 0, environ_get: () => 0,
        environ_sizes_get: (count: number, size: number) => {
          const memory = new DataView(owned.memory.buffer);
          memory.setUint32(count, 0, true); memory.setUint32(size, 0, true); return 0;
        },
        fd_seek: () => 0, fd_close: () => 0,
        proc_exit: (code: number) => { throw new Error(`macroxue exit ${code}`); },
      },
      env: { emscripten_notify_memory_growth: () => {} },
    });
    const owned = result.instance.exports as unknown as Module;
    owned._initialize();
    return owned;
  })();
}
const code = (card: Card) => 'SHDC'[SUITS.indexOf(card.suit)] + (card.rank === '10' ? 'T' : card.rank);
const hands = (layout: Layout) => SEATS.map(seat => SUITS.map(suit => RANKS
  .filter(rank => layout[seat].some(card => card.suit === suit && card.rank === rank))
  .map(rank => rank === '10' ? 'T' : rank).join('') || '-').join(' ')).join('\n') + '\n';
async function solve(input: string, operation: 'bv_table' | 'bv_position', count: number) {
  const wasm = await module();
  const bytes = new TextEncoder().encode(input + '\0');
  const pointer = wasm.malloc(bytes.length);
  if (!pointer) throw new Error('macroxue allocation failed');
  try {
    new Uint8Array(wasm.memory.buffer).set(bytes, pointer);
    const output = wasm[operation](pointer);
    // §4.3.2: memory may grow while solving; never retain an earlier view.
    const memory = new Uint8Array(wasm.memory.buffer);
    const end = memory.indexOf(0, output);
    if (!output || end < 0) throw new Error('Invalid macroxue output');
    const values = new TextDecoder().decode(memory.subarray(output, end)).trim().split(/\s+/).map(Number);
    if (values.length !== count || values.some(value => !Number.isInteger(value) || value < 0 || value > 13)) {
      throw new Error('Invalid macroxue scores');
    }
    return values;
  } finally { wasm.free(pointer); }
}
export const macroxueAdapter: SolverPort = {
  ...macroxueEngine,
  async solveTable(layout) {
    const values = await solve(hands(layout), 'bv_table', 20);
    return { ...macroxueEngine, table: Array.from({ length: 5 }, (_, i) => values.slice(i * 4, i * 4 + 4)) };
  },
  async solvePosition(layout, position) {
    const acting = SEATS[(SEATS.indexOf(position.leader) + position.currentTrick.length) % 4];
    const led = position.currentTrick[0]?.card.suit;
    const following = layout[acting].filter(card => card.suit === led);
    const legal = following.length ? following : layout[acting];
    // §4.3.2: the native binding needs the ending before this trick's plays.
    const restored = { ...layout };
    for (const seat of SEATS) restored[seat] = [...layout[seat],
      ...position.currentTrick.filter(play => play.seat === seat).map(play => play.card)];
    const line = [position.strain === 'no-trumps' ? 4 : SUITS.indexOf(position.strain), SEATS.indexOf(position.leader),
      position.currentTrick.length, ...position.currentTrick.map(play => code(play.card)), legal.length, ...legal.map(code)].join(' ');
    const values = await solve(hands(restored) + line, 'bv_position', legal.length);
    return { ...macroxueEngine, classes: equivalentClasses(layout, position, acting, legal.map((card, i) => ({ card, tricks: values[i] }))) };
  },
};
