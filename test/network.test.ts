import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { afterEach, expect, it } from 'vitest';
import { csp, scanNetwork, validatePolicy, type NetworkPolicy } from '../scripts/network/core.js';
import { network, packageModule } from '../scripts/network/plugin.js';

const review = { reason: 'Fixture review', reviewer: 'Fixture reviewer', date: '2026-10-21' };
const empty: NetworkPolicy = { origins: [], computed: [] };
const scan = (code: string, policy = empty) => scanNetwork('assets/app.js', code, policy, []);
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

// LR-3c, US-46.3: emitted code, including minified template strings and property APIs.
it('allows only reviewed origins and harmless relative assets', () => {
  const policy = { ...empty, origins: [{ origin: 'https://reviewed.example', ...review }] };
  expect(scan('fetch("https://reviewed.example/data")', policy)).toEqual([]);
  expect(scan('fetch("./assets/solver.wasm")')).toEqual([]);
  expect(scan('fetch("/rapid/file")').join()).toContain('/rapid/file');
  expect(csp(policy)).toContain("connect-src 'self' https://reviewed.example;");
  expect(scanNetwork('index.html', `<meta content="${csp(policy)}">`, policy, [])).toEqual([]);
});

it.each([
  'fetch("/api/bba/analyse")', 'fetch("../API/analyse")',
  'fetch(target)', 'window.fetch(target)', 'globalThis["fetch"](target)',
  'new XMLHttpRequest()', 'new WebSocket(target)', 'new EventSource(target)',
  'navigator.sendBeacon(target, data)', 'importScripts(target)',
  'importScripts("./local.js", "https://outside.example/x.js")',
  'import("https://outside.example/x.js")', 'import(target)',
  'console.log("https://outside.example/path")', 'console.log(`wss://outside.example/path`)',
  'fetch("//outside.example/path")', 'fetch("data:text/plain,hello")',
  String.raw`fetch("/\\outside.example/path")`,
])('rejects %s and names the emitted file and target', code => {
  expect(scan(code).join()).toMatch(/assets\/app.js: unreviewed network target/);
});

it('exempts exact non-network literals but never their use as a call target', () => {
  const url = 'http://www.w3.org/2000/svg';
  const urls = [{ url, ...review }];
  expect(scanNetwork('app.js', `const ns = '${url}'`, empty, urls)).toEqual([]);
  expect(scanNetwork('app.js', `fetch('${url}')`, empty, urls).join()).toContain(url);
  expect(scanNetwork('app.js', `fetch(' ${url} ')`, empty, urls).join()).toContain(url);
  expect(scanNetwork('app.js', `const ns = '${url}/extra'`, empty, urls).join()).toContain('/extra');
  expect(scan('console.log(`https://outside.example/${id}`)').join()).toContain('https://outside.example/');
});

it.each([
  ['index.html', '<img src="//outside.example/api/bba/analyse">', '//outside.example/api/bba/analyse'],
  ['index.html', '<link href="https://outside.example/style.css">', 'https://outside.example/style.css'],
  ['index.html', '<img srcset="./small.png 1x, //outside.example/large.png 2x">', '//outside.example/large.png'],
  ['index.html', '<img src="&#47;&#47;outside.example/image.png">', '//outside.example/image.png'],
  ['index.html', '<img SRC=/api/bba/analyse>', '/api/bba/analyse'],
  ['index.html', '<script src="//outside.example/a>b.js"></script>', '//outside.example/a>b.js'],
  ['index.html', '<a ping="./audit //outside.example/ping">link</a>', '//outside.example/ping'],
  ['index.html', '<div style="background: url(//outside.example/image.png)"></div>', '//outside.example/image.png'],
  ['index.html', '<style>@import "//outside.example/style.css";</style>', '//outside.example/style.css'],
  ['assets/app.css', 'body { background: url(//outside.example/image.png) }', '//outside.example/image.png'],
  ['assets/app.css', '@import "//outside.example/style.css";', '//outside.example/style.css'],
  ['assets/app.css', '@import url("https://outside.example/style.css");', 'https://outside.example/style.css'],
  ['assets/app.css', 'body { background: url(/api/bba/analyse) }', '/api/bba/analyse'],
  ['assets/app.css', String.raw`body { background: u\72l(\2f\2f outside.example/image.png) }`, '//outside.example/image.png'],
  ['assets/image.svg', '<svg><image href="//outside.example/image.png"/></svg>', '//outside.example/image.png'],
])('rejects request targets in %s: %s', (file, source, target) => {
  expect(scanNetwork(file, source, empty, []).join()).toContain(`${file}: unreviewed network target ${target}`);
});

it.each(['src', 'href', 'srcset', 'poster', 'data', 'action', 'formaction', 'ping', 'background', 'manifest'])('reviews HTML %s as a request target', attribute => {
  expect(scanNetwork('index.html', `<element ${attribute}="/api/bba/analyse">`, empty, []).join()).toContain('/api/bba/analyse');
});

