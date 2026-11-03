import { readFile, writeFile } from 'node:fs/promises';
import subsetFont from 'subset-font';
import { convert } from 'fontverter';
import { Blob, Face } from 'harfbuzzjs';
const { preserveNameIds, replaceNameTable } = await import(new URL('./subset.ts', import.meta.url).href) as typeof import('./subset.js');
import sources from './sources.json' with { type: 'json' };

const source = sources[0];
const root = new URL('../../', import.meta.url);
const font = await readFile(new URL('.font-sources/plex-sans-sc-1.1.0/IBMPlexSansSC-Regular.woff2', root));
const trimmed = await subsetFont(font, '继续红心ABC 0123', { targetFormat: 'sfnt', preserveNameIds });
// I18N-16.4: restore the complete source name table, including legacy Mac-only IDs.
const name = Buffer.from(new Face(new Blob(await convert(font, 'sfnt'))).referenceTable('name')!);
const sfnt = replaceNameTable(trimmed, name);
const fixture = await convert(sfnt, 'woff2');
if (fixture.length >= 50 * 1024) throw new Error('Fixture exceeds 50 KB');
// I18N-16.4: this unrenamed, test-only fixture retains the source names and notices; fonts:fetch
// extracted the licence from the hash-verified tarball.
const licence = await readFile(new URL(`.font-sources/plex-sans-sc-${source.version}/LICENSE.txt`, root));
await writeFile(new URL('test/fonts/plex-sans-sc-fixture.woff2', root), fixture);
await writeFile(new URL('test/fonts/IBM-Plex-Sans-SC-LICENSE.txt', root), licence);
console.log(`Wrote fixture (${fixture.length} bytes) and source licence`);
