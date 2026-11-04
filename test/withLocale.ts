import { catalogue as en, setLocale, type Entry, type StringId } from '../src/explanation';

// E-06: restore English even when an asynchronous locale assertion fails.
export async function withLocale<T>(tag: string, catalogue: Partial<Record<StringId, Entry>>, fn: () => T | Promise<T>): Promise<T> {
  setLocale(tag, catalogue);
  try { return await fn(); }
  finally { setLocale('en', en); }
}
