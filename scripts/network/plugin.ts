import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { filesIn } from '../licences/plugin.js';
import { csp, scanNetwork, validatePolicy, type NetworkPolicy, type NonNetworkUrl, type PackageModule } from './core.js';

// LR-3c: only an actual installed package can own a computed-call exception.
export function packageModule(root: string, id: string): PackageModule | undefined {
  if (id.startsWith('\0') || !path.isAbsolute(id)) return;
  const file = id.replace(/[?#].*$/, '').split(path.sep).join('/');
  const own = path.relative(path.resolve(root, 'src'), file);
  if (!own.startsWith('..' + path.sep) && own !== '..' && !path.isAbsolute(own)) return;
  const match = /^(.*\/node_modules\/((?:@[^/]+\/)?[^/]+))\/(.+)$/.exec(file);
  if (!match || !existsSync(path.join(match[1], 'package.json'))) return;
  const manifest = JSON.parse(readFileSync(path.join(match[1], 'package.json'), 'utf8'));
  if (manifest.name === match[2] && typeof manifest.version === 'string') {
    return { package: manifest.name, version: manifest.version, module: match[3] };
  }
}

export function network(): Plugin {
  let config: ResolvedConfig;
  let policy: NetworkPolicy;
  let urls: NonNetworkUrl[];
  const checkedFiles = new Set<string>();
  const moduleScanner = (): Plugin => ({
    name: 'network-review-modules', apply: 'build',
    generateBundle(_output, bundle) {
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk') {
        for (const [id, module] of Object.entries(chunk.modules)) {
          if (module.code === null) continue;
          const errors = scanNetwork(id, module.code, policy, [], { computed: packageModule(config.root, id), literals: false });
          if (errors.length) this.error(`Network check failed:\n${errors.join('\n')}`);
        }
        checkedFiles.add(chunk.fileName);
      }
    },
  });
  return {
    name: 'network-review', apply: 'build', enforce: 'post',
    // LR-3c: native modulepreload needs no computed fetch polyfill in supported browsers.
    config() { return { build: { modulePreload: { polyfill: false } }, worker: { plugins: () => [moduleScanner()] } }; },
    configResolved(resolved) { config = resolved; },
    buildStart() {
      checkedFiles.clear();
      const read = (name: string): unknown => JSON.parse(readFileSync(path.join(config.root, 'licences', name), 'utf8'));
      const data = read('network-allow-list.json');
      const literals = read('non-network-urls.json');
      validatePolicy(data, literals);
      policy = data;
      urls = literals as NonNetworkUrl[];
    },
    generateBundle: moduleScanner().generateBundle,
    transformIndexHtml: {
      order: 'post',
      handler() { return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp(policy) }, injectTo: 'head-prepend' }]; },
    },
    writeBundle: {
      order: 'post', sequential: true,
      handler(output) {
        const dir = path.resolve(config.root, output.dir ?? config.build.outDir);
        const errors = filesIn(dir).filter(file => /\.(?:[cm]?js|html?|xhtml|svg|css)$/i.test(file)).flatMap(file =>
          scanNetwork(path.relative(dir, file).split(path.sep).join('/'), readFileSync(file, 'utf8'), policy, urls,
            { computed: checkedFiles.has(path.relative(dir, file).split(path.sep).join('/')) ? false : undefined }));
        if (errors.length) this.error(`Network check failed:\n${errors.join('\n')}`);
      },
    },
  };
}
