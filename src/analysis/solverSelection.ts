import { bridgeDdsEngine } from './index';

export const macroxueEngine = { name: 'macroxue', version: 'bridge-solver 630705d' } as const;
export const dds31Engine = { name: 'dds-3.1', version: '3.1.0 fe6a658 single-threaded' } as const;
// US-41.1–2: identity is available without loading any solver.
export function configuredEngine() {
  const value = import.meta.env.VITE_SOLVER;
  if (value === 'dds31') return dds31Engine;
  if (value === 'macroxue') return macroxueEngine;
  if (!value || value === 'bridge-dds') return bridgeDdsEngine;
  throw new Error(`Invalid VITE_SOLVER: ${value}`);
}
export async function loadConfiguredSolver() {
  configuredEngine();
  if (import.meta.env.VITE_SOLVER === 'dds31') return (await import('./dds31Adapter')).dds31Adapter;
  return import.meta.env.VITE_SOLVER === 'macroxue'
    ? (await import('./macroxueAdapter')).macroxueAdapter
    : (await import('./bridgeDdsAdapter')).bridgeDdsAdapter;
}
