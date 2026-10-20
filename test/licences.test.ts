import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { buildBom, classifyLicence, grantsIn, prohibitedPaths, renderNotice, scanBytes } from '../scripts/licences/core';
import type { Asset, Bom, Exception, Shipped } from '../scripts/licences/core';
import { filesIn, isLicenceFile, licences, resolveArtefact } from '../scripts/licences/plugin';
import denylist from '../scripts/licences/denylist.json';

const root = process.cwd();
const fixtures = path.join(root, 'test/fixtures/licences');
const text = (name: string) => readFileSync(path.join(fixtures, 'texts', `${name}.txt`), 'utf8');
const temps: string[] = [];
function temp() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bridgevibe-licences-'));
  temps.push(dir);
  return dir;
}
afterEach(() => { vi.unstubAllEnvs(); for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function pkg(name: string): Shipped {
  const dir = temp();
  cpSync(path.join(fixtures, 'packages'), path.join(dir, 'node_modules'), { recursive: true });
  return resolveArtefact(dir, path.join(dir, 'node_modules', name, 'index.js'), 'assets/app.js', {});
}
const exception = (name: string): Exception => ({ package: name, version: '1.0.0', reason: 'Fixture review', reviewer: 'Fixture reviewer', date: '2026-10-19' });
const bom = (items: Shipped[], exceptions: Exception[] = [], assets: Record<string, Asset> = {}) => buildBom(items, exceptions, assets, [], denylist);

// LR-7: real licence texts, including Vite's bundled third-party appendix.
describe('licence classification', () => {
  it.each(['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', 'OFL-1.1'])('%s', name => {
    expect(classifyLicence(text(name))).toBe(name);
  });
  it.each(['GPL-3.0', 'LGPL-2.1', 'AGPL-3.0'])('rejects %s', name => {
    expect(classifyLicence(text(name))).toBe('GPL-family');
  });
  it('classifies Vite by its primary MIT grant', () => {
    expect(classifyLicence(readFileSync('node_modules/vite/LICENSE.md', 'utf8'))).toBe('MIT');
  });
  it('recognises BSD-2, 0BSD and Unlicense grants', () => {
    expect(classifyLicence('Redistribution and use in source and binary forms are permitted. Redistributions of source code must retain copyright. Redistributions in binary form must reproduce copyright.')).toBe('BSD-2-Clause');
    expect(classifyLicence('Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted. THE SOFTWARE IS PROVIDED "AS IS"')).toBe('0BSD');
    expect(classifyLicence('This is free and unencumbered software released into the public domain. Anyone is free to copy, modify, publish, use, compile, sell, or distribute')).toBe('Unlicense');
  });
});

it('ignores the MIT metadata when no licence file exists, or the file is GPL', () => {
  expect(bom([pkg('metadata-only')]).violations.join()).toContain('no explicit grant');
  expect(bom([pkg('gpl')]).violations.join()).toContain('GPL-family');
});
it('requires reviewed exceptions, records them, and never exempts GPL', () => {
  const item = pkg('unknown');
  expect(bom([item]).violations.join()).toContain('no explicit grant');
  const allowed = bom([item], [exception('unknown')]);
  expect(allowed.violations).toEqual([]);
  expect(allowed.artefacts[0].exceptions).toEqual([exception('unknown')]);
  for (const field of ['reviewer', 'reason'] as const) {
    expect(bom([item], [{ ...exception('unknown'), [field]: '' }]).violations.join()).toContain('Invalid allow-list');
  }
  expect(bom([item], [{ ...exception('unknown'), version: '2.0.0' }]).violations.join()).toContain('no explicit grant');
  expect(bom([pkg('gpl')], [exception('gpl')]).violations.join()).toContain('GPL-family');
});
// LR-4: a dual-licensed package ships only under a reviewed election of a grant its files make.
it('lets a reviewed election clear a dual-licensed package, never a GPL-only one', () => {
  const dual = pkg('dual');
  expect(grantsIn(dual.texts[0])).toEqual(['GPL-family', 'MIT']);
  expect(bom([dual]).violations.join()).toContain('GPL-family');
  expect(bom([dual], [exception('dual')]).violations.join()).toContain('GPL-family');
  expect(bom([dual], [{ ...exception('dual'), elected: 'Apache-2.0' }]).violations.join()).toContain('GPL-family');
  expect(bom([dual], [{ ...exception('dual'), elected: 'MIT', reviewer: '' }]).violations.join()).toContain('GPL-family');
  const elected = bom([dual], [{ ...exception('dual'), elected: 'MIT' }]);
  expect(elected.violations).toEqual([]);
  expect(elected.artefacts[0]).toMatchObject({ licence: 'MIT (elected; also GPL-family)', exceptions: [{ elected: 'MIT' }] });
  expect(bom([pkg('gpl')], [{ ...exception('gpl'), elected: 'MIT' }]).violations.join()).toContain('GPL-family');
  // LR-2: an election does not vouch for another, unrecognised licence file.
  const extra: Shipped = { ...dual, licenceFiles: [...dual.licenceFiles, 'LICENSE-EXTRA'], texts: [...dual.texts, text('unknown')] };
  expect(bom([extra], [{ ...exception('dual'), elected: 'MIT' }]).violations.join()).toContain('no explicit grant');
  const both = bom([extra], [{ ...exception('dual'), elected: 'MIT' }, exception('dual')]);
  expect(both.violations).toEqual([]);
  expect(both.artefacts[0].exceptions).toHaveLength(2);
});
// LR-7: a NOTICE's grants belong to the bundled code it attributes, not to the artefact.
it('never takes a grant or an election from a NOTICE file', () => {
  const withNotice = (name: string): Shipped => {
    const item = pkg(name);
    return { ...item, licenceFiles: [...item.licenceFiles, 'NOTICE'], texts: [...item.texts, text('MIT')], notices: [...item.notices, text('MIT')] };
  };
  expect(bom([withNotice('unknown')]).violations.join()).toContain('no explicit grant');
  expect(bom([withNotice('gpl')], [{ ...exception('gpl'), elected: 'MIT' }]).violations.join()).toContain('GPL-family');
  const mit = pkg('unknown');
  const gplNotice: Shipped = { ...mit, licenceFiles: ['LICENSE', 'NOTICE'], texts: [text('MIT'), text('GPL-3.0')] };
  expect(bom([gplNotice]).violations.join()).toContain('GPL-family');
  expect(bom([gplNotice], [{ ...exception('unknown'), elected: 'MIT' }]).violations.join()).toContain('GPL-family');
});
// US-46.1: third-party notice collections are attributed in NOTICE but grant nothing themselves.
it('ships third-party notice files without taking grants from them', () => {
  expect(['THIRD-PARTY-LICENSE', 'THIRD_PARTY_NOTICES.txt', 'LICENSE-MIT', 'COPYING.LESSER'].every(isLicenceFile)).toBe(true);
  expect(['license-checker.js', 'licenses.json', 'noticeboard.js', 'README.md'].some(isLicenceFile)).toBe(false);
  const item = pkg('third-party');
  expect(item.licenceFiles.map(file => path.basename(file))).toEqual(['LICENSE', 'THIRD_PARTY_NOTICES.txt']);
  const report = bom([item]);
  expect(report.violations).toEqual([]);
  expect(renderNotice(report)).toContain('Bundled component: tiny-helper 2.0.0');
  const onlyThirdParty: Shipped = { ...item, licenceFiles: ['THIRD-PARTY-LICENSE'], texts: [text('MIT')] };
  expect(bom([onlyThirdParty]).violations.join()).toContain('no explicit grant');
  const gplThirdParty: Shipped = { ...item, licenceFiles: ['LICENSE', 'THIRD-PARTY-LICENSE'], texts: [text('MIT'), text('GPL-3.0')] };
  expect(bom([gplThirdParty]).violations.join()).toContain('GPL-family');
});
// US-46.1: a plugin-generated asset is versioned by the bytes it emits.
it('hashes a generated asset and rejects one without a version', () => {
  const assets = { 'generated/data.bin': { licenceFile: 'test/fixtures/licences/texts/MIT.txt', licence: 'MIT', attribution: 'Fixture generator' } };
  const hashed = bom([resolveArtefact(root, 'generated/data.bin', 'generated/data.bin', assets, Buffer.from('data'))], [], assets);
  expect(hashed.violations).toEqual([]);
  expect(hashed.artefacts[0].version).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(bom([resolveArtefact(root, 'generated/data.bin', 'generated/data.bin', assets)], [], assets).violations.join()).toContain('unknown version');
  // A same-named repository file must not stand in for the emitted bytes.
  const emitted = resolveArtefact(root, 'package.json', 'package.json', {}, Buffer.from('data'));
  expect(emitted.version).toBe(hashed.artefacts[0].version);
});
it('does not let a known grant hide another unrecognised licence file', () => {
  const item = pkg('unknown');
  item.licenceFiles.push('LICENSE-MIT');
  item.texts.push(text('MIT'));
  expect(bom([item]).violations.join()).toContain('no explicit grant');
  item.licenceFiles[0] = 'NOTICE';
  expect(bom([item]).violations).toEqual([]);
});
it('rejects prohibited package segments without matching innocent substrings', () => {
  expect(bom([pkg('epbot-wasm')], [exception('epbot-wasm')]).violations.join()).toContain('prohibited package');
  for (const name of ['bba', '@vendor/bga-engine', 'suitc.wasm', 'epbot-wasm', '@bba/engine', '@epbot/runtime']) {
    expect(bom([{ ...pkg('epbot-wasm'), name }]).violations.join()).toContain('prohibited package');
  }
  expect(bom([{ ...pkg('epbot-wasm'), name: 'rabbit' }]).violations).toEqual([]);
  // LR-3: a prohibited file inside an innocently named package is still caught by its path.
  expect(prohibitedPaths(['node_modules/innocent/vendor/bba.wasm', 'node_modules/react/index.js', 'assets/rabbit.svg'], denylist))
    .toEqual(['node_modules/innocent/vendor/bba.wasm: prohibited path (LR-3)']);
});
it('scans binary pons weights and clean wasm without an exception bypass', () => {
  const files = filesIn(path.join(fixtures, 'output')).map(file => ({ path: file, bytes: readFileSync(file) }));
  expect(scanBytes(files.filter(file => file.path.endsWith('clean.wasm')), denylist)).toEqual([]);
  expect(scanBytes(files, denylist).join()).toContain('american_bba_');
  const report = bom([pkg('unknown')], [exception('unknown')]);
  report.violations.push(...scanBytes(files, denylist));
  expect(report.violations.join()).toContain('american_bba_');
});
it('requires registration and reads actual asset licences and attribution', () => {
  const source = 'public/icons/suit.svg';
  expect(bom([resolveArtefact(root, source, 'icons/suit.svg', {})]).violations.join()).toContain('undeclared asset');
  const assets = { [source]: { licenceFile: 'test/fixtures/licences/texts/MIT.txt', licence: 'MIT', attribution: 'Fixture artist' } };
  const report = bom([resolveArtefact(root, source, 'icons/suit.svg', assets, Buffer.from('<svg/>'))], [], assets);
  expect(report.violations).toEqual([]);
  expect(report.artefacts[0]).toMatchObject({ kind: 'asset', licence: 'MIT', notices: ['Fixture artist', text('MIT')] });
  expect(bom([resolveArtefact(root, 'src/suit.svg', 'assets/suit.svg', {})]).violations.join()).toContain('undeclared asset');
  expect(bom([resolveArtefact(root, '\0unrecognised-helper', 'assets/app.js', {})]).violations.join()).toContain('unknown virtual module');
});
it('preserves DEP-08 open items and deduplicates full licence notices', () => {
  const openItems = JSON.parse(readFileSync(path.join(fixtures, 'open-items.json'), 'utf8'));
  const item = pkg('epbot-wasm');
  const report = buildBom([{ ...item, name: 'allowed' }, { ...item, name: 'another' }], [], {}, openItems, denylist);
  expect(report.openItems).toEqual(openItems);
  const notice = renderNotice(report);
  expect(notice.split(text('MIT'))).toHaveLength(2);
});

it('builds the real app with complete attribution and distributable notices', async () => {
  const dir = temp();
  const reportPath = path.join(dir, 'report/bom.json');
  // US-46.1: exercise the unchanged repository config with an isolated report destination.
  vi.stubEnv('BRIDGEVIBE_LICENCE_REPORT', reportPath);
  await build({ configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent',
    build: { outDir: path.join(dir, 'dist') } });
  const report: Bom = JSON.parse(readFileSync(reportPath, 'utf8'));
  expect(report.violations).toEqual([]);
  for (const name of ['react', 'react-dom', 'scheduler', 'first-party', 'vite', 'rolldown']) {
    expect(report.artefacts.some(item => item.name === name)).toBe(true);
  }
  for (const name of ['bricolage-grotesque', 'ibm-plex-mono', 'ibm-plex-sans']) {
    const font = report.artefacts.find(item => item.name === `@fontsource/${name}`);
    expect(font).toMatchObject({ kind: 'font', licence: 'OFL-1.1' });
    expect(font?.shippedFiles.some(file => file.endsWith('.woff2'))).toBe(true);
  }
  const notice = readFileSync(path.join(dir, 'dist/NOTICE.txt'), 'utf8');
  expect(notice).toContain('SIL OPEN FONT LICENSE');
  expect(notice).toContain('Copyright (c) Facebook, Inc. and its affiliates.');
  for (const item of report.artefacts) for (const file of item.licenceFiles) {
    expect(notice).toContain(readFileSync(file, 'utf8'));
  }
}, 60_000);

it('writes a failing build BOM before throwing, including a binary tripwire', async () => {
  const dir = temp();
  writeFileSync(path.join(dir, 'index.html'), '<script type="module" src="/main.js"></script>');
  writeFileSync(path.join(dir, 'main.js'), 'console.log("fixture");');
  writeFileSync(path.join(dir, 'package.json'), '{"version":"1.0.0"}');
  cpSync(path.join(root, 'licences'), path.join(dir, 'licences'), { recursive: true });
  const reportPath = path.join(dir, 'bom.json');
  await expect(build({ root: dir, configFile: false, logLevel: 'silent', plugins: [licences({ reportPath }), {
    name: 'binary-fixture', generateBundle() { this.emitFile({ type: 'asset', fileName: 'pons.wasm', source: readFileSync(path.join(fixtures, 'output/pons.wasm')) }); },
  }] })).rejects.toThrow('Licence check failed');
  const report: Bom = JSON.parse(readFileSync(reportPath, 'utf8'));
  expect(report.violations.join()).toContain('american_bba_');
}, 60_000);

// US-46.5: small CSS images must be attributed even below Vite's inline threshold.
it('rejects an undeclared small CSS image and accepts it once registered', async () => {
  const dir = temp();
  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'index.html'), '<script type="module" src="/src/main.js"></script>');
  writeFileSync(path.join(dir, 'src/main.js'), 'import "./styles.css";');
  writeFileSync(path.join(dir, 'src/styles.css'), 'body { background-image: url("./suit.svg"); }');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h8v8H0z"/></svg>';
  expect(Buffer.byteLength(svg)).toBeLessThan(1024);
  writeFileSync(path.join(dir, 'src/suit.svg'), svg);
  writeFileSync(path.join(dir, 'package.json'), '{"version":"1.0.0"}');
  cpSync(path.join(root, 'licences'), path.join(dir, 'licences'), { recursive: true });
  writeFileSync(path.join(dir, 'licences/assets.json'), '{}');
  const reportPath = path.join(dir, 'bom.json');
  const runBuild = () => build({ root: dir, configFile: false, logLevel: 'silent',
    plugins: [licences({ reportPath })], build: { modulePreload: false, assetsInlineLimit: 4096 } });
  await expect(runBuild()).rejects.toThrow('Licence check failed');
  const failed: Bom = JSON.parse(readFileSync(reportPath, 'utf8'));
  expect(failed.violations).toContain('src/suit.svg: undeclared asset');

  writeFileSync(path.join(dir, 'licences/suit-LICENSE.txt'), text('MIT'));
  writeFileSync(path.join(dir, 'licences/assets.json'), JSON.stringify({
    'src/suit.svg': { licenceFile: 'licences/suit-LICENSE.txt', licence: 'MIT', attribution: 'Fixture artist' },
  }));
  await runBuild();
  const report: Bom = JSON.parse(readFileSync(reportPath, 'utf8'));
  expect(report.violations).toEqual([]);
  const asset = report.artefacts.find(item => item.name === 'src/suit.svg');
  expect(asset).toMatchObject({ kind: 'asset', licence: 'MIT' });
  expect(asset?.shippedFiles).toHaveLength(1);
  expect(readFileSync(path.join(dir, 'dist', asset!.shippedFiles[0]), 'utf8')).toBe(svg);
}, 60_000);

