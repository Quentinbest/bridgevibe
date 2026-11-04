import { cardName, list, text, type StringId } from '../explanation';
import type { Card } from '../table';

// E-02: card names and nested catalogue parameters follow the display locale.
export type Copy = { id: StringId; params: Readonly<Record<string, string | number | Card | readonly Card[] | { id: StringId }>> };
export function renderCopy(copy: Copy): string {
  return text(copy.id, Object.fromEntries(Object.entries(copy.params).map(([key, value]) => [key,
    typeof value !== 'object' ? value : 'id' in value ? text(value.id)
      : 'suit' in value ? cardName(value) : list(value.map(cardName)),
  ])));
}
