import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

const attributes = new Set(['aria-label', 'aria-description', 'title', 'alt', 'placeholder', 'label']);
const scriptKind = (file: string) => (file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const line = (node: ts.Node) => node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;

function violations(source: string, file: string): string[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
  const found: string[] = [];
  // The fixed text of a literal; for `Try ${action}`, the parts around each substitution.
  function literalValue(node: ts.Node | undefined): string | undefined {
    if (!node) return undefined;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join('');
    return undefined;
  }
  // Copy kept in a variable (`const message = 'Try again'`) reaches JSX indirectly, so any literal
  // that looks like a phrase (a letter and a space) is copy too. Class names and module paths aren't.
  function phraseText(node: ts.Node): string | undefined {
    const value = literalValue(node);
    if (!value || !/\p{L}/u.test(value) || !/\s/.test(value)) return undefined;
    if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) return undefined;
    const attribute = ts.findAncestor(node, ts.isJsxAttribute);
    return attribute && attribute.name.getText(ast) === 'className' ? undefined : value;
  }
  function visit(node: ts.Node) {
    let value: string | undefined;
    if (ts.isJsxText(node)) value = node.text;
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) value = literalValue(node.expression);
    if (ts.isJsxAttribute(node) && attributes.has(node.name.getText(ast)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) value = node.initializer.text;
      if (ts.isJsxExpression(node.initializer)) value = literalValue(node.initializer.expression);
    }
    value ??= phraseText(node);
    if (value && /[\p{L}\p{N}]/u.test(value)) {
      found.push(`${file}:${line(node)}: ${value.trim()}`);
      return; // Don't report the same literal again from its children.
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
// A word kept in a constant (`const label = 'Continue'`, or one imported from a helper module)
// has no space for the phrase check to see, but its type is still that exact string. So a JSX child
// or protected attribute whose type is a string literal with a letter or digit is copy too.
function typedViolations(program: ts.Program, files: string[]): string[] {
  const checker = program.getTypeChecker();
  const found: string[] = [];
  for (const file of files) {
    const visit = (node: ts.Node) => {
      let expression: ts.Expression | undefined;
      if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) expression = node.expression;
      if (ts.isJsxAttribute(node) && attributes.has(node.name.getText()) && node.initializer && ts.isJsxExpression(node.initializer)) {
        expression = node.initializer.expression;
      }
      if (expression) {
        const type = checker.getTypeAtLocation(expression);
        const values = (type.isUnion() ? type.types : [type])
          .filter((member): member is ts.StringLiteralType => member.isStringLiteral())
          .map(member => member.value)
          .filter(value => /[\p{L}\p{N}]/u.test(value));
        if (values.length) found.push(`${file}:${line(expression)}: ${values.join(' | ')}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(program.getSourceFile(file)!);
  }
  return found;
}
const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX, strict: true, noEmit: true, skipLibCheck: true, types: [],
};
function programFor(sources: Record<string, string>): ts.Program {
  const host = ts.createCompilerHost(compilerOptions);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, language, ...rest) => (name in sources
    ? ts.createSourceFile(name, sources[name], language, true, scriptKind(name))
    : getSourceFile(name, language, ...rest));
  host.fileExists = name => name in sources || ts.sys.fileExists(name);
  host.readFile = name => sources[name] ?? ts.sys.readFile(name);
  host.directoryExists = name => Object.keys(sources).some(file => file.startsWith(`${name}/`)) || ts.sys.directoryExists(name);
  return ts.createProgram(Object.keys(sources), compilerOptions, host);
}
function appFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    // App source only: tests assert on rendered copy and may spell it out.
    return entry.isDirectory() ? appFiles(path) : /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}
test('catalogue guard catches text and every protected attribute, with file and line', () => {
  expect(violations('<div>Oops 2</div>', 'bad.tsx')).toEqual(['bad.tsx:1: Oops 2']);
  for (const name of ['aria-label', 'aria-description', 'title', 'alt', 'placeholder', 'label']) {
    expect(violations(`<>\n<div ${name}="Oops" /></>`, 'bad.tsx')).toEqual(['bad.tsx:2: Oops']);
  }
  for (const expression of ["'Hello'", '`Hello`']) {
    expect(violations(`<div>\n{${expression}}</div>`, 'bad.tsx')).toEqual(['bad.tsx:2: Hello']);
    for (const name of ['aria-label', 'aria-description', 'title', 'alt', 'placeholder', 'label']) {
      expect(violations(`<>\n<div ${name}={${expression}} /></>`, 'bad.tsx')).toEqual(['bad.tsx:2: Hello']);
    }
  }
  expect(violations('<div>{text("product")}</div>', 'good.tsx')).toEqual([]);
});
test('catalogue guard catches phrases kept outside JSX, but not class names or module paths', () => {
  expect(violations("const message = 'Try again';\nexport const A = () => <p>{message}</p>;", 'bad.tsx')).toEqual(['bad.tsx:1: Try again']);
  expect(violations('const message = `Try again`;', 'bad.tsx')).toEqual(['bad.tsx:1: Try again']);
  expect(violations('<div aria-label="Try again" />', 'bad.tsx')).toEqual(['bad.tsx:1: Try again']);
  expect(violations('const message = `Try ${action}`;', 'bad.tsx')).toEqual(['bad.tsx:1: Try']);
  expect(violations('const count = `${n} cards left`;', 'bad.tsx')).toEqual(['bad.tsx:1: cards left']);
  expect(violations('<div>\n{`Try ${action}`}</div>', 'bad.tsx')).toEqual(['bad.tsx:2: Try']);
  expect(violations('<div title={`Card ${n}`} />', 'bad.tsx')).toEqual(['bad.tsx:1: Card']);
  expect(violations('text(`rank.${rank}`);\n<div className={`opponent ${seat}`} />', 'good.tsx')).toEqual([]);
  expect(violations(`import x from './some module';\n<div className="card back" />;\n<div className={'card back'} />`, 'good.tsx')).toEqual([]);
});
test('catalogue guard catches words kept in constants, in the component or imported', () => {
  expect(typedViolations(programFor({
    '/v/a.tsx': "const label = 'Continue';\nexport const A = () => <button>{label}</button>;",
  }), ['/v/a.tsx'])).toEqual(['/v/a.tsx:2: Continue']);
  expect(typedViolations(programFor({
    '/v/copy.ts': "export const message = 'Hint';",
    '/v/b.tsx': "import { message } from './copy';\nexport const B = () => <p title={message}>{message}</p>;",
  }), ['/v/b.tsx'])).toEqual(['/v/b.tsx:2: Hint', '/v/b.tsx:2: Hint']);
  expect(typedViolations(programFor({
    '/v/c.tsx': "declare function text(id: string): string;\nconst id = 'product';\nexport const C = () => <p className={id}>{text(id)}</p>;",
  }), ['/v/c.tsx'])).toEqual([]);
  expect(violations("export const message = 'Try again';", 'copy.ts')).toEqual(['copy.ts:1: Try again']);
});
test('every app source file sources learner-facing copy from the catalogue', () => {
  const files = appFiles('src/app');
  expect(files.flatMap(file => violations(readFileSync(file, 'utf8'), file))).toEqual([]);
  expect(typedViolations(ts.createProgram(files, compilerOptions), files)).toEqual([]);
});
