// §4.3.6: canonical object ordering and 64-bit FNV-1a, independent of runtime APIs.
export function positionDigest(value: unknown): string {
  function canonical(item: unknown): string {
    if (Array.isArray(item)) return `[${item.map(canonical).join(',')}]`;
    if (item && typeof item === 'object') return `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${canonical((item as Record<string, unknown>)[key])}`).join(',')}}`;
    return JSON.stringify(item);
  }
  let hash = 0xcbf29ce484222325n;
  for (const char of canonical(value)) hash = BigInt.asUintN(64, (hash ^ BigInt(char.charCodeAt(0))) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}
