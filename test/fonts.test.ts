import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { convert } from 'fontverter';
import { Blob, Face } from 'harfbuzzjs';
import { assertNoReservedNames, checksum, missingCodePoints, renameFont, replaceNameTable, trimFont } from '../scripts/fonts/subset';
import { fetchFonts, readTar } from '../scripts/fonts/fetch';
import type { Source } from '../scripts/fonts/fetch';
import sources from '../scripts/fonts/sources.json';

const fixturePath = new URL('./fonts/plex-sans-sc-fixture.woff2', import.meta.url);
const renameIds = [1, 3, 4, 6, 16, 17, 18, 20, 21, 22, 25];
function table(font: Buffer, tag: string): Buffer {
  for (let record = 12; record < 12 + font.readUInt16BE(4) * 16; record += 16) {
    if (font.toString('ascii', record, record + 4) === tag) {
      const offset = font.readUInt32BE(record + 8);
      return font.subarray(offset, offset + font.readUInt32BE(record + 12));
    }
  }
  throw new Error(`Missing ${tag}`);
}
function names(font: Buffer) {
  const name = table(font, 'name');
  return Array.from({ length: name.readUInt16BE(2) }, (_, index) => {
    const record = 6 + index * 12;
    const platform = name.readUInt16BE(record);
    const start = name.readUInt16BE(4) + name.readUInt16BE(record + 10);
    const bytes = Buffer.from(name.subarray(start, start + name.readUInt16BE(record + 8)));
    return { platform, encoding: name.readUInt16BE(record + 2), id: name.readUInt16BE(record + 6), metadata: name.subarray(record, record + 8), bytes,
      text: platform === 0 || platform === 3 ? Buffer.from(bytes).swap16().toString('utf16le') : bytes.toString('latin1') };
  });
}
function checkChecksums(font: Buffer) {
  expect(checksum(font)).toBe(0xb1b0afba);
  for (let record = 12; record < 12 + font.readUInt16BE(4) * 16; record += 16) {
    const tag = font.toString('ascii', record, record + 4);
    const bytes = Buffer.from(table(font, tag));
    if (tag === 'head') bytes.writeUInt32BE(0, 8);
    expect(checksum(bytes), tag).toBe(font.readUInt32BE(record + 4));
    expect(font.readUInt32BE(record + 8) % 4).toBe(0);
  }
}

function syntheticName(records: { id: number; platform: number; encoding: number; bytes: Buffer }[], format: number): Buffer {
  const language = Buffer.from('zh-Hans', 'utf16le').swap16();
  const header = Buffer.alloc(6 + records.length * 12 + (format === 1 ? 6 : 0));
  header.writeUInt16BE(format);
  header.writeUInt16BE(records.length, 2);
  header.writeUInt16BE(header.length, 4);
  let offset = 0;
  for (const [index, record] of records.entries()) {
    const position = 6 + index * 12;
    header.writeUInt16BE(record.platform, position);
    header.writeUInt16BE(record.encoding, position + 2);
    header.writeUInt16BE(format === 1 ? 0x8000 : 0, position + 4);
    header.writeUInt16BE(record.id, position + 6);
    header.writeUInt16BE(record.bytes.length, position + 8);
    header.writeUInt16BE(offset, position + 10);
    offset += record.bytes.length;
  }
  if (format === 1) {
    const start = 6 + records.length * 12;
    header.writeUInt16BE(1, start);
    header.writeUInt16BE(language.length, start + 2);
    header.writeUInt16BE(offset, start + 4);
  }
  return Buffer.concat([header, ...records.map(record => record.bytes), ...(format === 1 ? [language] : [])]);
}