// US-46.1, LR-2: a Web Worker is bundled separately; its packages are checked like the app's.
it('attributes packages bundled into a Web Worker, and fails on an unlicensed one', async () => {
  for (const licensed of [true, false]) {
    const dir = temp();
    mkdirSync(path.join(dir, 'src'));
    writeFileSync(path.join(dir, 'index.html'), '<script type="module" src="/src/main.js"></script>');
    writeFileSync(path.join(dir, 'src/main.js'), "new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });");
    writeFileSync(path.join(dir, 'src/worker.js'), "import value from 'worker-dep'; postMessage(value());");
    writeFileSync(path.join(dir, 'package.json'), '{"version":"1.0.0"}');
    const pkg = path.join(dir, 'node_modules/worker-dep');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(path.join(pkg, 'package.json'), '{"name":"worker-dep","version":"2.0.0","main":"index.js","license":"MIT"}');
    writeFileSync(path.join(pkg, 'index.js'), 'export default function value() { return Date.now() % 7; }');
    if (licensed) writeFileSync(path.join(pkg, 'LICENSE'), text('MIT'));
    cpSync(path.join(root, 'licences'), path.join(dir, 'licences'), { recursive: true });
    const reportPath = path.join(dir, 'bom.json');
    const run = build({ root: dir, configFile: false, logLevel: 'silent', plugins: [licences({ reportPath })], build: { modulePreload: false } });
    if (licensed) await run; else await expect(run).rejects.toThrow('Licence check failed');
    const report: Bom = JSON.parse(readFileSync(reportPath, 'utf8'));
    const dep = report.artefacts.find(item => item.name === 'worker-dep');
    expect(dep?.shippedFiles.some(file => /worker-[\w-]+\.js$/.test(file))).toBe(true);
    if (licensed) expect(report.violations).toEqual([]);
    else expect(report.violations.join()).toContain('worker-dep: no explicit grant');
  }
}, 60_000);
