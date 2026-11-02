export type MessageNode =
  | { type: 'literal'; value: string }
  | { type: 'argument'; name: string }
  | { type: 'pound' }
  | { type: 'plural' | 'select'; name: string; branches: ReadonlyMap<string, readonly MessageNode[]> };

// I18N-06.2: apostrophes are literal; only braces and plural # have syntax.
export function parseMessage(message: string): readonly MessageNode[] {
  let position = 0;
  const fail = (reason: string): never => { throw new Error(`${reason} at position ${position}`); };
  const whitespace = () => { while (/\s/.test(message[position] ?? '') && position < message.length) position++; };
  const token = () => {
    const start = position;
    while (position < message.length && !/[\s{},]/.test(message[position])) position++;
    return message.slice(start, position);
  };
  function sequence(inBranch: boolean, inPlural: boolean): MessageNode[] {
    const nodes: MessageNode[] = [];
    while (position < message.length) {
      if (message[position] === '}') {
        if (!inBranch) fail('Unexpected closing brace');
        position++;
        return nodes;
      }
      if (message[position] === '{') {
        position++; whitespace();
        const name = token();
        if (!name) fail('Empty argument name');
        whitespace();
        if (message[position] === '}') {
          position++; nodes.push({ type: 'argument', name }); continue;
        }
        if (message[position] !== ',') fail(`Expected comma after argument ${name}`);
        position++; whitespace();
        const type = token();
        if (type !== 'plural' && type !== 'select') fail(`Unknown argument type ${type}`);
        whitespace();
        if (message[position] !== ',') fail(`Expected comma after ${type}`);
        position++;
        const branches = new Map<string, readonly MessageNode[]>();
        while (true) {
          whitespace();
          if (position >= message.length) fail(`Unterminated ${type} argument ${name}`);
          if (message[position] === '}') { position++; break; }
          const selector = token();
          if (!selector) fail('Empty selector');
          if (type === 'plural' && !/^(zero|one|two|few|many|other|=-?\d+(?:\.\d+)?)$/.test(selector)) {
            fail(`Invalid plural selector ${selector}`);
          }
          if (branches.has(selector)) fail(`Duplicate selector ${selector}`);
          whitespace();
          if (message[position] !== '{') fail(`Expected branch opening brace for ${selector}`);
          position++;
          branches.set(selector, sequence(true, inPlural || type === 'plural'));
        }
        if (!branches.has('other')) fail(`${type} argument ${name} requires an other branch`);
        nodes.push({ type: type as 'plural' | 'select', name, branches });
      } else if (inPlural && message[position] === '#') {
        position++; nodes.push({ type: 'pound' });
      } else {
        const start = position++;
        while (position < message.length && !/[{}]/.test(message[position]) && !(inPlural && message[position] === '#')) position++;
        nodes.push({ type: 'literal', value: message.slice(start, position) });
      }
    }
    if (inBranch) fail('Unterminated branch');
    return nodes;
  }
  return sequence(false, false);
}

const numbers = new Map<string, Intl.NumberFormat>();
const lists = new Map<string, Intl.ListFormat>();
const plurals = new Map<string, Intl.PluralRules>();
function pluralRules(locale: string): Intl.PluralRules {
  if (!plurals.has(locale)) plurals.set(locale, new Intl.PluralRules(locale));
  return plurals.get(locale)!;
}
export function number(n: number, locale = 'en'): string {
  if (!numbers.has(locale)) numbers.set(locale, new Intl.NumberFormat(locale));
  return numbers.get(locale)!.format(n);
}
export function list(items: readonly string[], locale = 'en'): string {
  if (!lists.has(locale)) lists.set(locale, new Intl.ListFormat(locale, { type: 'conjunction' }));
  return lists.get(locale)!.format(items);
}

export function formatMessage(message: string, params: Readonly<Record<string, string | number>>, locale = 'en'): string {
  function render(nodes: readonly MessageNode[], pluralValue?: number): string {
    return nodes.map(node => {
      if (node.type === 'literal') return node.value;
      if (node.type === 'pound') return number(pluralValue!, locale);
      const value = Object.hasOwn(params, node.name) ? params[node.name] : undefined;
      if (node.type === 'argument') return typeof value === 'number' ? number(value, locale) : value ?? `{${node.name}}`;
      if (node.type === 'select') return render(node.branches.get(String(value)) ?? node.branches.get('other')!, pluralValue);
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Plural argument ${node.name} requires a finite number`);
      const exact = [...node.branches].find(([key]) => key.startsWith('=') && Number(key.slice(1)) === value);
      return render(exact?.[1] ?? node.branches.get(pluralRules(locale).select(value)) ?? node.branches.get('other')!, value);
    }).join('');
  }
  return render(parseMessage(message));
}

function visitChoices(nodes: readonly MessageNode[], visit: (node: Extract<MessageNode, { branches: unknown }>) => void) {
  for (const node of nodes) {
    if (node.type === 'plural' || node.type === 'select') {
      visit(node);
      for (const branch of node.branches.values()) visitChoices(branch, visit);
    }
  }
}

// I18N-06.1: branch wording and plural categories may differ between locales.
export function messageShape(message: string) {
  const nodes = parseMessage(message);
  const argumentsSet = new Set<string>();
  const choices = new Set<string>();
  function argumentsIn(nodes: readonly MessageNode[]) {
    for (const node of nodes) {
      if ('name' in node) argumentsSet.add(node.name);
      if ('branches' in node) for (const branch of node.branches.values()) argumentsIn(branch);
    }
  }
  argumentsIn(nodes);
  visitChoices(nodes, node => choices.add(JSON.stringify({ name: node.name, type: node.type,
    ...(node.type === 'select' ? { keys: [...node.branches.keys()].sort() } : {}) })));
  return { arguments: [...argumentsSet].sort(), choices: [...choices].sort().map(choice => JSON.parse(choice) as { name: string; type: 'plural' | 'select'; keys?: string[] }) };
}

const categories = new Map<string, readonly Intl.LDMLPluralRule[]>();
export function requiredPluralCategories(locale = 'en'): readonly Intl.LDMLPluralRule[] {
  if (!categories.has(locale)) {
    const found = new Set<Intl.LDMLPluralRule>(['other']);
    // I18N-06.1, plan §7 deviation 8: require categories reachable by app whole numbers.
    for (let n = 0; n <= 100_000; n++) found.add(pluralRules(locale).select(n));
    categories.set(locale, Object.freeze([...found].sort()));
  }
  return categories.get(locale)!;
}
export function checkMessage(message: string, locale = 'en'): string[] {
  try {
    const errors: string[] = [];
    visitChoices(parseMessage(message), node => {
      if (node.type === 'plural') for (const category of requiredPluralCategories(locale)) {
        if (!node.branches.has(category)) errors.push(`Plural argument ${node.name} missing ${category} branch for ${locale}`);
      }
    });
    return errors;
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}
