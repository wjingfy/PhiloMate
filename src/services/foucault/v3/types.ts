/**
 * PhiloMate 福柯版管线类型定义
 * 依据 preannotation-schema-for-ai.md（schemaVersion: philomate-dialogue-v1）
 *       + 02-input-corpus-match-logic.md §9
 *       + 03-corpus-to-output-logic.md §0/§8
 *
 * 立场字段命名算法：frame[philosopherId + "Stance"]，引擎不写死任何人名。
 */

export const PHILOSOPHER_ID = 'foucault';
export const SCHEMA_VERSION = 'philomate-dialogue-v1';
/** 立场字段名按算法生成，禁止写死 */
export const STANCE_FIELD = `${PHILOSOPHER_ID}Stance`;

/* ---------------- 预标注语料（schema §2/§3） ---------------- */

export type Stance =
  | 'praise'
  | 'method'
  | 'neutral_explain'
  | 'reject'
  | 'lament'
  | 'refuse_talk';

export interface AttitudeFrame {
  lensKind: 'theme' | 'category';
  lensKey: string;
  object: string;
  element: string;
  target: 'person' | 'behavior' | 'ritual' | 'era' | 'concept' | 'self';
  /** 标注时埋的专名/特征词（专名直挂索引取材源之一） */
  keywords?: string[];
  /** 实际键名为 {philosopherId}Stance，用 STANCE_FIELD 动态读取 */
  [key: string]: unknown;
}

export interface CorpusEntry {
  id: string;
  text: string;
  annotationType: 'A' | 'B';
  layer: 'proposition' | 'exemplar' | 'both';
  classifyReason?: string;
  condensed: string;
  themes: string[];
  categories: string[];
  temperaments?: string[];
  exemplar?: { label: string; kind: 'person' | 'thing' | 'event' | 'group' };
  attitudeFrames?: AttitudeFrame[];
  faithful_check?: string;
  generationCaution?: string;
  chapter?: number;
  chapterName?: string;
}

export interface AnnotatedCorpus {
  schemaVersion: string;
  philosopherId: string;
  entries: CorpusEntry[];
  coveredThemes: string[];
  coveredCategories: string[];
}

/* ---------------- 02 · 选典段产物 ---------------- */

export type Path = 'path1' | 'path2';
export type LensSource = 'strict' | 'loose' | 'empty' | 'named';

export interface Lens {
  kind: 'theme' | 'category';
  key: string;
  reinterpretation: string;
  mentionReason?: string;
}

export interface AskIntentResult {
  condensed: string;
  relation: 'same_focus' | 'follow_cue' | 'shift';
  speechAct: 'continue' | 'rebuttal' | 'consistency' | 'refinement' | 'question' | 'meta';
  cueFromAssistant: string | null;
}

export interface RouteResult {
  input: string;
  path: Path;
  pathReason: string;
}

export interface LensExtractResult {
  input: string;
  path: Path;
  condensed: string;
  hasTension: boolean;
  lenses: Lens[];
  primaryLensIndex: number;
  faithful_check?: string;
}

export interface AdjudicationResult {
  usable: boolean;
  bestId: string | null;
  bridge: string;
  rejectReason?: string;
}

/** 02 §9 交出对象（选典段终点） */
export interface CorpusMatchOutput {
  path: Path;
  hasTension: boolean | null;
  lensSource: LensSource;
  userCondensed: string;
  relation?: string;
  speechAct?: string;
  primaryLens: Lens | null;
  lenses?: Lens[];
  anchor: CorpusEntry | null;
  corpusBridge: string;
  philosopherId: string;
}

/* ---------------- 03 · 输出段产物 ---------------- */

export type MoodTier = 'A' | 'A8' | 'B1' | 'B2' | 'C' | 'D';
export type MoodBucket =
  | 'platform_reject'
  | 'A'
  | 'A8'
  | 'B1'
  | 'B2'
  | 'B3' | 'B4' | 'B5' | 'B6' | 'B7' | 'B8' | 'B9' | 'B10' | 'B11'
  | 'C'
  | 'D';

export interface MoodDetection {
  tier: MoodTier;
  bucket: MoodBucket;
  reason: string;
  earlyExitSticky?: boolean;
  hasEmotion?: boolean;
}

export type Alignment = 'match' | 'mismatch';
export type Fit = 'tight' | 'loose' | 'oppose_topic';
export type StanceRelation = 'same' | 'opposite' | 'inquire' | 'unclear';

export interface CompareResult {
  fit: Fit;
  stanceRelation: StanceRelation;
  reason: string;
}

export type OutputMode =
  | 'animation_only'
  | 'ellipsis'
  | 'distant_cautious'
  | 'shortened'
  | 'stack_stern'
  | 'normal';

/** 03 §8.1 generationBundle（结构统一） */
export interface GenerationBundle {
  mode: string;
  corpusId: string;
  annotationType: 'A' | 'B';
  anchorText: string;
  anchorCondensed: string;
  anchorReinterp: string;
  /** 问旨 condensed（用户处境与意图；只作理解，不作取材） */
  userCondensed?: string;
  userLens: Lens;
  userConcreteHint?: string;
  alignment: Alignment;
  alignmentReason: string;
  currentAttitude: number;
  baseAttitude?: number;
  finalAttitude: number;
  longTermStack: number;
  outputMode: OutputMode;
  maxChars: number;
  expressionBlock: string;
  generationCaution?: string;
  tailQuestionBlock?: string;
  corpusBridgeBlock?: string;
  looseWhyBlock?: string;
  moodCBlock?: string;
  lightEmpathyBlock?: string;
}

/** 会话状态（02 §8 + 03 §3/§7） */
export interface DialogueState {
  usedCorpusIds: string[];
  lastCorpusId: string | null;
  cModeStickyRemaining: number;
  awaitingTailAnswer: boolean;
  moodTierHistory: MoodTier[];
  bucketHistory: MoodBucket[];
  /** 近 10 轮当期态度窗口（stack 触发用，03 §7.3） */
  attitudeHistory: number[];
  longTermStack: number;
  calmStreak: number;
  lastCalmAt: number;
  stickyLensKey: string | null;
}

/** 03 §8.2 调试字段（网页流程窗） */
export interface PipelineDebug {
  path?: Path;
  hasTension?: boolean | null;
  lensSource?: LensSource;
  corpusBridge?: string;
  moodTier?: MoodTier;
  bucket?: MoodBucket;
  hasEmotion?: boolean;
  cStrategy?: boolean;
  cStickyRemaining?: number;
  baseAttitude?: number;
  currentAttitude?: number;
  reinterpFit?: Fit;
  stanceRelation?: StanceRelation;
  attitudeCompareViaModel?: boolean;
  alignment?: Alignment;
  corpusId?: string | null;
  outputMode?: OutputMode;
  longTermStack?: number;
  finalAttitude?: number;
  userCondensed?: string;
  primaryLens?: Lens | null;
  viaPipeline?: boolean;
  tailQuestion?: boolean;
  questionPending?: boolean;
  note?: string;
}

/** 管线最终输出（交给网页） */
export interface PipelineResult {
  /** 气泡文本；面板类（A8/ban）为空字符串 */
  reply: string;
  attitude?: number;
  /** 面板类型：help=求助面板 ban=通用ban null=正常气泡 */
  uiPanel: 'help' | 'ban' | null;
  debug: PipelineDebug;
}