it('allows same-origin assets and embedded CSS data without exempting requests by diagnostic URL', () => {
  expect(scanNetwork('index.html', '<script src="/assets/index-abc.js"></script><link href="./favicon.svg"><img srcset="./one.png 1x, /two.png 2x">', empty, [])).toEqual([]);
  expect(scanNetwork('app.css', '@import "./theme.css"; body {background: url(./favicon.svg)}', empty, [])).toEqual([]);
  expect(scanNetwork('app.css', 'body {background: url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")}', empty, [])).toEqual([]);
  expect(scanNetwork('app.css', '/* url(//outside.example/image.png) */ p::before {content: "url(//outside.example/image.png)"}', empty, [])).toEqual([]);
  const url = 'https://docs.example/namespace';
  expect(scanNetwork('index.html', `<img src="${url}">`, empty, [{ url, ...review }])).not.toEqual([]);
  expect(scanNetwork('app.css', `body {background: url(${url})}`, empty, [{ url, ...review }])).not.toEqual([]);
  const policy = { ...empty, origins: [{ origin: 'https://reviewed.example', ...review }] };
  expect(scanNetwork('index.html', '<img src="//reviewed.example/image.png">', policy, [])).toEqual([]);
  expect(scanNetwork('app.css', '@import "https://reviewed.example/style.css";', policy, [])).toEqual([]);
  expect(csp(empty)).toBe("default-src 'self'; connect-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; object-src 'none'; base-uri 'self'");
});

it('pins computed exceptions to package, exact version, module, call and count', () => {
  const code = 'fetch(target)';
  const identity = { package: 'reviewed-fetch', version: '1.0.0', module: 'dist/loader.js' };
  const entry = { ...identity, call: code, count: 1, ...review };
  const policy = { ...empty, computed: [entry] };
  const check = (source = code, computed = identity) => scanNetwork('module.js', source, policy, [], { computed, literals: false });
  expect(check()).toEqual([]);
  expect(check(code, { ...identity, version: '1.0.1' })).not.toEqual([]);
  expect(check(code, { ...identity, module: 'other.js' })).not.toEqual([]);
  expect(check(code, { ...identity, package: 'unreviewed' })).not.toEqual([]);
  expect(check('fetch(other)')).not.toEqual([]);
  expect(check(`${code};${code}`)).not.toEqual([]);
  // LR-3c: absent package identity means first-party or virtual code, never exemptible.
  expect(scanNetwork('src/analysis/adapter.js', code, policy, [])).not.toEqual([]);
  expect(scanNetwork('\0vite/helper.js', code, policy, [])).not.toEqual([]);
  expect(check('console.log("analysis changed");' + code)).toEqual([]);
});

it.each([
  null, [], { origins: [], computed: [], typo: true },
  { origins: [{ origin: 'https://example.com/path', ...review }], computed: [] },
  { origins: [{ origin: 'https://example.com;', ...review }], computed: [] },
  { origins: [{ origin: 'https://example.com', ...review, reviewer: '' }], computed: [] },
  { origins: [{ origin: 'https://example.com', ...review, date: '2026-02-30' }], computed: [] },
  { origins: [], computed: [{ file: '*', call: 'fetch(x)', count: 1, ...review }] },
])('rejects malformed policy %j', policy => {
  expect(() => validatePolicy(policy, [])).toThrow('Invalid network review list');
});

it('validates the committed policy and minimal literal exceptions', () => {
  const policy: unknown = JSON.parse(readFileSync('licences/network-allow-list.json', 'utf8'));
  const urls: unknown = JSON.parse(readFileSync('licences/non-network-urls.json', 'utf8'));
  expect(() => validatePolicy(policy, urls)).not.toThrow();
  validatePolicy(policy, urls);
  expect(policy.origins).toEqual([]);
  // Reviewed on 2026-10-24 under the owner's delegation, recorded as delegated, never as an owner approval.
  const delegated = 'Delegated to Claude by the owner (2026-10-24)';
  expect(policy.computed.every(entry => entry.reviewer === delegated)).toBe(true);
  expect((urls as { reviewer: string }[]).every(entry => entry.reviewer === delegated)).toBe(true);
  expect(() => validatePolicy(empty, [{ url: 'https://example.com', reason: '' }])).toThrow();
  expect(() => validatePolicy(empty, [{ url: 'https://', ...review }])).toThrow();
});

