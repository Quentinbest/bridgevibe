import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
export default [
  { ignores: ['node_modules/**', 'dist/**', 'test-results/**', 'playwright-report/**', '.delegate-ref/**', '.reference-scorers/**', '.reference-solvers/**'] },
  // ADR-0001: Seat Views can only be manufactured inside Table.
  { files: ['**/*.{ts,tsx}'], ignores: ['src/table/**'], rules: {
    'no-restricted-syntax': ['error', {
      selector: ':matches(TSAsExpression, TSTypeAssertion) > TSTypeReference[typeName.name="SeatView"]',
      message: 'Only table constructs SeatView; request one from the Table API.',
    }, {
      selector: ':matches(TSAsExpression, TSTypeAssertion) > TSTypeReference[typeName.name="CompletedPlaythroughRecord"]',
      message: 'Only table constructs CompletedPlaythroughRecord; request one from the Table API.',
    }],
  } },
  { files: ['src/robots/**'], rules: {
    // §4.2 rule 2: no type that carries a full deal, so an allowlist rather than a blocklist.
    'no-restricted-imports': ['error', { patterns: [{
      group: ['**/table', '**/table/**'],
      allowImportNames: ['Action', 'SeatView', 'Card', 'Suit', 'Rank', 'Seat', 'Side', 'Contract', 'PlayedCard', 'Trick', 'SUITS', 'RANKS', 'SEATS', 'sameCard', 'sideOf'],
      message: 'Robots receive SeatView only (ADR-0001); import only seat-view types and card helpers from table.',
    }] }],
  } },
  js.configs.recommended, ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // App source runs in the browser only; tests and tooling also run in Node.
  { files: ['src/**/*.{ts,tsx}'], ignores: ['src/**/*.test.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  { files: ['src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
  { files: ['src/**/*.tsx'], plugins: { 'react-refresh': refresh }, rules: { 'react-refresh/only-export-components': 'error' } },
];