describe('font trimming and reserved names (I18N-16.4, R-9)', () => {
  it('renames the fixture and retains notices and all other records byte for byte', async () => {
    const sfnt = await convert(await readFile(fixturePath), 'sfnt');
    const renamed = renameFont(sfnt, 'SC');
    const before = names(sfnt);
    const after = names(renamed);
    const retained = before.filter(record => !renameIds.includes(record.id) || record.platform === 0 || record.platform === 3 || (record.platform === 1 && record.encoding === 0));
    expect(after).toHaveLength(retained.length);
    expect(after.some(record => renameIds.includes(record.id) && record.platform === 1 && record.encoding !== 0)).toBe(false);
    expect(before.some(record => renameIds.includes(record.id) && record.platform === 1 && record.encoding !== 0)).toBe(true);
    for (const id of [0, 7, 13, 14]) expect(before.some(record => record.id === id)).toBe(true);
    for (const [index, record] of after.entries()) {
      expect(record.metadata).toEqual(retained[index].metadata);
      if (renameIds.includes(record.id)) expect(record.text).not.toContain('Plex');
      else expect(record.bytes).toEqual(retained[index].bytes);
      if (![0, 7, 13, 14].includes(record.id)) {
        expect(record.bytes.includes(Buffer.from('Plex'))).toBe(false);
        expect(record.bytes.includes(Buffer.from('Plex', 'utf16le').swap16())).toBe(false);
      }
    }
    expect(after.some(record => record.text.includes('BridgeVibe Sans SC'))).toBe(true);
    expect(after.some(record => record.text.includes('BridgeVibeSansSC'))).toBe(true);
    checkChecksums(renamed);
    for (let record = 12; record < 12 + sfnt.readUInt16BE(4) * 16; record += 16) {
      const tag = sfnt.toString('ascii', record, record + 4);
      if (tag !== 'name' && tag !== 'head') expect(table(renamed, tag)).toEqual(table(sfnt, tag));
    }
  });

  it('rewrites supported encodings and drops legacy renamed records in formats 0 and 1', async () => {
    const fixture = await convert(await readFile(fixturePath), 'sfnt');
    for (const family of ['SC', 'TC', 'JP'] as const) {
      for (const format of [0, 1]) {
        const records = [0, ...renameIds, 7, 13, 14, 256].flatMap(id =>
          [[0, 4], [3, 1], [1, 0], [1, 1], [1, 2], [1, 25], [2, 0]].map(([platform, encoding]) => {
            const text = id === 256 ? 'Unchanged custom record' : id === 20 ? `IBMPlexSans${family}-Regular` : `IBM Plex Sans ${family};IBMPlexSans${family};Regular`;
            const bytes = platform === 0 || platform === 3 ? Buffer.from(text, 'utf16le').swap16() : Buffer.from(text, 'latin1');
            return { id, platform, encoding, bytes };
          }));
        const name = syntheticName(records, format);
        const renamed = renameFont(replaceNameTable(fixture, name), family);
        const retained = records.filter(record => !renameIds.includes(record.id) || record.platform === 0 || record.platform === 3 || (record.platform === 1 && record.encoding === 0));
        const after = names(renamed);
        expect(after).toHaveLength(retained.length);
        for (const [index, record] of after.entries()) {
          if (renameIds.includes(record.id)) expect(record.text).toBe(record.id === 20 ? `BridgeVibeSans${family}-Regular` : `BridgeVibe Sans ${family};BridgeVibeSans${family};Regular`);
          else expect(record.bytes).toEqual(retained[index].bytes);
        }
        expect(table(renamed, 'name').readUInt16BE(0)).toBe(format);
        if (format === 1) {
          const output = table(renamed, 'name');
          const record = 6 + after.length * 12;
          expect(output.readUInt16BE(record)).toBe(1);
          const start = output.readUInt16BE(4) + output.readUInt16BE(record + 4);
          expect(output.subarray(start, start + output.readUInt16BE(record + 2))).toEqual(Buffer.from('zh-Hans', 'utf16le').swap16());
        }
        checkChecksums(renamed);
      }
    }
  });

  it('rejects reserved names in renamed or unexpected IDs in either byte form', async () => {
    const fixture = await convert(await readFile(fixturePath), 'sfnt');
    for (const id of [1, 18, 256]) {
      for (const platform of [1, 3]) {
        const text = 'Unexpected Plex Name';
        const bytes = platform === 3 ? Buffer.from(text, 'utf16le').swap16() : Buffer.from(text);
        const name = syntheticName([{ id, platform, encoding: platform === 3 ? 1 : 0, bytes }], 0);
        expect(() => assertNoReservedNames(name)).toThrow(`Reserved font name in record ${id}`);
        expect(() => renameFont(replaceNameTable(fixture, name), 'SC')).toThrow(`Reserved font name in record ${id}`);
      }
    }
  });

  it('reopens trimmed WOFF2, preserves notices and coverage, and is deterministic', async () => {
    const source = await readFile(fixturePath);
    const text = '继续红心ABC 0123';
    const first = await trimFont(source, text, 'SC');
    const second = await trimFont(source, text, 'SC');
    expect(first.woff2.subarray(0, 4).toString()).toBe('wOF2');
    expect(first.woff2).toEqual(second.woff2);
    expect(first.missing).toEqual([]);
    expect(await missingCodePoints(first.woff2, text)).toEqual([]);
    const sfnt = await convert(first.woff2, 'sfnt');
    const face = new Face(new Blob(sfnt));
    expect(Buffer.from(face.referenceTable('maxp')!).readUInt16BE(4)).toBeGreaterThan(1);
    const sourceSfnt = await convert(source, 'sfnt');
    expect(table(sfnt, 'name')).toEqual(table(renameFont(sourceSfnt, 'SC'), 'name'));
    const before = names(sourceSfnt);
    for (const id of [0, 7, 13, 14]) {
      expect(names(sfnt).filter(record => record.id === id).map(record => ({ metadata: record.metadata, bytes: record.bytes })))
        .toEqual(before.filter(record => record.id === id).map(record => ({ metadata: record.metadata, bytes: record.bytes })));
    }
    expect(names(sfnt).filter(record => renameIds.includes(record.id)).every(record => !record.text.includes('Plex'))).toBe(true);
  });

  it('reports absent characters once, by Unicode code point including astral characters', async () => {
    const source = await readFile(fixturePath);
    const text = 'A龘龘😀😀';
    expect(await missingCodePoints(source, text)).toEqual([0x9f98, 0x1f600]);
    expect((await trimFont(source, text, 'SC')).missing).toEqual([0x9f98, 0x1f600]);
  });
});

