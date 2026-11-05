import { catalogue, currentLanguageTag, currentLocale, setLocale, text, type Entry, type StringId } from '../explanation';

// I-12: derive shipped locales from sign-off records when that ticket lands.
export const SHIPPED_LOCALES = ['en'] as const;
// U-20, U-21: catalogue identity is separate from its formatting and document language.
const LANGUAGE_TAGS: Readonly<Partial<Record<string, string>>> = { 'zh-Hant': 'zh-Hant-TW', es: 'es-419' };
type LocaleCatalogue = Partial<Record<StringId, Entry>>;
type Loaders = Record<string, () => Promise<LocaleCatalogue>>;
// I18N-21: English stays eager; each other catalogue is a separate lazy chunk.
const modules = import.meta.glob<Record<string, LocaleCatalogue>>([
  '../explanation/locales/*.ts', '!../explanation/locales/en.ts',
]);
const defaultLoaders: Loaders = Object.fromEntries(Object.entries(modules).map(([path, load]) => {
  const tag = path.slice(path.lastIndexOf('/') + 1, -3);
  return [tag, async () => {
    const module = await load();
    const entries = Object.values(module);
    if (entries.length !== 1) throw new Error(`locale-export:${tag}`);
    return entries[0];
  }];
}));

export function createLocaleController({ loaders = defaultLoaders, shipped = SHIPPED_LOCALES }: {
  loaders?: Loaders; shipped?: readonly string[];
} = {}) {
  let snapshot = { locale: currentLocale(), failed: false };
  let request = 0;
  const listeners = new Set<() => void>();
  function publish(locale: string, failed: boolean) {
    snapshot = { locale, failed };
    listeners.forEach(listener => listener());
  }
  function updateMetadata() {
    // E-03, I18N-04: failed boot also describes the locale that remains active.
    document.documentElement.lang = currentLanguageTag();
    document.title = text('product');
  }
  async function switchTo(tag: string): Promise<void> {
    const pending = ++request;
    try {
      if (!shipped.includes(tag)) throw new Error(`locale-unshipped:${tag}`);
      const loaded = tag === 'en' ? catalogue : await loaders[tag]();
      // E-03: discard older loads, including when the latest request failed.
      if (pending !== request) return;
      setLocale(tag, loaded, LANGUAGE_TAGS[tag] ?? tag);
      updateMetadata();
      publish(tag, false);
    } catch (error) {
      console.warn('locale.load-failed', tag, error);
      if (pending === request) {
        updateMetadata();
        publish(currentLocale(), true);
      }
    }
  }
  return {
    boot: switchTo,
    switchTo,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
export type LocaleController = ReturnType<typeof createLocaleController>;
