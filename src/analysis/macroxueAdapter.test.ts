import { expect, test, vi } from 'vitest';
import smoke from './f2-smoke.json';
import { type Layout, type Position } from './index';

// §4.1.4: importing the adapter performs no WASM work; calls share one initialisation.
test('macroxue instantiates lazily and reuses the module', async () => {
  vi.resetModules();
  const instantiate = vi.spyOn(WebAssembly, 'instantiate');
  try {
    const { macroxueAdapter } = await import('./macroxueAdapter');
    expect(instantiate).not.toHaveBeenCalled();
    const { layout, position } = smoke.cases[0].positions[0];
    const solve = () => macroxueAdapter.solvePosition(layout as Layout, position as Position);
    const results = await Promise.all([solve(), solve()]);
    expect(instantiate).toHaveBeenCalledOnce();
    expect(results[0]).toEqual(results[1]);
  } finally { instantiate.mockRestore(); }
});
