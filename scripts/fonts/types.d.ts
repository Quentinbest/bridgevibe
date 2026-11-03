declare module 'subset-font' {
  export default function subsetFont(source: Buffer, text: string, options: { targetFormat: 'sfnt' | 'woff' | 'woff2'; preserveNameIds: number[] }): Promise<Buffer>;
}
declare module 'fontverter' {
  export function convert(source: Buffer, target: 'sfnt' | 'woff' | 'woff2'): Promise<Buffer>;
}
