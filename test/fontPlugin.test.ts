import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer } from 'vite';
import { expect, test, vi } from 'vitest';
import type { Entry } from '../src/explanation/types';
import { characters, fontSource, isFontInput, latinRanges, validateFont } from '../scripts/fonts/plugin';

const entry = (text: string, scope: Entry['scope'] = 'learner'): Entry => ({ text, scope, status: 'draft' });

test('I18N-16.1: the trim set covers learner branches, punctuation, lists and numbers, not suits, faces or icons', () => {
  const { text, keys } = characters({
    plain: entry('橋'), branch: entry('{n, plural, other {牌 #}}'), internal: entry('学', 'internal'),
    'symbol.spades': entry('♠'), 'face.A': entry('A'), 'home.exit-symbol': entry('✕'),
  }, 'ja');
  expect(Object.keys(keys).sort()).toEqual(['branch', 'plain']);
  for (const character of ['橋', '牌', '、', '。']) expect(text).toContain(character);
  expect(text).not.toContain('学');
  expect(text).not.toContain('♠');
  expect(text).not.toContain('✕');
  expect(text).toContain(new Intl.ListFormat('ja', { type: 'conjunction' }).format(['A', 'B', 'C']).replace(/[ABC]/g, '').slice(0, 1));
});

test('I18N-16.1: suits, card faces and icons must stay in their own sets', () => {
  expect(() => characters({ 'face.A': entry('さ') }, 'ja')).toThrow('face.A: invalid suit, card face or icon');
  expect(() => characters({ 'home.exit-symbol': entry('×') }, 'ja')).toThrow('home.exit-symbol');
});

test('§6.5: characters the always-loaded IBM Plex Sans Latin subset covers are left to it', () => {
  const latin = latinRanges(process.cwd());
  const inLatin = (point: number) => latin.some(([start, end]) => point >= start && point <= end);
  expect(inLatin(0x2212)).toBe(true);
  expect(inLatin(0x1f600)).toBe(false);
  expect(characters({ minus: entry('−3') }, 'ja', latin).text).not.toContain('−');
});

test('I18N-16.1, I18N-21.3: a missing glyph names its key; an oversize font fails', () => {
  expect(() => validateFont([0x1f600], Buffer.alloc(10), { 'hint.advice': 'x😀' })).toThrow('hint.advice: missing glyph U+1F600');
  expect(() => validateFont([], Buffer.alloc(500 * 1024 + 1), {})).toThrow('I18N-21.3');
  expect(() => validateFont([], Buffer.alloc(10), {})).not.toThrow();
});