function tarball(entries: [string, string][]): Buffer {
  const blocks: Buffer[] = [];
  for (const [name, contents] of entries) {
    const header = Buffer.alloc(512);
    const bytes = Buffer.from(contents);
    header.write(name);
    header.write('0000644\0', 100);
    header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124);
    header.fill(32, 148, 156);
    header[156] = 48;
    header.write('ustar\0', 257);
    header.write('00', 263);
    header.write(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148);
    const body = Buffer.alloc(Math.ceil(bytes.length / 512) * 512);
    bytes.copy(body);
    blocks.push(header, body);
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function setup(entries: [string, string][] = [['package/regular', 'regular'], ['package/semibold', 'semibold'], ['package/LICENSE.txt', 'OFL'], ['../evil', 'evil'], ['package/postinstall.js', 'throw new Error("executed")']]) {
  const root = await mkdtemp(path.join(tmpdir(), 'bridgevibe-fonts-'));
  temporary.push(root);
  const bytes = tarball(entries);
  await writeFile(path.join(root, 'test.tgz'), bytes);
  const source: Source = { family: 'SC', package: '@ibm/plex-sans-sc', version: '1.1.0', tarball: 'https://registry.npmjs.org/test.tgz',
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'), files: ['package/regular', 'package/semibold'], licence: 'package/LICENSE.txt' };
  return { root, bytes, source, options: { root, from: root, sources: [source] } };
}

describe('font tarball fetching (R-8)', () => {
  it('refuses wrong integrity and writes nothing', async () => {
    const { root, options, source } = await setup();
    source.integrity = 'sha512-wrong';
    await expect(fetchFonts(options)).rejects.toThrow('@ibm/plex-sans-sc: integrity mismatch');
    expect(await readdir(root)).toEqual(['test.tgz']);
  });
  it('extracts only wanted entries to fixed paths and skips verified cached files', async () => {
    const { root, options } = await setup();
    await fetchFonts(options);
    const output = path.join(root, '.font-sources');
    const directory = path.join(output, 'plex-sans-sc-1.1.0');
    expect((await readdir(output)).sort()).toEqual(['manifest.json', 'plex-sans-sc-1.1.0']);
    expect((await readdir(directory)).sort()).toEqual(['IBMPlexSansSC-Regular.woff2', 'IBMPlexSansSC-SemiBold.woff2', 'LICENSE.txt']);
    expect(await readFile(path.join(directory, 'LICENSE.txt'), 'utf8')).toBe('OFL');
    const regular = path.join(directory, 'IBMPlexSansSC-Regular.woff2');
    expect(await readFile(regular, 'utf8')).toBe('regular');
    expect(await readFile(path.join(directory, 'IBMPlexSansSC-SemiBold.woff2'), 'utf8')).toBe('semibold');
    const manifestFile = path.join(output, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    expect(manifest['@ibm/plex-sans-sc'].integrity).toBe(options.sources[0].integrity);
    expect(manifest['@ibm/plex-sans-sc'].files['plex-sans-sc-1.1.0/IBMPlexSansSC-Regular.woff2']).toBe(createHash('sha256').update('regular').digest('hex'));
    const before = await Promise.all([regular, manifestFile].map(file => stat(file)));
    await rm(path.join(root, 'test.tgz'));
    const messages: string[] = [];
    await fetchFonts({ ...options, log: message => messages.push(message) });
    expect(messages).toEqual(['@ibm/plex-sans-sc: up to date']);
    expect(await Promise.all([regular, manifestFile].map(async file => (await stat(file)).mtimeMs))).toEqual(before.map(value => value.mtimeMs));
    await writeFile(regular, 'corrupt');
    await expect(fetchFonts(options)).rejects.toThrow('ENOENT');
  });
  it('refuses non-registry URLs before reading or writing', async () => {
    const { root, source, options } = await setup();
    for (const url of ['http://registry.npmjs.org/test.tgz', 'https://example.com/test.tgz', 'https://registry.npmjs.org.evil/test.tgz', 'https://user@registry.npmjs.org/test.tgz']) {
      source.tarball = url;
      await expect(fetchFonts(options)).rejects.toThrow('only https://registry.npmjs.org/');
    }
    expect(await readdir(root)).toEqual(['test.tgz']);
  });
  it('fails without writing when a wanted file is absent', async () => {
    const { root, options } = await setup([['package/regular', 'regular']]);
    await expect(fetchFonts(options)).rejects.toThrow('missing package/semibold');
    expect(await readdir(root)).toEqual(['test.tgz']);
  });
  it('fails without writing when the licence is absent', async () => {
    const { root, options } = await setup([['package/regular', 'regular'], ['package/semibold', 'semibold']]);
    await expect(fetchFonts(options)).rejects.toThrow('missing package/LICENSE.txt');
    expect(await readdir(root)).toEqual(['test.tgz']);
  });
  it('rejects truncated or checksum-corrupted tar headers', () => {
    expect(() => readTar(Buffer.alloc(10))).toThrow('Truncated tar header');
    expect(() => readTar(Buffer.alloc(512, 1))).toThrow();
  });
  it('pins exactly the three approved sources', () => {
    expect(sources.map(source => [source.family, source.package, source.version, source.integrity])).toEqual([
      ['SC', '@ibm/plex-sans-sc', '1.1.0', 'sha512-IkhORwgw/CrsUss7uW9Rj6KKSsGQoIyIaNWjjju/7sV7SYS3yk0c/DgZN/leIG3Co5lN/X4Or/sQaL+SdvmSIg=='],
      ['TC', '@ibm/plex-sans-tc', '1.1.1', 'sha512-pM4DfRkKL4Vqrew/GDrqfXe1sqAcLuYR49Xks0yCAVQHhoMna0yJ5sV3KfC542h455oAK3XrH9CtSd0sfq+u9Q=='],
      ['JP', '@ibm/plex-sans-jp', '3.0.0', 'sha512-/v46f2qWBwOg0U/At3R9yVIWrHZKYHM0ByCz2lnNk60VqTHATcCHUT9djTmYBlRwaepybLzDsvx2DtxpHpIPvA=='],
    ]);
    for (const source of sources) {
      expect(source.tarball).toBe(`https://registry.npmjs.org/${source.package}/-/${source.package.split('/')[1]}-${source.version}.tgz`);
      expect(source.files).toEqual(['Regular', 'SemiBold'].map(weight => `package/fonts/complete/woff2/hinted/IBMPlexSans${source.family}-${weight}.woff2`));
      expect(source.licence).toBe('package/LICENSE.txt');
    }
  });
});
