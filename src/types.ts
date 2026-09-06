import type { LongTermState } from './utils/confuciusLongTermAttitude';
import type { WindowUserMessage } from './utils/confuciusLongTermTrigger';

export const PHILOSOPHER_IDS = ['confucius', 'socrates', 'wangyangming', 'foucault'] as const;
export type PhilosopherId = (typeof PHILOSOPHER_IDS)[number];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string;
  outputMode?: string;
  evidenceId?: string;
  evidenceText?: string;
  generated?: boolean;
  evidenceSource?: string;
  evidenceChapter?: string;
}

export interface AttitudeFrameRecord {
  lensKind?: 'theme' | 'category';
  lensKey?: string;
  attitudeLevel?: number;
  [key: string]: unknown;
}

export interface CorpusEntryRecord {
  id: string;
  text: string;
  annotationType: 'A' | 'B';
  condensed: string;
  themes?: string[];
  categories?: string[];
  temperaments?: string[];
  attitudeFrames?: AttitudeFrameRecord[];
  generationCaution?: string;
  chapter?: string | number;
  chapterName?: string;
  source?: string;
  exemplar?: { label?: string; kind?: string };
  _legacy?: {
    text_anchor?: string;
    modern_scenes?: string[];
    modern_user_hooks?: string[];
    modern_pairs?: Array<{
      user_message?: string;
      reply_sketch?: string;
      scene_key?: string;
      kind?: string;
      must_phrase_substr?: string[];
      must_not?: string[];
    }>;
    trigger_types?: string[];
    status?: string;
    corpus_tier?: string;
  };
}

export interface SocratesDialogueState {
  turnCount: number;
  questionCooldown: number;
  consecutiveQuestionTurns: number;
  lastMode?: string;
  lastAnalogyDomain?: string;
  recentAnalogyDomains?: string[];
  lastDialecticMove?: string;
  recentDialecticMoves?: string[];
  recentTargetClaims?: string[];
  recentContributions?: string[];
}

export interface RoleData {
  philosopherId: PhilosopherId;
  nameplate: { displayName: string; intro: string };
  attitudes: Record<string, unknown>;
  themes: string[];
  categories: string[];
  coveredThemes: string[];
  coveredCategories: string[];
  corpus: CorpusEntryRecord[];
  distantCautious: unknown;
  sensitive: SensitiveConfig;
  sentenceOrganization: string;
  wastepaper: { entries?: WastepaperRecord[] };
  questions: { entries?: Array<Record<string, unknown>> };
  experiences: { experiences?: Array<Record<string, unknown>> };
  snackEvaluations: { evaluations?: Array<Record<string, unknown>> };
  snackReturns: { items?: Array<Record<string, unknown>> };
}

export interface WastepaperRecord {
  id: string;
  sourceId?: string;
  quoteIndex?: number;
  quote?: string;
  text?: string;
  wastepaperType?: 1 | 2;
  type?: number | string;
}

export interface SensitiveConfig {
  ui?: {
    genericBanPanel?: { text?: string };
    helpPanel?: { body?: string[] };
  };
  tierB?: {
    entries?: Record<string, { scripts?: string[]; afterThird?: string }>;
  };
}

export interface ConversationState {
  longTerm: LongTermState;
  recentMessages: WindowUserMessage[];
  usedCorpusIds: string[];
  cStickyRemaining: number;
  sensitiveCounts: Record<string, number>;
  /** 角色专用的跨轮状态；通用 harness 不解释其内部结构。 */
  roleRuntime?: {
    confuciusDialogueState?: unknown;
    socratesDialogueState?: SocratesDialogueState;
    foucaultDialogueState?: unknown;
  };
}

export interface PipelineDebugView {
  path: 'path1' | 'path2';
  condensed: string;
  primaryLens: { kind: 'theme' | 'category'; key: string; reinterpretation: string } | null;
  corpusId: string | null;
  corpusText: string;
  corpusBridge?: string;
  lenses?: Array<Record<string, unknown>>;
  lensSource?: string;
  selectionSource?: string;
  hasTension?: boolean;
  candidateCount?: number;
  selectionReason?: string;
  dialogueMove?: string;
  targetClaim?: string;
  questionFocus?: string;
  newContribution?: string;
  /** 福柯主动问题需要用户再答一次时保留当前问题。 */
  questionPending?: boolean;
  evidenceSource?: string;
  evidenceChapter?: string;
  baseAttitude: number;
  currentAttitude: number;
  finalAttitude: number;
  longTermStack: number;
  cumulative: number;
  outputMode: string;
  attitudeReason: string;
  sensitiveBucket: string;
  triggeredLongTerm: boolean;
  modelUsed: boolean;
  replySource: 'model' | 'offline' | 'local';
  favorabilityDelta: number;
  /** 最终成句失败并回退本地回复时的错误。 */
  genError?: string;
}

export interface PipelineResponse {
  text: string | null;
  panel: { kind: 'help' | 'ban'; lines: string[] } | null;
  state: ConversationState;
  debug: PipelineDebugView;
}
