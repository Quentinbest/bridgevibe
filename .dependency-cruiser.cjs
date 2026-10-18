module.exports = {
  forbidden: [
    { name: 'table-is-independent', severity: 'error', from: { path: '(^|/)src/table/' }, to: { path: '(^|/)src/', pathNot: '(^|/)src/table/' } },
    { name: 'app-is-composition-root', severity: 'error', from: { path: '(^|/)src/', pathNot: '(^|/)src/app/' }, to: { path: '(^|/)src/app/' } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' } },
};
