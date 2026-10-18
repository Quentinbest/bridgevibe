import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

function violations(source: string, file: string): string[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const attributes = new Set(['aria-label', 'aria-description', 'title', 'alt', 'placeholder', 'label']);
  function literalValue(node: ts.Node | undefined): string | undefined {
    return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
  }
  function visit(node: ts.Node) {
    let value: string | undefined;
    if (ts.isJsxText(node)) value = node.text;
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) value = literalValue(node.expression);
    if (ts.isJsxAttribute(node) && attributes.has(node.name.getText(ast)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) value = node.initializer.text;
      if (ts.isJsxExpression(node.initializer)) value = literalValue(node.initializer.expression);
    }
    if (value && /[\p{L}\p{N}]/u.test(value)) {
      found.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}: ${value.trim()}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : path.endsWith('.tsx') ? [path] : [];
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
test('every app TSX file sources learner-facing copy from the catalogue', () => {
  expect(tsxFiles('src/app').flatMap(file => violations(readFileSync(file, 'utf8'), file))).toEqual([]);
});
