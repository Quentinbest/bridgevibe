import { expect, test, vi } from 'vitest';
import smoke from './f2-smoke.json';
import { type Layout, type Position } from './index';

// §4.1.4: importing the adapter performs no WASM work; calls share one initialisation.
test('dds31 instantiates lazily and reuses the module', async () => {
  vi.resetModules();
  const instantiate = vi.spyOn(WebAssembly, 'instantiate');
  try {
    const { dds31Adapter } = await import('./dds31Adapter');
    expect(instantiate).not.toHaveBeenCalled();
    const { layout, position } = smoke.cases[0].positions[0];
    const solve = () => dds31Adapter.solvePosition(layout as Layout, position as Position);
    const results = await Promise.all([solve(), solve()]);
    expect(instantiate).toHaveBeenCalledOnce();
    expect(results[0]).toEqual(results[1]);
  } finally { instantiate.mockRestore(); }
});

// US-45.1: native errors propagate instead of becoming a substantive result.
test('dds31 rejects invalid native solves and remains usable', async () => {
  const { dds31Adapter } = await import('./dds31Adapter');
  const empty: Layout = { north: [], east: [], south: [], west: [] };
  await expect(dds31Adapter.solveTable(empty)).rejects.toThrow(/dds31 error -?\d+/);
  await expect(dds31Adapter.solvePosition(empty, { strain: 'no-trumps', leader: 'north', currentTrick: [] })).rejects.toThrow(/dds31 error -?\d+/);
  expect(await dds31Adapter.solveTable(smoke.cases[0].layout as Layout)).toMatchObject({
    name: 'dds-3.1', version: '3.1.0 fe6a658 single-threaded', table: smoke.cases[0].native.table,
  });
});
