import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// §4.1.10: run the browser's unchanged rules core in Node, resolving its bundler imports.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const stripped = specifier.endsWith('.js') ? specifier.slice(0, -3) : specifier;
      const base = new URL(stripped, context.parentURL);
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
const { catalogue } = await import(new URL('../../src/explanation/index.ts', import.meta.url).href) as typeof import('../../src/explanation');
const { validateLocaleLessons, validateShippedLocaleList, validateSignOffStore } =
  await import(new URL('./signoff.ts', import.meta.url).href) as typeof import('./signoff');

const catalogueIds = new Set(Object.keys(catalogue));
const localesDir = new URL('../../src/explanation/locales/', import.meta.url);
const otherLocales: { locale: string; catalogue: Readonly<Record<string, import('../../src/explanation/types').Entry>> }[] = [];
if (existsSync(localesDir)) {
  for (const file of readdirSync(localesDir).filter(name => name.endsWith('.ts') && name !== 'en.ts').sort()) {
    const mod = await import(new URL(file, localesDir).href) as Record<string, unknown>;
    const value = Object.values(mod)[0];
    if (value && typeof value === 'object') {
      otherLocales.push({
        locale: file.slice(0, -3),
        catalogue: value as Readonly<Record<string, import('../../src/explanation/types').Entry>>,
      });
    }
  }
}

// US-27: optional file/directory arguments allow authors to check fixtures before adding content.
const inputs = process.argv.slice(2);
const paths = inputs.length ? inputs.map(path => pathToFileURL(resolve(path))) : [new URL('../../src/curriculum/content/', import.meta.url)];
let failed = false;

// I-12: check shipped-locales.json and sign-offs.json schema on default repository runs.
if (!inputs.length) {
  const shipped = JSON.parse(readFileSync(new URL('./shipped-locales.json', import.meta.url), 'utf8'));
  for (const message of validateShippedLocaleList(shipped)) {
    console.log(`scripts/content/shipped-locales.json: errors: ${message}`);
    failed = true;
  }
  const signOffs = JSON.parse(readFileSync(new URL('./sign-offs.json', import.meta.url), 'utf8'));
  for (const message of validateSignOffStore(signOffs)) {
    console.log(`scripts/content/sign-offs.json: errors: ${message}`);
    failed = true;
  }
}

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
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const result = validateLesson(parsed, catalogueIds);
    for (const severity of ['errors', 'warnings'] as const) {
      for (const finding of result[severity]) console.log(`${path.pathname}: ${severity}: ${finding.rule} [${finding.contentId}] ${finding.message}`);
    }
    if (result.errors.length) {
      failed = true;
      return;
    }
    // I18N-12.1: also validate lesson catalogue keys and placeholders in every present non-English locale.
    for (const { locale, catalogue: localeCatalogue } of otherLocales) {
      for (const message of validateLocaleLessons({ locale, english: catalogue, catalogue: localeCatalogue, lessons: [parsed] })) {
        console.log(`${path.pathname}: errors: ${message}`);
        failed = true;
      }
    }
  } catch (cause) {
    console.error(`${path.pathname}: ${String(cause)}`);
    failed = true;
  }
}
for (const path of paths) check(path);
process.exitCode = failed ? 1 : 0;