test('§6.6: a build that needs a CJK source without .font-sources says how to fetch it', () => {
  const root = mkdtempSync(join(tmpdir(), 'bridgevibe-fonts-missing-'));
  try {
    expect(() => fontSource(root, 'JP', 'Regular')).toThrow('run `npm run fonts:fetch`');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

async function fonts(mode: string): Promise<Record<string, string>> {
  const dir = mkdtempSync(join(tmpdir(), `bridgevibe-fonts-${mode}-`));
  vi.stubEnv('BRIDGEVIBE_LICENCE_REPORT', join(dir, 'bom.json'));
  try {
    const outDir = join(dir, 'dist');
    await build({ mode, logLevel: 'silent', build: { outDir } });
    return Object.fromEntries(readdirSync(join(outDir, 'assets')).filter(file => file.startsWith('BridgeVibeSans'))
      .map(file => [file.replace(/-[^-]+\.woff2$/, ''), createHash('sha256').update(readFileSync(join(outDir, 'assets', file))).digest('hex')]));
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
}

test('I18N-21: production emits no CJK font while no CJK locale ships', async () => {
  expect(await fonts('production')).toEqual({});
}, 60_000);

test('§6.6: two audit builds give identical trimmed fonts', async () => {
  const first = await fonts('audit');
  expect(Object.keys(first).sort()).toEqual(['BridgeVibeSansJP-Regular', 'BridgeVibeSansJP-SemiBold']);
  expect(await fonts('audit')).toEqual(first);
}, 120_000);

test('§6.6 step 5 (#154): only catalogue inputs trigger a re-trim', () => {
  const root = '/repo';
  for (const file of ['src/explanation/locales/en.ts', 'src/explanation/locales/zh-Hans.ts', 'src/explanation/pseudo.ts', 'src/app/previewLocales.ts']) {
    expect(isFontInput(root, join(root, file)), file).toBe(true);
  }
  for (const file of ['src/explanation/index.ts', 'src/app/App.tsx', 'src/explanation/locales/sub/x.ts', 'scripts/fonts/plugin.ts']) {
    expect(isFontInput(root, join(root, file)), file).toBe(false);
  }
});

test('§6.6 step 5 (#154): the dev server re-trims and reloads when a catalogue changes', async () => {
  const server = await createServer({ configFile: join(process.cwd(), 'vite.config.ts'), mode: 'development', logLevel: 'silent',
    server: { middlewareMode: true, ws: false }, appType: 'custom' });
  try {
    const code = (await server.transformRequest('virtual:locale-fonts/ja'))?.code ?? '';
    expect(code).toContain('BridgeVibe Sans JP');
    const module = [...server.moduleGraph.idToModuleMap.values()].find(item => /\/locale-fonts-ja\.js$/.test(item.id ?? ''))!;
    expect(module.transformResult).not.toBeNull();
    const send = vi.spyOn(server.ws, 'send');
    const plugin = server.config.plugins.find(item => item.name === 'locale-fonts') as { api: { regeneration: () => Promise<void> } };
    server.watcher.emit('change', join(process.cwd(), 'src/app/App.tsx'));
    await plugin.api.regeneration();
    expect(send).not.toHaveBeenCalled();
    server.watcher.emit('change', join(process.cwd(), 'src/explanation/locales/en.ts'));
    await plugin.api.regeneration();
    expect(module.transformResult).toBeNull();
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
    expect((await server.transformRequest('virtual:locale-fonts/ja'))?.code).toContain('BridgeVibe Sans JP');
    // Review of #157: adding or removing a catalogue file re-trims too.
    for (const event of ['add', 'unlink'] as const) {
      send.mockClear();
      server.watcher.emit(event, join(process.cwd(), 'src/explanation/locales/ja.ts'));
      await plugin.api.regeneration();
      expect(send, event).toHaveBeenCalledWith({ type: 'full-reload' });
    }
    // Missing sources only warn in the dev server; the locale falls back to system fonts.
    const sources = join(process.cwd(), '.font-sources/plex-sans-jp-3.0.0');
    const warn = vi.spyOn(server.config.logger, 'warn');
    const error = vi.spyOn(server.config.logger, 'error');
    send.mockClear();
    renameSync(sources, `${sources}.moved`);
    try {
      server.watcher.emit('change', join(process.cwd(), 'src/explanation/pseudo.ts'));
      await plugin.api.regeneration();
    } finally { renameSync(`${sources}.moved`, sources); }
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('run `npm run fonts:fetch`'));
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    // A re-trim that fails is shown in the dev server (logged and sent as an error), never silently
    // kept: here the JP source is briefly the small SC fixture, which the trim and rename reject.
    const regular = join(sources, 'IBMPlexSansJP-Regular.woff2');
    const original = readFileSync(regular);
    writeFileSync(regular, readFileSync(new URL('./fonts/plex-sans-sc-fixture.woff2', import.meta.url)));
    try {
      server.watcher.emit('change', join(process.cwd(), 'src/explanation/pseudo.ts'));
      await plugin.api.regeneration();
    } finally { writeFileSync(regular, original); }
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^locale-fonts: /));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  } finally { await server.close(); }
}, 120_000);

test('§6.6: the dev server starts without the font sources, warning once per locale', async () => {
  const sources = join(process.cwd(), '.font-sources/plex-sans-jp-3.0.0');
  renameSync(sources, `${sources}.moved`);
  try {
    const server = await createServer({ configFile: join(process.cwd(), 'vite.config.ts'), mode: 'development', logLevel: 'silent',
      server: { middlewareMode: true, ws: false }, appType: 'custom' });
    try {
      expect((await server.transformRequest('virtual:locale-fonts/ja'))?.code ?? '').not.toContain('BridgeVibe Sans JP');
    } finally { await server.close(); }
  } finally { renameSync(`${sources}.moved`, sources); }
}, 120_000);
