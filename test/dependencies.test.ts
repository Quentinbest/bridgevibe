import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
for (const [fixture, rule] of [
  ['table-to-explanation', 'table-is-independent'],
  ['table-to-package', 'table-is-independent'],
  ['table-to-builtin', 'table-is-independent'],
  ['explanation-to-app', 'app-is-composition-root'],
  ['app-to-modules', null],
] as const) {
  test(`dependency rules: ${fixture}`, () => {
    const args = ['node_modules/dependency-cruiser/bin/dependency-cruiser.mjs', '--config', '.dependency-cruiser.cjs', `test/fixtures/${fixture}/src`];
    // The default err reporter sets a failing exit status; JSON only reports data.
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    const jsonResult = spawnSync(process.execPath, [...args, '--output-type', 'json'], { encoding: 'utf8' });
    expect(jsonResult.error).toBeUndefined();
    expect(jsonResult.status).toBe(0);
    const report = JSON.parse(jsonResult.stdout);
    expect(result.status).toBe(rule ? 1 : 0);
    expect(report.summary.violations.map((v: { rule: { name: string } }) => v.rule.name)).toEqual(rule ? [rule] : []);
  });
}
