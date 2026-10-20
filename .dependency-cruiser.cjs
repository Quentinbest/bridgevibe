module.exports = {
  forbidden: [
    { name: 'coach-only-table', severity: 'error', from: { path: '(^|/)src/coach/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/(coach|table)/' } },
    { name: 'robots-only-table', severity: 'error', from: { path: '(^|/)src/robots/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/table/' } },
    // table may depend on nothing: no other module, package or Node builtin. Its tests may import the test runner.
    { name: 'table-is-independent', severity: 'error', from: { path: '(^|/)src/table/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/table/' } },
    { name: 'app-is-composition-root', severity: 'error', from: { path: '(^|/)src/', pathNot: '(^|/)src/app/' }, to: { path: '(^|/)src/app/' } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' } },
};
