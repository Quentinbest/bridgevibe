export type GlossaryEntry = {
  term: string;
  kind: 'term' | 'register';
  approved: string;
  avoid?: readonly { text: string; containedIn?: readonly string[] }[];
  status: 'draft' | 'signed';
  source: 'human' | 'ai-draft';
  note?: string;
};

export type LocaleGlossary = {
  locale: string;
  register: string;
  lengthLimit: number;
  entries: readonly GlossaryEntry[];
};
