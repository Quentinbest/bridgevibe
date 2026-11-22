import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createServer, type Plugin, type ResolvedConfig } from 'vite';
import type { Lesson } from '../../src/curriculum/model.js';
import type { Entry } from '../../src/explanation/types.js';
import type { LocaleGlossary } from '../../src/explanation/glossary/types.js';

export type LocaleSignOffPluginOptions = {
  shipped?: unknown;
  signOffs?: unknown;
  english?: Readonly<Record<string, Entry>>;
  locales?: Readonly<Record<string, Readonly<Record<string, Entry>>>>;
  glossaries?: Readonly<Record<string, LocaleGlossary | undefined>>;
  lessons?: readonly Lesson[];
};

function readLessons(root: string): Lesson[] {
  const dir = path.join(root, 'src/curriculum/content');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(file => file.endsWith('.json')).sort()
    .map(file => JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Lesson);
}

// I-12, Q2, E-01: production builds fail on unsigned or stale shipped locales; non-production builds warn.
export function localeSignOff(options: LocaleSignOffPluginOptions = {}): Plugin {
  let config: ResolvedConfig;
  let command = '';
  return {
    name: 'locale-signoff',
    configResolved(resolved) { config = resolved; command = resolved.command; },
    async buildStart() {
      if (command !== 'build') return;
      const shipped = options.shipped ?? JSON.parse(readFileSync(path.join(config.root, 'scripts/content/shipped-locales.json'), 'utf8'));
      const signOffs = options.signOffs ?? JSON.parse(readFileSync(path.join(config.root, 'scripts/content/sign-offs.json'), 'utf8'));

      // Load TypeScript helpers through Vite's SSR loader so vite.config.ts stays compatible with native configLoader.
      const loader = await createServer({
        configFile: false, root: config.root, mode: config.mode, define: config.define,
        server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent',
      });
      let english = options.english;
      let locales = options.locales;
      let glossaries = options.glossaries;
      let validateLocaleRelease: typeof import('./signoff.js').validateLocaleRelease;
      let glossaryTerms: typeof import('../../src/explanation/glossary/lint.js').glossaryTerms;
      try {
        ({ validateLocaleRelease } = await loader.ssrLoadModule('/scripts/content/signoff.ts') as typeof import('./signoff.js'));
        ({ glossaryTerms } = await loader.ssrLoadModule('/src/explanation/glossary/lint.ts') as typeof import('../../src/explanation/glossary/lint.js'));
        if (!english) {
          english = (await loader.ssrLoadModule('/src/explanation/locales/en.ts')).en as Readonly<Record<string, Entry>>;
        }
        if (!glossaries) {
          glossaries = (await loader.ssrLoadModule('/src/explanation/glossary/index.ts')).glossaries as Readonly<Record<string, LocaleGlossary | undefined>>;
        }
        if (!locales) {
          const loaded: Record<string, Readonly<Record<string, Entry>>> = {};
          for (const tag of Array.isArray(shipped) ? shipped : []) {
            if (typeof tag !== 'string' || tag === 'en') continue;
            const file = path.join(config.root, 'src/explanation/locales', `${tag}.ts`);
            if (!existsSync(file)) continue;
            const mod = await loader.ssrLoadModule(`/src/explanation/locales/${tag}.ts`);
            const value = Object.values(mod)[0];
            if (value && typeof value === 'object') loaded[tag] = value as Readonly<Record<string, Entry>>;
          }
          locales = loaded;
        }
      } finally { await loader.close(); }

      const lessons = options.lessons ?? readLessons(config.root);
      const terms = glossaryTerms(readFileSync(path.join(config.root, 'GLOSSARY.md'), 'utf8'));
      const { errors } = validateLocaleRelease({
        shipped,
        english: english!,
        locales: locales ?? {},
        glossaries: glossaries ?? {},
        glossaryDomainTerms: terms,
        lessons,
        signOffs,
      });

      if (!errors.length) return;
      const summary = `Locale sign-off check failed:\n${errors.join('\n')}`;
      // Q2, E-01: never silently drop a shipped locale; fail production builds and warn in non-production builds.
      if (config.mode === 'production') this.error(summary);
      else config.logger.warn(summary);
    },
  };
}
