import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import config from '../vitest.config';

// #111: packages reached only through dynamic imports (the solver adapters) must be prebundled for the
// browser project, or Vite can discover them mid-run and reload the page under a running test.
test('browser project prebundles every package the lazily loaded bridge-dds adapter imports', () => {
  const adapter = readFileSync(new URL('../src/analysis/bridgeDdsAdapter.ts', import.meta.url), 'utf8');
  const packages = [...adapter.matchAll(/from '([^.'][^']*)'/g)].map(match => match[1]);
  expect(packages).toContain('bridge-dds');
  const browser = config.test!.projects!.find(project => typeof project === 'object' && 'test' in project && project.test?.name === 'browser');
  expect(browser).toBeDefined();
  expect((browser as { optimizeDeps?: { include?: string[] } }).optimizeDeps?.include).toEqual(expect.arrayContaining(packages));
});

// E-06: browser and node tests must both reset the module-level active catalogue.
test('every project registers locale isolation', () => {
  const projects = config.test!.projects!;
  expect(projects).toHaveLength(2);
  for (const project of projects) {
    expect(typeof project === 'object' && 'test' in project && project.test?.setupFiles).toContain('./test/setupLocale.ts');
  }
});
