import { flushSync } from 'react-dom';
import { catalogue, currentLanguageTag, currentLocale, setLocale, text, type Entry, type StringId } from '../explanation';

// I-12: derive shipped locales from sign-off records when that ticket lands.
export const SHIPPED_LOCALES = ['en'] as const;
// U-20, U-21: catalogue identity is separate from its formatting and document language.
const LANGUAGE_TAGS: Readonly<Partial<Record<string, string>>> = { 'zh-Hant': 'zh-Hant-TW', es: 'es-419' };
type LocaleCatalogue = Partial<Record<StringId, Entry>>;
type Loaders = Record<string, () => Promise<LocaleCatalogue>>;
const preview = import.meta.env.MODE === 'development' || import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'internal';
// U-24, I18N-11.2: zh-Hans is an unsigned AI draft, so it's a preview until a teacher signs it off.
export const ELIGIBLE_LOCALES: readonly string[] = preview ? [...SHIPPED_LOCALES, 'en-XA', 'es', 'ja', 'zh-Hans'] : SHIPPED_LOCALES;
const previewLoaders: Loaders = preview ? Object.fromEntries(['en-XA', 'es', 'ja'].map(tag => [tag, async () => (await import('./previewLocales')).previewCatalogue(tag)])) : {};
// I18N-21: English stays eager; each other catalogue is a separate lazy chunk. I18N-11: while no
// non-English locale has shipped, production loads none, so no unsigned draft reaches its bundle;
// I-12 adds each locale here once it is signed off.
const modules = preview ? import.meta.glob<Record<string, LocaleCatalogue>>([
  '../explanation/locales/*.ts', '!../explanation/locales/en.ts',
]) : {};
type LocaleFonts = { ready?: () => Promise<unknown> };
const fontLoaders: Record<string, () => Promise<LocaleFonts>> = {
  'zh-Hans': () => import('virtual:locale-fonts/zh-Hans'),
  'zh-Hant': () => import('virtual:locale-fonts/zh-Hant'),
  ja: () => import('virtual:locale-fonts/ja'),
};
const defaultLoaders: Loaders = Object.fromEntries(Object.entries(modules).map(([path, load]) => {
  const tag = path.slice(path.lastIndexOf('/') + 1, -3);
  return [tag, async () => {
    const module = await load();
    const entries = Object.values(module);
    if (entries.length !== 1) throw new Error(`locale-export:${tag}`);
    return entries[0];
  }];
}));

export function createLocaleController({ loaders = { ...defaultLoaders, ...previewLoaders }, shipped = ELIGIBLE_LOCALES, fonts = fontLoaders }: {
  loaders?: Loaders; shipped?: readonly string[]; fonts?: Record<string, () => Promise<LocaleFonts>>;
} = {}) {
  let snapshot = { locale: currentLocale(), failed: false };
  let request = 0;
  const listeners = new Set<() => void>();
  const liveRegions = new Map<Element, string | null>();
  let cancelRestore: (() => void) | undefined;
  let observer: MutationObserver | undefined;
  function restoreLiveRegion(element: Element) {
    const original = liveRegions.get(element);
    liveRegions.delete(element);
    // I18N §6.3: a result arriving during the window may change React's live-region props.
    if (original === undefined || element.getAttribute('aria-live') !== 'off') return;
    if (original === null) element.removeAttribute('aria-live');
    else element.setAttribute('aria-live', original);
  }
  function restoreChangedRegions(mutations: MutationRecord[]) {
    for (const element of liveRegions.keys()) {
      if (mutations.some(mutation => element.contains(mutation.target))) restoreLiveRegion(element);
    }
  }
  function muteLiveRegions() {
    // I18N §6.3: a newer commit inherits the originals, never the temporary "off".
    cancelRestore?.();
    // I18N §6.3: account for new content even if its observer callback hasn't run yet.
    const pending = observer?.takeRecords() ?? [];
    observer?.disconnect(); observer = undefined;
    restoreChangedRegions(pending);
    for (const element of document.querySelectorAll('[aria-live],[role~="status"],[role~="alert"],[role~="log"]')) {
      if (!liveRegions.has(element)) liveRegions.set(element, element.getAttribute('aria-live'));
      element.setAttribute('aria-live', 'off');
    }
  }
  function restoreLiveRegionsLater() {
    const restore = () => {
      observer?.disconnect(); observer = undefined;
      for (const element of liveRegions.keys()) restoreLiveRegion(element);
      cancelRestore = undefined;
    };
    if (!liveRegions.size) return;
    // I18N §6.3: observe only after flushSync; later mutations are new content, not translation.
    observer = new MutationObserver(restoreChangedRegions);
    for (const element of liveRegions.keys()) observer.observe(element, {
      childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['aria-live'],
    });
    // I18N §6.3: let the browser process the muted text changes before restoring announcements.
    if (typeof requestAnimationFrame === 'function') {
      let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(restore); });
      cancelRestore = () => cancelAnimationFrame(frame);
    } else {
      const timer = setTimeout(restore, 50);
      cancelRestore = () => clearTimeout(timer);
    }
  }
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
      // I18N-21, E-03: the catalogue and the font load in parallel, each as its own lazy chunk. The whole
      // font operation (its module, then its faces) gets 3 s; after that, or if it fails, the switch
      // commits on the system fallback, so a stalled font request never blocks boot or a switch.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const loadFonts = fonts[tag];
      const fontsReady = loadFonts && Promise.race([
        loadFonts().then(module => module.ready?.()).catch(() => undefined),
        new Promise<void>(resolve => { timer = setTimeout(resolve, 3000); }),
      ]);
      let loaded: LocaleCatalogue;
      try { loaded = tag === 'en' ? catalogue : await loaders[tag](); await fontsReady; }
      finally { clearTimeout(timer); }
      // E-03: discard older loads, including when the latest request failed.
      if (pending !== request) return;
      muteLiveRegions();
      try {
        // I18N §6.3: unchanged aria-live props leave the pre-existing DOM regions muted.
        // Regions mounted by this commit are new content and retain their normal announcements.
        flushSync(() => {
          setLocale(tag, loaded, LANGUAGE_TAGS[tag] ?? tag);
          updateMetadata();
          publish(tag, false);
        });
      } finally { restoreLiveRegionsLater(); }
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
