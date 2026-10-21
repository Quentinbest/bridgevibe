import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// §4.1.10: run the browser's unchanged rules core in Node, resolving its bundler imports.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const suffix of ['.ts', '/index.ts']) {
        const candidate = new URL(base.href + suffix);
        if (existsSync(candidate)) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
const moduleUrl = new URL('../../src/pipeline/validate.ts', import.meta.url).href;
const { validateLesson } = await import(moduleUrl) as typeof import('../../src/pipeline/validate');
// US-27: optional file/directory arguments allow authors to check fixtures before adding content.
const inputs = process.argv.slice(2);
const paths = inputs.length ? inputs.map(path => pathToFileURL(resolve(path))) : [new URL('../../src/curriculum/content/', import.meta.url)];
let failed = false;
function check(path: URL) {
  try {
    if (statSync(path).isDirectory()) {
      if (!path.pathname.endsWith('/')) path = new URL(path.href + '/');
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        if (entry.isDirectory()) check(new URL(`${entry.name}/`, path));
        else if (entry.name.endsWith('.json')) check(new URL(entry.name, path));
      }
      return;
    }
    const result = validateLesson(JSON.parse(readFileSync(path, 'utf8')));
    for (const severity of ['errors', 'warnings'] as const) {
      for (const finding of result[severity]) console.log(`${path.pathname}: ${severity}: ${finding.rule} [${finding.contentId}] ${finding.message}`);
    }
    if (result.errors.length) failed = true;
  } catch (cause) {
    console.error(`${path.pathname}: ${String(cause)}`);
    failed = true;
  }
}
for (const path of paths) check(path);
process.exitCode = failed ? 1 : 0;
