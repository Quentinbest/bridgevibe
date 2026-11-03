import subsetFont from 'subset-font';
import { convert } from 'fontverter';
import { Blob, Face } from 'harfbuzzjs';

export type Family = 'SC' | 'TC' | 'JP';
export const preserveNameIds = Array.from({ length: 26 }, (_, index) => index);
const renamedIds = new Set([1, 3, 4, 6, 16, 17, 18, 20, 21, 22, 25]);
const padded = (length: number) => Math.ceil(length / 4) * 4;
export function checksum(bytes: Buffer): number {
  const buffer = Buffer.alloc(padded(bytes.length));
  bytes.copy(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 4) sum = (sum + buffer.readUInt32BE(i)) >>> 0;
  return sum;
}

export async function missingCodePoints(font: Buffer, text: string): Promise<number[]> {
  const face = new Face(new Blob(await convert(font, 'sfnt')));
  const mapped = new Set(face.collectUnicodes());
  return [...new Set(Array.from(text, character => character.codePointAt(0)!))].filter(point => !mapped.has(point));
}

// R-9, I18N-16.4: only copyright, trademark and licence records may retain Plex.
export function assertNoReservedNames(table: Buffer): void {
  const allowed = new Set([0, 7, 13, 14]);
  const utf16Plex = Buffer.from('Plex', 'utf16le').swap16();
  for (let record = 6; record < 6 + table.readUInt16BE(2) * 12; record += 12) {
    const id = table.readUInt16BE(record + 6);
    const start = table.readUInt16BE(4) + table.readUInt16BE(record + 10);
    const bytes = table.subarray(start, start + table.readUInt16BE(record + 8));
    if (!allowed.has(id) && (bytes.includes(Buffer.from('Plex')) || bytes.includes(utf16Plex))) {
      throw new Error(`Reserved font name in record ${id}`);
    }
  }
}

function renameTable(table: Buffer, family: Family): Buffer {
  const format = table.readUInt16BE(0);
  if (format !== 0 && format !== 1) throw new Error(`Unsupported name format ${format}`);
  const count = table.readUInt16BE(2);
  const storage = table.readUInt16BE(4);
  const records: { metadata: Buffer; bytes: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    const record = 6 + i * 12;
    const platform = table.readUInt16BE(record);
    const encoding = table.readUInt16BE(record + 2);
    const id = table.readUInt16BE(record + 6);
    const start = storage + table.readUInt16BE(record + 10);
    let bytes = table.subarray(start, start + table.readUInt16BE(record + 8));
    if (renamedIds.has(id)) {
      const unicode = platform === 0 || platform === 3;
      // R-9: drop each renamed record in an unsupported encoding; legacy multibyte bytes are unsafe to rewrite.
      if (!unicode && !(platform === 1 && encoding === 0)) continue;
      // R-9: ASCII replacement leaves non-ASCII Mac Roman bytes unchanged.
      const decoded = unicode ? Buffer.from(bytes).swap16().toString('utf16le') : bytes.toString('latin1');
      const renamed = decoded.replaceAll(`IBM Plex Sans ${family}`, `BridgeVibe Sans ${family}`).replaceAll(`IBMPlexSans${family}`, `BridgeVibeSans${family}`);
      bytes = unicode ? Buffer.from(renamed, 'utf16le').swap16() : Buffer.from(renamed, 'latin1');
    }
    records.push({ metadata: table.subarray(record, record + 8), bytes });
  }
  const languageCount = format === 1 ? table.readUInt16BE(6 + count * 12) : 0;
  const header = Buffer.alloc(6 + records.length * 12 + (format === 1 ? 2 + languageCount * 4 : 0));
  header.writeUInt16BE(format);
  header.writeUInt16BE(records.length, 2);
  header.writeUInt16BE(header.length, 4);
  const strings: Buffer[] = [];
  let offset = 0;
  const append = (bytes: Buffer, record: number) => {
    header.writeUInt16BE(bytes.length, record);
    header.writeUInt16BE(offset, record + 2);
    strings.push(bytes);
    offset += bytes.length;
  };
  for (const [index, record] of records.entries()) {
    const position = 6 + index * 12;
    record.metadata.copy(header, position);
    append(record.bytes, position + 8);
  }
  // I18N-16.4: language tags and all unrenamed record strings are copied verbatim.
  if (format === 1) {
    const languageStart = 6 + records.length * 12;
    header.writeUInt16BE(languageCount, languageStart);
    for (let i = 0; i < languageCount; i++) {
      const record = 6 + count * 12 + 2 + i * 4;
      const start = storage + table.readUInt16BE(record + 2);
      append(table.subarray(start, start + table.readUInt16BE(record)), languageStart + 2 + i * 4);
    }
  }
  const result = Buffer.concat([header, ...strings]);
  assertNoReservedNames(result);
  return result;
}

export function renameFont(sfnt: Buffer, family: Family): Buffer {
  const name = new Face(new Blob(sfnt)).referenceTable('name');
  if (!name) throw new Error('Font lacks name table');
  return replaceNameTable(sfnt, renameTable(Buffer.from(name), family));
}

// I18N-16.4: carry the source name table across the subsetter without losing notices.
export function replaceNameTable(sfnt: Buffer, name: Buffer): Buffer {
  const count = sfnt.readUInt16BE(4);
  const header = Buffer.from(sfnt.subarray(0, 12 + count * 16));
  const tables: Buffer[] = [];
  let offset = header.length;
  let headOffset = 0;
  let foundName = false;
  for (let i = 0; i < count; i++) {
    const record = 12 + i * 16;
    const tag = sfnt.toString('ascii', record, record + 4);
    const start = sfnt.readUInt32BE(record + 8);
    let table: Buffer = Buffer.from(sfnt.subarray(start, start + sfnt.readUInt32BE(record + 12)));
    if (tag === 'name') { table = name; foundName = true; }
    if (tag === 'head') { table.writeUInt32BE(0, 8); headOffset = offset; }
    header.writeUInt32BE(checksum(table), record + 4);
    header.writeUInt32BE(offset, record + 8);
    header.writeUInt32BE(table.length, record + 12);
    const bytes = Buffer.alloc(padded(table.length));
    table.copy(bytes);
    tables.push(bytes);
    offset += bytes.length;
  }
  if (!foundName || !headOffset) throw new Error('Font lacks name or head table');
  const result = Buffer.concat([header, ...tables]);
  result.writeUInt32BE((0xb1b0afba - checksum(result)) >>> 0, headOffset + 8);
  return result;
}

export async function trimFont(source: Buffer, text: string, family: Family): Promise<{ woff2: Buffer; missing: number[] }> {
  const missing = await missingCodePoints(source, text);
  const sfnt = await subsetFont(source, text, { targetFormat: 'sfnt', preserveNameIds });
  const sourceSfnt = await convert(source, 'sfnt');
  const renamedSource = renameFont(sourceSfnt, family);
  const name = new Face(new Blob(renamedSource)).referenceTable('name')!;
  const woff2 = await convert(replaceNameTable(sfnt, Buffer.from(name)), 'woff2');
  const face = new Face(new Blob(await convert(woff2, 'sfnt')));
  const maxp = face.referenceTable('maxp');
  // I18N-16.4: copy the glyph count before another HarfBuzz call can grow WASM memory.
  const glyphCount = maxp && maxp.length >= 6 ? Buffer.from(maxp).readUInt16BE(4) : 0;
  const lost = (await missingCodePoints(woff2, text)).filter(point => !missing.includes(point));
  if (!glyphCount || lost.length) throw new Error('Trimmed font failed glyph validation');
  return { woff2, missing };
}
