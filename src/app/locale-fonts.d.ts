// I18N-16: scripts/fonts/plugin.ts generates one module per CJK locale in the build; others are empty.
declare module 'virtual:locale-fonts/*' {
  export const ready: (() => Promise<unknown>) | undefined;
}
