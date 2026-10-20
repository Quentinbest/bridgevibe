import type { Action, Card, Contract, Deal, Seat } from '../table';

export type Content = Readonly<{ contentId: string; version: number; signOff: { status: 'unsigned-draft' } }>;
export type Provenance = Readonly<{ sourceKind: 'authored'; contentId: string; version: number }>;
export type Prompt = Content & Readonly<{
  promptId: string; answerKind: 'card'; textRef: string; commentaryRef: string;
  expectedAnswers: readonly Card[]; countsRejections?: boolean;
  // US-28.8: authors leave the hint out where they need an unaided measure.
  hint?: { textRef: string; referencedCards: readonly Card[] }; skillTags: readonly string[];
  correctRef: string; wrongRef: string; shownRef: string;
}>;
export type ScriptAction = Readonly<{ seat: Seat; action: Action }>;
export type Step = Readonly<{ kind: 'commentary'; textRef: string }>
  | Readonly<{ kind: 'scripted-action'; scriptIndices: readonly number[] }>
  | Readonly<{ kind: 'prompt'; prompt: Prompt }>;
export type Exercise = Content & Readonly<{
  deal: Deal; contract: Contract; learnerSide: 'northSouth'; script: readonly ScriptAction[]; steps: readonly Step[];
}>;
export type Lesson = Content & Readonly<{
  schemaVersion: 1; gameFormat: 'contract-bridge'; titleRef: string; skillTags: readonly string[];
  exercises: readonly Exercise[];
}>;
export type Attempt = Readonly<{
  learnerId: string; promptContentId: string; version: number; outcome: 'correct' | 'corrected' | 'failed';
  hintTier: 'none' | 'a'; hintTiming: 'before-first-answer' | 'after-wrong-answer' | null;
  time: number; playthroughId: string;
}>;
// §4.2: the progress module owns the session store; the player only appends to it.
export type AttemptSink = Readonly<{ append(attempt: Attempt): void }>;
