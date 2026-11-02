export type Entry = {
  text: string;
  status: 'draft' | 'signed';
  scope: 'learner' | 'internal';
  source?: 'human' | 'ai-draft';
  integrity?: true;
};
