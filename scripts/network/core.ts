import ts from 'typescript';

interface Review { reason: string; reviewer: string; date: string }
export interface NetworkPolicy {
  origins: (Review & { origin: string })[];
  computed: (Review & PackageModule & { call: string; count: number })[];
}
export interface PackageModule { package: string; version: string; module: string }
export interface NonNetworkUrl extends Review { url: string }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const reviewed = (entry: Record<string, unknown>) => ['reason', 'reviewer', 'date'].every(key => nonempty(entry[key]))
  && /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date)) && !Number.isNaN(Date.parse(String(entry.date)))
  && new Date(String(entry.date)).toISOString().slice(0, 10) === entry.date;
const origin = (value: string) => {
  try { const url = new URL(value); return /^(https?|wss?):$/.test(url.protocol) && url.origin === value && !/[;'"\s<>]/.test(value); } catch { return false; }
};
const httpUrl = (value: string) => {
  try { return /^https?:$/.test(new URL(value).protocol); } catch { return false; }
};

// LR-3(c), US-46.3: policy data is untrusted until validated, including exceptions.
export function validatePolicy(policy: unknown, urls: unknown): asserts policy is NetworkPolicy {
  const invalid = () => { throw new Error('Invalid network review list'); };
  if (!object(policy) || Object.keys(policy).sort().join() !== 'computed,origins' || !Array.isArray(policy.origins) || !Array.isArray(policy.computed) || !Array.isArray(urls)) return invalid();
  for (const entry of policy.origins) {
    if (!object(entry) || !reviewed(entry) || !nonempty(entry.origin) || !origin(entry.origin)
      || Object.keys(entry).sort().join() !== 'date,origin,reason,reviewer') invalid();
  }
  for (const entry of policy.computed) {
    if (!object(entry) || !reviewed(entry) || !nonempty(entry.package) || !/^(?:@[\w.-]+\/)?[\w.-]+$/.test(entry.package)
      || !nonempty(entry.version) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(entry.version)
      || !nonempty(entry.module) || !/^[\w.-]+(?:\/[\w.-]+)*$/.test(entry.module)
      || entry.module.split('/').some(part => part === '.' || part === '..')
      || !nonempty(entry.call) || !Number.isInteger(entry.count) || Number(entry.count) < 1
      || Object.keys(entry).sort().join() !== 'call,count,date,module,package,reason,reviewer,version') invalid();
  }
  for (const entry of urls) {
    if (!object(entry) || !reviewed(entry) || !nonempty(entry.url) || !/^https?:\/\//.test(entry.url) || !httpUrl(entry.url)
      || Object.keys(entry).sort().join() !== 'date,reason,reviewer,url') invalid();
  }
}

export function csp(policy: NetworkPolicy): string {
  return `default-src 'self'; connect-src 'self'${policy.origins.map(entry => ` ${entry.origin}`).join('')}; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; object-src 'none'; base-uri 'self'`;
}

// LR-3c: decode URL syntax before review so HTML entities and CSS escapes cannot hide targets.
const htmlValue = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|colon|sol|bsol|Tab|NewLine);?/gi, (entity, name: string) => {
  if (name.startsWith('#')) {
    const point = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd';
  }
  return ({ amp: '&', quot: '"', apos: "'", colon: ':', sol: '/', bsol: '\\', tab: '\t', newline: '\n' } as Record<string, string>)[name.toLowerCase()] ?? entity;
});
const cssValue = (value: string) => value.replace(/\\(?:([\da-f]{1,6})[\t\n\f\r ]?|\r\n|([\s\S]))/gi, (_escape, hex: string | undefined, char: string | undefined) => {
  const point = hex ? parseInt(hex, 16) : 0;
  return hex ? (point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd') : /[\r\n\f]/.test(char ?? '') ? '' : char ?? '';
});
const srcsetTargets = (value: string): string[] => {
  const targets: string[] = [];
  let i = 0;
  while (i < value.length) {
    while (/[\s,]/.test(value[i] ?? '') && i < value.length) i++;
    const start = i;
    while (i < value.length && !/\s/.test(value[i])) i++;
    const url = value.slice(start, i);
    if (url) targets.push(url.replace(/,+$/, ''));
    if (url.endsWith(',')) continue;
    let depth = 0;
    while (i < value.length) {
      const char = value[i++];
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (char === ',' && depth <= 0) break;
    }
  }
  return targets;
};

const literal = (node: ts.Node | undefined): string | undefined => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
const memberName = (node: ts.Expression): string => ts.isIdentifier(node) ? node.text
  : ts.isPropertyAccessExpression(node) ? node.name.text
    : ts.isElementAccessExpression(node) ? literal(node.argumentExpression) ?? '' : '';
export interface ScanOptions { computed?: false | PackageModule; literals?: boolean }
export function scanNetwork(file: string, code: string, policy: NetworkPolicy, urls: NonNetworkUrl[], options: ScanOptions = {}): string[] {
  const errors = new Set<string>();
  const allowed = (url: string) => {
    try { return policy.origins.some(entry => entry.origin === new URL(url, 'https://same-origin.invalid').origin); } catch { return false; }
  };
  const report = (target: string) => errors.add(`${file}: unreviewed network target ${target} (LR-3c)`);
  const request = (value: string, css = false) => {
    if (options.literals === false) return;
    const url = value.trim().replace(/[\t\n\r]/g, '');
    // LR-3c: CSS data URLs are embedded bytes, not connections; CSP still governs their use.
    if (css && /^data:/i.test(url)) return;
    if (/^(?:https?|wss?):\/\//i.test(url) || /^[\\/]{2}/.test(url)) {
      if (!allowed(url)) report(url);
    } else if (/api/i.test(url) || /^[a-z][\w+.-]*:/i.test(url) || /\\/.test(url)) report(url);
  };
  const absolute = (value: string) => {
    if (options.literals === false) return;
    for (const url of value.match(/(?:https?|wss?):\/\/[^\s<>"'`]+/gi) ?? []) {
      if (!allowed(url) && !urls.some(entry => entry.url === url)) report(url);
    }
  };
  const scanCss = (source: string) => {
    let i = 0;
    const trivia = () => {
      while (i < source.length) {
        if (/\s/.test(source[i])) i++;
        else if (source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; }
        else break;
      }
    };
    const string = (quote: string) => {
      const start = ++i;
      while (i < source.length && source[i] !== quote) { if (source[i] === '\\') i++; i++; }
      const value = source.slice(start, i); i++;
      return cssValue(value);
    };
    while (i < source.length) {
      trivia();
      if (source[i] === '"' || source[i] === "'") { string(source[i]); continue; }
      const token = /^(?:[-\w@]|\\(?:[\da-f]{1,6}[\t\n\f\r ]?|[^\r\n\f]))+/i.exec(source.slice(i));
      if (!token) { i++; continue; }
      i += token[0].length;
      const name = cssValue(token[0]).toLowerCase();
      trivia();
      if (name === '@import' && (source[i] === '"' || source[i] === "'")) request(string(source[i]), true);
      else if (name === 'url' && source[i] === '(') {
        i++; trivia();
        if (source[i] === '"' || source[i] === "'") request(string(source[i]), true);
        else {
          const start = i;
          while (i < source.length && source[i] !== ')') { if (source[i] === '\\') i++; i++; }
          request(cssValue(source.slice(start, i)), true);
        }
      }
    }
  };
  const counts = new Map<string, number>();
  const scanJs = (source: string) => {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const xhrNames = new Set<string>();
    const collect = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isNewExpression(node.initializer)
        && memberName(node.initializer.expression) === 'XMLHttpRequest') xhrNames.add(node.name.getText(tree));
      ts.forEachChild(node, collect);
    };
    collect(tree);
    const walk = (node: ts.Node) => {
      const value = literal(node);
      if (value !== undefined) absolute(value);
      else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) absolute(node.text);
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const name = memberName(node.expression);
        const xhrOpen = name === 'open' && ts.isPropertyAccessExpression(node.expression)
          && xhrNames.has(node.expression.expression.getText(tree));
        const api = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'importScripts'].includes(name)
          || node.expression.kind === ts.SyntaxKind.ImportKeyword || xhrOpen;
        if (api) {
          const args = node.arguments ?? [];
          const targets = name === 'importScripts' ? [...args] : [args[xhrOpen ? 1 : 0]];
          for (const target of targets) {
            const url = literal(target)?.trim();
            if (url === undefined) {
              if (options.computed === false) continue;
              const call = node.getText(tree);
              const count = (counts.get(call) ?? 0) + 1;
              counts.set(call, count);
              const module = options.computed;
              if (!module || !policy.computed.some(entry => entry.package === module.package && entry.version === module.version
                && entry.module === module.module && entry.call === call && count <= entry.count)) report(`computed: ${call}`);
            } else request(url);
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(tree);
  };
  if (/\.(?:html?|xhtml|svg)$/i.test(file)) {
    // LR-3c: preserve quoted '>' in opening tags and parse raw-text bodies separately.
    const html = code.replace(/<!--[\s\S]*?-->/g, '');
    const rawElement = /<(script|style)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1\s*>/gi;
    for (const match of html.matchAll(rawElement)) {
      if (match[1].toLowerCase() === 'script') scanJs(match[3]); else scanCss(match[3]);
    }
    const markup = html.replace(rawElement, '<$1$2></$1>');
    for (const part of markup.split(/[\s<>"']/)) absolute(part.replace(/;$/, ''));
    for (const tag of markup.matchAll(/<[a-z][\w:-]*\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
      const attributes = tag[0].replace(/^<[\w:-]+/, '');
      for (const attr of attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        const name = attr[1].toLowerCase();
        const value = htmlValue(attr[2] ?? attr[3] ?? attr[4] ?? '');
        if (/^on\w+$/.test(name)) scanJs(value);
        else if (name === 'style') scanCss(value);
        else if (name === 'srcset') srcsetTargets(value).forEach(url => request(url));
        else if (name === 'ping') value.split(/\s+/).forEach(url => request(url));
        else if (['src', 'href', 'xlink:href', 'poster', 'data', 'action', 'formaction', 'background', 'manifest'].includes(name)) request(value);
      }
    }
  } else if (/\.css$/i.test(file)) scanCss(code);
  else scanJs(code);
  return [...errors];
}
