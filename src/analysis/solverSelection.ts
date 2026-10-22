import { bridgeDdsEngine } from './index';

export const macroxueEngine = { name: 'macroxue', version: 'bridge-solver 630705d' } as const;
// US-41.1–2: identity is available without loading either solver.
export function configuredEngine() {
  const value = import.meta.env.VITE_SOLVER;
  if (value === 'macroxue') return macroxueEngine;
  if (!value || value === 'bridge-dds') return bridgeDdsEngine;
  throw new Error(`Invalid VITE_SOLVER: ${value}`);
}
export async function loadConfiguredSolver() {
  configuredEngine();
  return import.meta.env.VITE_SOLVER === 'macroxue'
    ? (await import('./macroxueAdapter')).macroxueAdapter
    : (await import('./bridgeDdsAdapter')).bridgeDdsAdapter;
}
