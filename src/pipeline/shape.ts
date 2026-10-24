import { RANKS, SEATS, SUITS } from '../table';
import type { Content, Exercise, Lesson, Prompt } from '../curriculum/model';
import type { Finding } from './validate';

type Context = { path: string; contentId: string; rule: string };
type Check = (value: unknown, context: Context) => Finding | null;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = ({ rule, contentId, path }: Context): Finding => ({ rule, contentId, message: `Invalid ${path}.` });
const check = (predicate: (value: unknown) => boolean): Check => (value, context) => predicate(value) ? null : failure(context);
const string = check(value => typeof value === 'string');
const nonempty = check(value => typeof value === 'string' && !!value.trim());
const choice = (values: readonly unknown[]) => check(value => values.includes(value));
const integer = (min: number, max = Number.MAX_SAFE_INTEGER) => check(value =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max);
const rule = (name: string, child: Check): Check => (value, context) => child(value, { ...context, rule: name });
const array = (child: Check, min = 0, max = Number.MAX_SAFE_INTEGER): Check => (value, context) => {
  if (!Array.isArray(value) || value.length < min || value.length > max) return failure(context);
  for (let i = 0; i < value.length; i++) {
    const issue = child(value[i], { ...context, path: `${context.path}[${i}]` });
    if (issue) return issue;
  }
  return null;
};
const fields = (shape: Record<string, Check>, optional: readonly string[] = []): Check => (value, context) => {
  if (!object(value)) return failure(context);
  const current = { ...context, contentId: typeof value.contentId === 'string' && value.contentId.trim()
    ? value.contentId : context.contentId };
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(shape, key)) return failure({ ...current, path: `${context.path}.${key} (unknown key)` });
  }
  for (const [key, child] of Object.entries(shape)) {
    if (optional.includes(key) && !Object.hasOwn(value, key)) continue;
    const issue = child(Object.hasOwn(value, key) ? value[key] : undefined, { ...current, path: `${context.path}.${key}` });
    if (issue) return issue;
  }
  return null;
};
const variant = (choices: Record<string, Check>): Check => (value, context) => {
  if (!object(value) || typeof value.kind !== 'string' || !Object.hasOwn(choices, value.kind)) return failure(context);
  return choices[value.kind](value, context);
};
// US-27, §4.4: mirror model.ts, including optional fields; reject typos at every object boundary.
const content = {
  contentId: nonempty, version: integer(1),
  signOff: rule('rights-sign-off', fields({ status: choice(['unsigned-draft']) })),
  rights: rule('rights-sign-off', fields({ source: nonempty, licence: nonempty })),
} satisfies Record<keyof Content, Check>;
const card = fields({ suit: choice(SUITS), rank: choice(RANKS) });
const seat = choice(SEATS);
const reference = rule('catalogue-reference', nonempty);
const tags = array(nonempty);
const prompt = fields({
  ...content, promptId: nonempty, answerKind: choice(['card']), textRef: reference, commentaryRef: reference,
  expectedAnswers: rule('expected-answer', array(card, 1)), countsRejections: choice([true, false]),
  acceptThenScripted: rule('expected-answer', array(card)),
  equivalentsReviewed: rule('equivalent-cards', array(fields({ card, decision: choice(['accept', 'reject']), reason: string }, ['reason']))),
  hint: rule('hint-references', fields({ textRef: reference, referencedCards: array(card) })),
  skillTags: tags, correctRef: reference, wrongRef: reference, shownRef: reference,
} satisfies Record<keyof Prompt, Check>, ['countsRejections', 'acceptThenScripted', 'equivalentsReviewed', 'hint']);
const origin = variant({
  authored: fields({ kind: choice(['authored']), contentId: nonempty, version: integer(1) }),
  seed: fields({ kind: choice(['seed']), seed: check(value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)),
    index: integer(1), rotation: choice([0]), algorithm: choice(['bv-deal-1']) }),
});
const hand = array(card, 13, 13);
const deal = rule('deal-shape', fields({
  dealId: nonempty, origin, dealer: seat,
  hands: fields({ north: hand, east: hand, south: hand, west: hand }),
  vulnerability: fields({ northSouth: choice([true, false]), eastWest: choice([true, false]) }),
}));
const step = variant({
  commentary: fields({ kind: choice(['commentary']), textRef: reference }),
  exposure: rule('hint-references', fields({ kind: choice(['exposure']), cards: array(fields({ seat, card })) })),
  'scripted-action': rule('script-replay', fields({ kind: choice(['scripted-action']), scriptIndices: array(integer(0), 1) })),
  prompt: fields({ kind: choice(['prompt']), prompt }),
});
const exercise = fields({
  ...content, deal, contract: fields({ level: integer(1, 7), strain: choice([...SUITS, 'no-trumps']), declarer: seat }),
  learnerSide: choice(['northSouth']),
  script: rule('script-replay', array(fields({ seat, action: fields({ kind: choice(['play-card']), card }) }))),
  steps: array(step, 1),
} satisfies Record<keyof Exercise, Check>);
const lesson = fields({
  ...content, schemaVersion: choice([1]), gameFormat: choice(['contract-bridge', 'minibridge']), titleRef: reference,
  module: integer(1, 10), skillTags: tags, exercises: array(() => null, 1),
} satisfies Record<keyof Lesson, Check>);

export function structuralFinding(value: unknown, kind: 'lesson' | 'exercise'): Finding | null {
  const context = { path: kind, contentId: '(unknown)', rule: 'lesson-shape' };
  try { return (kind === 'lesson' ? lesson : exercise)(value, context); } catch { return failure(context); }
}
