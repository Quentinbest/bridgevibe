import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin, ResolvedConfig } from 'vite';
import { buildBom, prohibitedPaths, renderNotice, scanBytes } from './core.js';
import type { Asset, Exception, OpenItem, Shipped } from './core.js';
import denylist from './denylist.json' with { type: 'json' };

const relative = (root: string, file: string) => path.relative(root, file).split(path.sep).join('/');
const hashOf = (bytes?: Uint8Array) => bytes ? `sha256:${createHash('sha256').update(bytes).digest('hex')}` : 'unknown';
// US-46.1: licence and notice files, including third-party collections such as THIRD-PARTY-LICENSE
// or THIRD_PARTY_NOTICES.txt, but not code or data that merely mentions a licence.
export const isLicenceFile = (name: string) => /^(?:[^.]*[-_. ])?(?:licen[cs]es?|copying|notices?)(?:[-_. ][^/]*)?$/i.test(name) && !/\.(?:[cm]?[jt]sx?|json|map)$/i.test(name);
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
export function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}

// LR-7: package.json supplies identity/version only. The grant comes from actual files.
export function resolveArtefact(root: string, id: string, shippedFile: string, assets: Record<string, Asset>, emitted?: Uint8Array): Shipped {
  const source = id.replace(/[?#].*$/, '');
  let file = path.resolve(root, source);
  let bundler = false;
  if (source.startsWith('\0')) {
    const provider = /^\0vite\/(?:preload-helper|modulepreload-polyfill)\.js$/.test(source) ? 'vite'
      : source === '\0rolldown/runtime.js' ? 'rolldown' : undefined;
    if (!provider) return { name: source, kind: 'bundler', version: 'unknown', licenceFiles: [], notices: [], texts: [], shippedFiles: [shippedFile], problem: `${source}: unknown virtual module` };
    file = path.join(root, 'node_modules', provider, 'package.json');
    bundler = true;
  }
  let dir = path.dirname(file);
  while (relative(root, dir).split('/').includes('node_modules')) {
    const manifest = path.join(dir, 'package.json');
    if (existsSync(manifest)) {
      const pkg = readJson<{ name?: string; version?: string }>(manifest);
      if (pkg.name && pkg.version) {
        const licenceFiles = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && isLicenceFile(entry.name))
          .map(entry => path.join(dir, entry.name)).sort();
        const texts = licenceFiles.map(name => readFileSync(name, 'utf8'));
        return { name: pkg.name, kind: bundler ? 'bundler' : pkg.name.startsWith('@fontsource/') ? 'font' : 'npm', version: pkg.version,
          licenceFiles: licenceFiles.map(name => relative(root, name)), texts, notices: texts, shippedFiles: [shippedFile] };
      }
    }
    dir = path.dirname(dir);
  }
  const repoPath = relative(root, file);
  const registered = assets[repoPath] ?? assets[shippedFile];
  if (!registered && (repoPath === 'index.html' || /^src\/.*\.(?:[cm]?[jt]sx?|css)$/.test(repoPath))) {
    return { name: 'first-party', kind: 'first-party', version: readJson<{ version: string }>(path.join(root, 'package.json')).version,
      licenceFiles: [], texts: [], notices: [], shippedFiles: [shippedFile] };
  }
  const licencePath = registered && path.resolve(root, registered.licenceFile);
  const texts = licencePath && existsSync(licencePath) ? [readFileSync(licencePath, 'utf8')] : [];
  return { name: repoPath, source: assets[repoPath] ? repoPath : shippedFile, kind: /\.wasm$/i.test(file) ? 'wasm' : 'asset', version: hashOf(emitted ?? (existsSync(file) ? readFileSync(file) : undefined)),
    licenceFiles: licencePath ? [relative(root, licencePath)] : [], texts,
    notices: registered ? [registered.attribution, ...texts] : [], shippedFiles: [shippedFile] };
}

export interface LicenceOptions { reportPath?: string }
export function licences(options: LicenceOptions = {}): Plugin {
  let config: ResolvedConfig;
  const shipped = new Map<string, Shipped>();
  const paths = new Set<string>();
  let assets: Record<string, Asset>;
  const add = (id: string, output: string, emitted?: Uint8Array) => {
    const item = resolveArtefact(config.root, id, output, assets, emitted);
    // LR-3: keep every module and output path, which grouping by package would hide.
    if (!id.startsWith('\0')) paths.add(relative(config.root, path.resolve(config.root, id.replace(/[?#].*$/, ''))));
    paths.add(output);
    const key = `${item.name}@${item.version}:${item.licenceFiles.join(',')}`;
    const previous = shipped.get(key);
    if (previous) previous.shippedFiles = [...new Set([...previous.shippedFiles, output])].sort();
    else shipped.set(key, item);
  };
  return {
    name: 'licences', apply: 'build', enforce: 'post',
    // US-46.5: never inline assets, so CSS images retain source paths for attribution.
    config() { return { build: { assetsInlineLimit: () => false } }; },
    configResolved(resolved) { config = resolved; },
    buildStart() {
      shipped.clear();
      paths.clear();
      assets = readJson<Record<string, Asset>>(path.join(config.root, 'licences/assets.json'));
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') {
            for (const id of Object.keys(output.modules)) add(id, output.fileName);
          } else {
            for (const id of output.originalFileNames) add(id, output.fileName);
            // US-46.1: an asset generated by a plugin has no source file, so hash what it emits.
            if (!output.originalFileNames.length) add(output.fileName, output.fileName, typeof output.source === 'string' ? Buffer.from(output.source) : output.source);
          }
        }
        if (config.publicDir && config.build.copyPublicDir) {
          for (const file of filesIn(config.publicDir)) add(file, relative(config.publicDir, file));
        }
      },
    },
    writeBundle: {
      order: 'post', sequential: true,
      handler(output) {
        const outDir = path.resolve(config.root, output.dir ?? config.build.outDir);
        const bom = buildBom([...shipped.values()].sort((a, b) => a.name.localeCompare(b.name)),
          readJson<Exception[]>(path.join(config.root, 'licences/allow-list.json')), assets,
          readJson<OpenItem[]>(path.join(config.root, 'licences/open-items.json')), denylist);
        writeFileSync(path.join(outDir, 'NOTICE.txt'), renderNotice(bom));
        const covered = new Set(bom.artefacts.flatMap(item => item.shippedFiles));
        for (const file of filesIn(outDir)) {
          const name = relative(outDir, file);
          if (name !== 'NOTICE.txt' && !covered.has(name)) bom.violations.push(`${name}: unattributed shipped file`);
        }
        bom.violations.push(...prohibitedPaths([...paths], denylist));
        bom.violations.push(...scanBytes(filesIn(outDir).map(file => ({ path: relative(outDir, file), bytes: readFileSync(file) })), denylist));
        const report = path.resolve(config.root, options.reportPath ?? process.env.BRIDGEVIBE_LICENCE_REPORT ?? 'licence-report/bom.json');
        mkdirSync(path.dirname(report), { recursive: true });
        writeFileSync(report, JSON.stringify(bom, null, 2) + '\n');
        if (bom.violations.length) this.error(`Licence check failed:\n${bom.violations.join('\n')}`);
      },
    },
  };
}
