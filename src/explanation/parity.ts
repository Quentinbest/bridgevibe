import { checkMessage, messageShape } from './format';

type Messages = Readonly<Record<string, { readonly text: string }>>;

// I18N-06.1: translation changes wording, never arguments or select choices.
export function parityErrors(base: Messages, other: Messages, locale = 'en'): string[] {
  const errors: string[] = [];
  for (const key of new Set([...Object.keys(base), ...Object.keys(other)])) {
    if (!Object.hasOwn(base, key) || !Object.hasOwn(other, key)) {
      errors.push(`${key}: missing catalogue key`);
      continue;
    }
    const invalid = checkMessage(other[key].text, locale);
    errors.push(...invalid.map(error => `${key}: ${error}`));
    if (invalid.length) continue;
    try {
      if (JSON.stringify(messageShape(base[key].text)) !== JSON.stringify(messageShape(other[key].text))) {
        errors.push(`${key}: message shape differs`);
      }
    } catch (error) {
      errors.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}
