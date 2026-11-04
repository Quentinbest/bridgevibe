// E-07: maximize scripts instead of maintaining a region table.
function expanded(tag: string): Intl.Locale | undefined {
  try { return new Intl.Locale(Intl.getCanonicalLocales(tag)[0]).maximize(); }
  catch { return undefined; }
}

export function matchLocale(preferences: readonly string[], shipped: readonly string[]): string {
  const candidates = shipped.map(tag => ({ tag, locale: expanded(tag) }));
  for (const preference of preferences) {
    const locale = expanded(preference);
    if (!locale) continue;
    const match = candidates.find(candidate => candidate.locale?.language === locale.language && candidate.locale.script === locale.script);
    if (match) return match.tag;
  }
  return 'en';
}

export function devicePreferences(nav: { languages?: readonly string[]; language?: string }): readonly string[] {
  return nav.languages?.length ? nav.languages : nav.language ? [nav.language] : [];
}
