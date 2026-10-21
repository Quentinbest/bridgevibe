module.exports = {
  forbidden: [
    // §4.2: offline content validation uses the same Table and curriculum model.
    { name: 'pipeline-only-table-curriculum', severity: 'error', from: { path: '(^|/)src/pipeline/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/(pipeline|table|curriculum)/' } },
    // §4.2: progress owns the Attempts store and may depend on curriculum (types) only.
    { name: 'progress-only-curriculum', severity: 'error', from: { path: '(^|/)src/progress/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/(progress|curriculum)/' } },
    { name: 'curriculum-only-table', severity: 'error', from: { path: '(^|/)src/curriculum/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/(table|curriculum)/' } },
    { name: 'coach-only-table', severity: 'error', from: { path: '(^|/)src/coach/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/(coach|table)/' } },
    { name: 'robots-only-table', severity: 'error', from: { path: '(^|/)src/robots/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/table/' } },
    // table may depend on nothing: no other module, package or Node builtin. Its tests may import the test runner.
    { name: 'table-is-independent', severity: 'error', from: { path: '(^|/)src/table/', pathNot: '\\.test\\.ts$' }, to: { pathNot: '(^|/)src/table/' } },
    { name: 'app-is-composition-root', severity: 'error', from: { path: '(^|/)src/', pathNot: '(^|/)src/app/' }, to: { path: '(^|/)src/app/' } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' } },
};
