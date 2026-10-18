import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

function violations(source: string, file: string): string[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const attributes = new Set(['aria-label', 'aria-description', 'title', 'alt', 'placeholder', 'label']);
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
      found.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}: ${value.trim()}`);
      return; // Don't report the same literal again from its children.
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    // Components only: tests assert on rendered copy and may spell it out.
    return entry.isDirectory() ? tsxFiles(path) : path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
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
test('every app TSX file sources learner-facing copy from the catalogue', () => {
  expect(tsxFiles('src/app').flatMap(file => violations(readFileSync(file, 'utf8'), file))).toEqual([]);
});
