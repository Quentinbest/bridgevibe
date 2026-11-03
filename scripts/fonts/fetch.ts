import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import sources from './sources.json' with { type: 'json' };

export interface Source {
  family: string; package: string; version: string; tarball: string; integrity: string; files: string[]; licence: string;
}
type Manifest = Record<string, { integrity: string; files: Record<string, string> }>;
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// R-8: read regular ustar entries as data; archive paths never become output paths.
export function readTar(tar: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const string = (buf: Buffer) => buf.toString('utf8').replace(/\0.*$/s, '');
  for (let offset = 0; offset < tar.length;) {
    if (offset + 512 > tar.length) throw new Error('Truncated tar header');
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const octal = (start: number, length: number) => {
      const value = string(header.subarray(start, start + length)).trim();
      if (!/^[0-7]+$/.test(value)) throw new Error('Invalid tar number');
      return parseInt(value, 8);
    };
    const expected = octal(148, 8);
    const sum = header.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (sum !== expected) throw new Error('Invalid tar checksum');
    const size = octal(124, 12);
    const start = offset + 512;
    if (!Number.isSafeInteger(size) || start + size > tar.length) throw new Error('Truncated tar entry');
    const prefix = string(header.subarray(345, 500));
    const name = (prefix ? prefix + '/' : '') + string(header.subarray(0, 100));
    if (header[156] === 0 || header[156] === 48) {
      if (entries.has(name)) throw new Error(`Duplicate tar entry: ${name}`);
      entries.set(name, tar.subarray(start, start + size));
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export function verifiedEntries(bytes: Buffer, source: Source): Map<string, Buffer> {
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  if (integrity !== source.integrity) throw new Error(`${source.package}: integrity mismatch`);
  return readTar(gunzipSync(bytes));
}

export async function fetchFonts(options: { root: string; from?: string; sources?: readonly Source[]; log?: (message: string) => void }): Promise<void> {
  const output = path.join(options.root, '.font-sources');
  const manifestPath = path.join(output, 'manifest.json');
  let manifest: Manifest = {};
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  for (const source of options.sources ?? sources) {
    const url = new URL(source.tarball);
    if (url.protocol !== 'https:' || url.host !== 'registry.npmjs.org' || url.username || url.password) {
      throw new Error(`${source.package}: only https://registry.npmjs.org/ URLs are allowed`);
    }
    const basename = source.package.split('/').at(-1)!;
    if (!/^[a-z0-9-]+$/.test(basename) || !/^\d+\.\d+\.\d+$/.test(source.version) || !/^(SC|TC|JP)$/.test(source.family)) throw new Error('Invalid font source');
    const directory = `${basename}-${source.version}`;
    // §6.6: the fonts plus the package's licence, which attributes them (LR-1).
    const names = [...['Regular', 'SemiBold'].map(weight => `${directory}/IBMPlexSans${source.family}-${weight}.woff2`), `${directory}/LICENSE.txt`];
    const previous = manifest[source.package];
    if (previous?.integrity === source.integrity && Object.keys(previous.files).length === names.length) {
      const valid = await Promise.all(names.map(async name => {
        try { return previous.files[name] === sha256(await readFile(path.join(output, name))); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
      }));
      if (valid.every(Boolean)) { options.log?.(`${source.package}: up to date`); continue; }
    }
    // R-8: fetch bytes only, with redirects disabled; never load package code.
    const bytes = options.from ? await readFile(path.join(options.from, path.basename(url.pathname))) : await (async () => {
      const response = await fetch(url, { redirect: 'error' });
      if (!response.ok) throw new Error(`${source.package}: HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    })();
    const entries = verifiedEntries(bytes, source);
    if (source.files.length !== 2) throw new Error(`${source.package}: expected two font paths`);
    const extracted = [...source.files, source.licence].map(file => {
      const bytes = entries.get(file);
      if (!bytes) throw new Error(`${source.package}: missing ${file}`);
      return bytes;
    });
    await mkdir(path.join(output, directory), { recursive: true });
    for (const [index, bytes] of extracted.entries()) await writeFile(path.join(output, names[index]), bytes);
    manifest[source.package] = { integrity: source.integrity, files: Object.fromEntries(extracted.map((bytes, index) => [names[index], sha256(bytes)])) };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    options.log?.(`${source.package}: extracted ${source.files.length} fonts and the licence`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--from')) throw new Error('Usage: fonts:fetch [--from <dir>]');
  await fetchFonts({ root: process.cwd(), from: args[1], log: console.log });
}