it('reviews worker package modules independently of app changes and rejects first-party and virtual calls', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bridgevibe-network-modules-')); dirs.push(dir);
  cpSync('licences', path.join(dir, 'licences'), { recursive: true });
  const pkg = path.join(dir, 'node_modules/reviewed-fetch');
  mkdirSync(path.join(pkg, 'dist'), { recursive: true });
  const manifest = (version: string) => writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'reviewed-fetch', version, type: 'module', main: './dist/loader.js' }));
  manifest('1.0.0');
  writeFileSync(path.join(pkg, 'dist/loader.js'), 'export function load(target) { return fetch(target); }');
  const policy: NetworkPolicy = { ...empty, computed: [{ package: 'reviewed-fetch', version: '1.0.0', module: 'dist/loader.js',
    call: 'fetch(target)', count: 1, ...review }] };
  writeFileSync(path.join(dir, 'licences/network-allow-list.json'), JSON.stringify(policy));
  writeFileSync(path.join(dir, 'index.html'), '<script type="module" src="/main.js"></script>');
  const main = 'new Worker(new URL("./analysisWorker.js", import.meta.url), { type: "module" });';
  writeFileSync(path.join(dir, 'main.js'), main);
  const worker = 'import { load } from "reviewed-fetch"; globalThis.load = load;';
  writeFileSync(path.join(dir, 'analysisWorker.js'), worker);
  const run = () => build({ root: dir, configFile: false, logLevel: 'silent', plugins: [network(), {
    name: 'virtual-fixture',
    resolveId(id) { if (id === 'virtual-network') return '\0vite/network-fixture.js'; },
    load(id) { if (id === '\0vite/network-fixture.js') return 'fetch(globalThis.target);'; },
  }] });
  expect(packageModule(dir, '\0vite/network-fixture.js')).toBeUndefined();
  expect(packageModule(dir, path.join(dir, 'src/node_modules/reviewed-fetch/dist/loader.js'))).toBeUndefined();
  expect(packageModule(dir, path.join(pkg, 'dist/loader.js'))).toMatchObject({ package: 'reviewed-fetch', version: '1.0.0', module: 'dist/loader.js' });
  await run();
  // LR-3c: unrelated analysis and host changes must not require re-reviewing DDS.
  writeFileSync(path.join(dir, 'main.js'), main + 'console.log("host changed");');
  writeFileSync(path.join(dir, 'analysisWorker.js'), worker + 'postMessage("analysis changed");');
  await run();
  manifest('1.0.1');
  await expect(run()).rejects.toThrow('dist/loader.js: unreviewed network target computed: fetch(target)');
  manifest('1.0.0');
  writeFileSync(path.join(pkg, 'dist/loader.js'), 'export function load(target) { fetch(target); return fetch(target); }');
  await expect(run()).rejects.toThrow('computed: fetch(target)');
  writeFileSync(path.join(pkg, 'dist/loader.js'), 'export function load(target) { return fetch(target); }');
  writeFileSync(path.join(dir, 'analysisWorker.js'), worker + 'fetch(globalThis.target);');
  await expect(run()).rejects.toThrow('analysisWorker.js: unreviewed network target computed: fetch(globalThis.target)');
  writeFileSync(path.join(dir, 'analysisWorker.js'), worker);
  writeFileSync(path.join(dir, 'main.js'), main + 'fetch(globalThis.target);');
  await expect(run()).rejects.toThrow('main.js: unreviewed network target computed: fetch(globalThis.target)');
  writeFileSync(path.join(dir, 'main.js'), main + 'import "virtual-network";');
  await expect(run()).rejects.toThrow('vite/network-fixture.js: unreviewed network target computed: fetch(globalThis.target)');
}, 60_000);

it('scans emitted worker assets, HTML and public JS and validates policy during builds', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bridgevibe-network-')); dirs.push(dir);
  cpSync('licences', path.join(dir, 'licences'), { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), '<html><head></head><body></body></html>');
  const run = (fileName: string, source: string) => build({ root: dir, configFile: false, logLevel: 'silent',
    plugins: [network(), { name: 'fixture', generateBundle() { this.emitFile({ type: 'asset', fileName, source }); } }] });
  await expect(run('assets/worker.js', 'fetch("https://outside.example/api")')).rejects.toThrow('assets/worker.js: unreviewed network target https://outside.example/api');
  await expect(run('extra.html', '<script>fetch("/api/bba/analyse")</script>')).rejects.toThrow('/api/bba/analyse');
  await expect(run('public.js', 'fetch(target)')).rejects.toThrow('computed: fetch(target)');
  await expect(run('extra.html', '<img src="//outside.example/api/bba/analyse">')).rejects.toThrow('//outside.example/api/bba/analyse');
  await expect(run('assets/style.css', 'body {background: url(//outside.example/image.png)}')).rejects.toThrow('assets/style.css: unreviewed network target //outside.example/image.png');
  await run('safe.js', 'console.log("safe")');
  expect(readFileSync(path.join(dir, 'dist/index.html'), 'utf8')).toContain('http-equiv="Content-Security-Policy"');
  writeFileSync(path.join(dir, 'licences/network-allow-list.json'), '{"origins":[{}],"computed":[]}');
  await expect(run('safe.js', '')).rejects.toThrow('Invalid network review list');
});
