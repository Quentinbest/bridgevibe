import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer, type Plugin, type ResolvedConfig } from 'vite';
import { parseMessage, type MessageNode } from '../../src/explanation/format.js';
import type { Entry } from '../../src/explanation/types.js';
import { trimFont, type Family } from './subset.js';
import sources from './sources.json' with { type: 'json' };

const families: Record<string, Family> = { 'zh-Hans': 'SC', 'zh-Hant': 'TC', ja: 'JP' };
const punctuation = '、。，．・：；？！「」『』（）〔〕【】《》〈〉ー～…—“”‘’　';
const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join('');
function literals(nodes: readonly MessageNode[]): string {
  return nodes.map(node => node.type === 'literal' ? node.value : node.type === 'plural' || node.type === 'select' ? [...node.branches.values()].map(literals).join('') : '').join('');
}
export function latinRanges(root: string): [number, number][] {
  const dir = path.join(root, 'node_modules/@fontsource/ibm-plex-sans');
  const css = readFileSync(path.join(dir, 'latin-400.css'), 'utf8');
  const file = /url\(\.\/files\/([^)]*\.woff2)\)/.exec(css)?.[1];
  if (!file) throw new Error('Latin font source missing');
  const declarations = readFileSync(path.join(dir, '400.css'), 'utf8').split(/(?=\/\* ibm-plex-sans-)/);
  const rule = declarations.find(value => value.includes(file));
  const range = /unicode-range:\s*([^;]+);/.exec(css)?.[1] ?? /unicode-range:\s*([^;]+);/.exec(rule ?? '')?.[1];
  if (!range) throw new Error('Latin font unicode-range missing');
  return range.split(',').map(item => {
    const match = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(item.trim());
    if (!match) throw new Error(`Invalid unicode-range: ${item}`);
    return [parseInt(match[1], 16), parseInt(match[2] ?? match[1], 16)];
  });
}
export function characters(entries: Readonly<Record<string, Entry>>, locale: string, latin: readonly [number, number][] = []): { text: string; keys: Record<string, string> } {
  const keys: Record<string, string> = {};
  for (const [key, entry] of Object.entries(entries)) {
    if (entry.scope !== 'learner') continue;
    const text = literals(parseMessage(entry.text));
    // I18N-16.1, §6.5 rule 4: suits, card faces and decorative icons (`*-symbol`, aria-hidden) render
    // with the shared suit and system stack, as in English, so they're checked, not trimmed.
    if (/^(symbol|face)\.|-symbol$/.test(key)) {
      if (!(key.startsWith('face.') ? /^[AKQJ0-9]*$/u : /^[♠♥♦♣✕]*$/u).test(text)) throw new Error(`${key}: invalid suit, card face or icon`);
    } else keys[key] = text;
  }
  const extra = ascii + punctuation + new Intl.ListFormat(locale, { type: 'conjunction' }).format(['A', 'B', 'C']) + [0, 1, -1, 1234567.89].map(n => new Intl.NumberFormat(locale).format(n)).join('');
  return { keys, text: [...new Set(Array.from(Object.values(keys).join('') + extra))].filter(character => !latin.some(([start, end]) => { const point = character.codePointAt(0)!; return point >= start && point <= end; })).sort().join('') };
}
export function validateFont(missing: number[], bytes: Buffer, keys: Record<string, string>): void {
  if (missing.length) {
    const point = missing[0];
    const character = String.fromCodePoint(point);
    const key = Object.keys(keys).find(name => keys[name].includes(character)) ?? 'supplemental characters';
    throw new Error(`${key}: missing glyph U+${point.toString(16).toUpperCase()} (${character})`);
  }
  if (bytes.length > 500 * 1024) throw new Error(`I18N-21.3: font exceeds 500 KB (${bytes.length} bytes)`);
}
// §6.6: a build that includes a CJK locale needs the fetched sources.
export function fontSource(root: string, family: Family, weight: 'Regular' | 'SemiBold'): { sourcePath: string; absolute: string } {
  const source = sources.find(item => item.family === family)!;
  const sourcePath = `.font-sources/${source.package.split('/').at(-1)}-${source.version}/IBMPlexSans${family}-${weight}.woff2`;
  const absolute = path.join(root, sourcePath);
  if (!existsSync(absolute)) throw new Error(`${sourcePath}: run \`npm run fonts:fetch\``);
  return { sourcePath, absolute };
}
export function localeFonts(): Plugin {
  let config: ResolvedConfig;
  let command = '';
  const memory = new Map<string, Buffer>();
  const ids = new Map<string, string>();
  return {
    name: 'locale-fonts',
    configResolved(value) { config = value; command = value.command; },
    configureServer(server) {
      server.middlewares.use('/__locale-fonts/', (req, res, next) => {
        const bytes = memory.get((req.url ?? '').split('?')[0].slice(1));
        if (!bytes) return next();
        res.setHeader('Content-Type', 'font/woff2'); res.end(bytes);
      });
    },
    async buildStart() {
      ids.clear(); memory.clear();
      const loader = await createServer({ configFile: false, root: config.root, mode: config.mode, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
      try {
        const localeModule = await loader.ssrLoadModule('/src/app/locale.tsx');
        const tags: string[] = config.mode === 'production' ? localeModule.SHIPPED_LOCALES : localeModule.ELIGIBLE_LOCALES;
        for (const tag of tags.filter(tag => families[tag])) {
          const file = path.join(config.root, 'src/explanation/locales', `${tag}.ts`);
          const catalogue = existsSync(file) ? Object.values(await loader.ssrLoadModule(`/src/explanation/locales/${tag}.ts`))[0] : (await loader.ssrLoadModule('/src/app/previewLocales.ts')).previewCatalogue(tag);
          const { text, keys } = characters(catalogue as Record<string, Entry>, tag, latinRanges(config.root));
          const family = families[tag];
          const urls: string[] = [];
          for (const weight of ['Regular', 'SemiBold'] as const) {
            const { sourcePath, absolute } = fontSource(config.root, family, weight);
            const bytes = readFileSync(absolute);
            const hash = createHash('sha256').update(bytes).update(text).update(family).digest('hex');
            const cache = path.join(config.root, '.font-sources', '.cache', `${hash}.woff2`);
            let trimmed: Buffer;
            if (existsSync(cache)) trimmed = readFileSync(cache);
            else {
              const result = await trimFont(bytes, text, family);
              validateFont(result.missing, result.woff2, keys);
              trimmed = result.woff2; mkdirSync(path.dirname(cache), { recursive: true }); writeFileSync(cache, trimmed);
            }
            validateFont([], trimmed, keys);
            if (command === 'build') {
              const ref = this.emitFile({ type: 'asset', name: `BridgeVibeSans${family}-${weight}.woff2`, originalFileName: sourcePath, source: trimmed });
              urls.push(`import.meta.ROLLUP_FILE_URL_${ref}`);
            } else { memory.set(`${hash}.woff2`, trimmed); urls.push(JSON.stringify(`${config.base}__locale-fonts/${hash}.woff2`)); }
          }
          const css = urls.map((url, i) => `@font-face{font-family:"BridgeVibe Sans ${family}";src:url("' + ${url} + '") format("woff2");font-weight:${i ? 600 : 400};font-display:swap}`).join('');
          // E-03: the module also says how to wait for its own face, so app code never names a font.
          ids.set(tag, `const style=document.createElement('style');style.textContent='${css}';document.head.appendChild(style);`
            + `export function ready(){return document.fonts?Promise.all([400,600].map(weight=>document.fonts.load(weight+' 1em "BridgeVibe Sans ${family}"'))):Promise.resolve();}`);
        }
      } finally { await loader.close(); }
    },
    resolveId(id) {
      if (id.startsWith('virtual:locale-fonts/')) return path.join(config.root, 'src/app', `locale-fonts-${id.slice(21)}.js`);
    },
    load(id) {
      const match = /\/locale-fonts-(.+)\.js$/.exec(id);
      if (match) return ids.get(match[1]) ?? '';
    },
  };
}
