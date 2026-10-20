// F6, US-09.1: run from the repository root: node scripts/scoring/generate-f6-reference.ts
import { writeFile } from 'node:fs/promises';
import { createRequire, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const { score }: { score: (level: number, suit: number, doubling: number, declarer: number, vulnerable: number, result: number) => number }
  = require(`${root}.reference-scorers/contract-bridge/scoring/features/score.js`);
// F6: transpile only the offline reference, resolving its .js imports to .ts sources.
// TypeScript removes type-only imports that the reference does not mark with `type`.
const referenceRoot = new URL('../../.reference-scorers/ts-contractbridge/src/', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(referenceRoot) && specifier.startsWith('./') && specifier.endsWith('.js')) {
      return nextResolve(specifier.replace(/\.js$/, '.ts'), context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(referenceRoot) && url.endsWith('.ts')) {
      const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        fileName: fileURLToPath(url),
      }).outputText;
      return { format: 'module', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
try {
  const { Contract } = await import(`${referenceRoot}contract.ts`) as {
    Contract: {
      fromBidParts: (level: number, strain: string, risk: string) => unknown;
      declarerScore: (contract: unknown, vulnerable: boolean, tricks: number) => number;
    };
  };
  const strains = ['clubs', 'diamonds', 'hearts', 'spades', 'no-trumps'] as const;
  const referenceStrains = ['C', 'D', 'H', 'S', 'NT'];
  const doublings = ['undoubled', 'doubled', 'redoubled'] as const;
  const risks = ['', 'X', 'XX'];
  const cases = [];
  for (let level = 1; level <= 7; level++) {
    for (const [strainIndex, strain] of strains.entries()) {
      for (const [doublingIndex, doubling] of doublings.entries()) {
        for (const vulnerable of [false, true]) {
          for (let tricks = 0; tricks <= 13; tricks++) {
            const contract = Contract.fromBidParts(level, referenceStrains[strainIndex], risks[doublingIndex]);
            // F6: contract-bridge uses zero-based levels, over/undertricks and NS-relative scores.
            // Declarer 0 (North) makes that score declaring-side-relative.
            const scores = {
              'ts-contractbridge': Contract.declarerScore(contract, vulnerable, tricks),
              'contract-bridge': score(level - 1, strainIndex, doublingIndex, 0, Number(vulnerable), tricks - level - 6),
            };
            if (!Object.values(scores).every(Number.isFinite)) throw new Error(`Non-finite reference score: ${JSON.stringify({ level, strain, doubling, vulnerable, tricks })}`);
            cases.push({ level, strain, doubling, vulnerable, tricks, scores });
          }
        }
      }
    }
  }
  const data = {
    generatedBy: 'scripts/scoring/generate-f6-reference.ts',
    references: [
      { name: 'ts-contractbridge', source: 'https://github.com/RalphLipe/ts-contractbridge/tree/8a788cf0a926ea0413f9d21091858bf4dc95bcfc/packages/ts-contractbridge', commit: '8a788cf0a926ea0413f9d21091858bf4dc95bcfc', licence: 'MIT' },
      { name: 'contract-bridge', source: 'https://www.npmjs.com/package/contract-bridge/v/3.2.1', version: '3.2.1', licence: 'MIT' },
    ],
    cases,
  };
  await writeFile(new URL('../../src/table/f6-reference.json', import.meta.url), `${JSON.stringify(data, null, 2)}\n`);
  const disagreements = cases.filter(entry => entry.scores['ts-contractbridge'] !== entry.scores['contract-bridge']);
  console.log(`Generated ${cases.length} cases; ${disagreements.length} reference disagreements.`);
  if (disagreements.length) console.error(JSON.stringify(disagreements, null, 2));
} finally {
  hooks.deregister();
}
