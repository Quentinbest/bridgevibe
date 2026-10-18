import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
export default [
  { ignores: ['node_modules/**', 'dist/**', 'test-results/**', 'playwright-report/**', '.delegate-ref/**'] },
  js.configs.recommended, ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // App source runs in the browser only; tests and tooling also run in Node.
  { files: ['src/**/*.{ts,tsx}'], ignores: ['src/**/*.test.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  { files: ['src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
  { files: ['src/**/*.tsx'], plugins: { 'react-refresh': refresh }, rules: { 'react-refresh/only-export-components': 'error' } },
];
