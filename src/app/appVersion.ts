// #49, US-04, US-40: the build injects the package version (vite.config.ts `define`); importing
// package.json would ship it and fail the licence check (#3).
declare const __APP_VERSION__: string;
export const APP_VERSION: string = __APP_VERSION__;
