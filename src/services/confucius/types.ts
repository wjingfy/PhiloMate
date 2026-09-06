export type InputPath = 'path1' | 'path2';

export type LensKind = 'theme' | 'category';

export interface UserLens {
  kind: LensKind;
  key: string;
  reinterpretation: string;
  mentionReason?: string;
  /** 一级族名（可选；sanitize 以 key 挂载为准纠偏） */
  family?: string;
}

export interface LensExtractResult {
  input: string;
  path: InputPath;
  pathReason?: string;
  condensed?: string;
  lenses: UserLens[];
  primaryLensIndex: number;
  faithful_check?: string;
  /**
   * path2：句中是否已能读出可标的形上/关系结构（已放宽：本事自带合离等结构即 true；纯薄事实才 false）。
   * false/缺省 → 强制 lenses 清空，再放宽再抽；true 才保留 category。
   */
  hasTension?: boolean;
}

export interface AttitudeFrame {
  lensKind: LensKind;
  lensKey: string;
  object: string;
  element: string;
  target: string;
  confuciusStance: string;
  trigger: string;
  keywords?: string[];
  attitudeLevel: number;
  attitudeRuleId?: string;
  reasoning?: string;
  expression?: string;
}

export type SceneDomain =
  | '为政'
  | '家亲'
  | '丧祭'
  | '交游'
  | '学业'
  | '省身'
  | '日用'
  | '评人'
  | '通用';

export interface CorpusEntry {
  id: string;
  text: string;
  annotationType: 'A' | 'B';
  condensed: string;
  themes?: string[];
  categories?: string[];
  temperaments?: string[];
  exemplar?: { label: string; kind: string };
  attitudeFrames?: AttitudeFrame[];
  /** 应用领域预标注（scene MVP） */
  sceneDomains?: SceneDomain[];
  sceneExclude?: SceneDomain[];
  /** 成句易错备注（注入 generation prompt） */
  generationCaution?: string;
}

export type Alignment = 'match' | 'mismatch';

export type OutputMode =
  | 'normal'
  | 'shortened'
  | 'stack_stern'
  | 'distant_cautious'
  | 'ellipsis'
  | 'animation_only';

export interface GenerationBundle {
  mode: '直陈' | '论证';
  corpusId: string;
  annotationType: 'A' | 'B';
  anchorText: string;
  anchorCondensed: string;
  anchorReinterp: string;
  exemplar?: { label: string; kind: string };
  userLens: UserLens;
  userConcreteHint?: string;
  alignment: Alignment;
  alignmentReason: string;
  currentAttitude: number;
  finalAttitude: number;
  longTermStack: number;
  cumulative: number;
  outputMode: OutputMode;
  maxChars: number;
  expressionBlock: string;
}

export interface PipelineDebug {
  path: InputPath;
  /** 本轮问旨 condensed（turnFocus） */
  condensed: string;
  lenses: UserLens[];
  primaryLens: UserLens | null;
  primaryLensIndex: number;
  corpusId: string;
  /** 匹配语料原文（可截断展示） */
  corpusText: string;
  corpusCondensed: string;
  corpusThemes: string[];
  corpusCategories: string[];
  relation?: string;
  speechAct?: string;
  /** 概念误读纠偏：term 被听成 wrongAs，实为 meantAs */
  glossRepair?: { term: string; wrongAs: string; meantAs: string } | null;
  /** 误读纠偏时透镜/选典用的实质问旨（非「纠偏…」对话问旨） */
  topicCondensed?: string | null;
  /** 成句未认听偏 → 已强制重写 */
  glossRepairRewritten?: boolean;
  userScenes: SceneDomain[];
  currentAttitude: number;
  /** 比照前语料帧态度；未调整时与 currentAttitude 相同 */
  baseAttitude?: number;
  /** 是否发生贴合反向（2/3→0 或 0→2） */
  attitudeInverted?: boolean;
  /** 是否因不贴合/求教等软化到 1 */
  attitudeSoftened?: boolean;
  /** 再解释比照：贴合度 */
  reinterpFit?: 'tight' | 'loose' | 'oppose_topic';
  /** 再解释比照：立场关系 */
  stanceRelation?: 'same' | 'opposite' | 'unclear' | 'inquire';
  /** 比照是否走模型（false=本地兜底） */
  attitudeCompareViaModel?: boolean;
  finalAttitude: number;
  longTermStack: number;
  outputMode: OutputMode;
  alignment: Alignment;
  triggeredLongTerm: boolean;
  /** 本轮句尾提问模式（未触发则为空）：stance | extend | topic_shift */
  tailQuestionKind?: string | null;
  /** 同轴引申/换题时选用的语料 id */
  tailExtendCorpusId?: string | null;
  /** 典与用户自陈近同义 → 强制换题尾问 */
  forceTopicShift?: boolean;
  /** 成句↔输入近复述且无尾问 → 已强制重写补问 */
  forceOutputInputTail?: boolean;
  /** 未授权却主句发问 → 已剥离/重写 */
  strippedUnauthorizedQuestion?: boolean;
  /** 成句崩坏/乱码 → 已强制重写或回退 */
  garbledRewritten?: boolean;
  /** 白话渗漏／过长无逗 → 已强制重写 */
  vernacularRunOnRewritten?: boolean;
  /** 原典逗号排比粘连（如今也纯俭吾从众）→ 已强制重写 */
  classicCommaCollapsedRewritten?: boolean;
  /** 缩句／未嵌原文半句 → 已强制重写 */
  compressedTelegramRewritten?: boolean;
  /** 是否问未带短答 → 已强制重写 */
  yesNoRewritten?: boolean;
  /** 是否问重写后仍缺短断，已确定性前缀注入 */
  yesNoForced?: boolean;
  /** 吾误代用户行事 → 已改汝 */
  wuUserDeedRewritten?: boolean;
  /** 旁观转述第三人行事误作汝 → 已改彼／重写 */
  thirdPartyRuRewritten?: boolean;
  ownershipInvertedRewritten?: boolean;
  /** 上文若假设被虽说成已然 → 已重写 */
  suiHypotheticalRewritten?: boolean;
  /** 未授权句首短断（是也／然…）→ 已剥离 */
  shortJudgmentStripped?: boolean;
  /** 短桥有让步／转折而成句丢掉 → 已强制重写（旗名沿用；含转折） */
  concessiveLogicRewritten?: boolean;
  /** 成句未体现裁决 bridge 三件套 → 已强制重写 */
  bridgeReflectRewritten?: boolean;
  /** 成句未体现表达约束 → 已强制重写 */
  expressionConstraintRewritten?: boolean;
  /** 重写后仍未满足表达约束 */
  expressionConstraintFailed?: boolean;
  /** 有 exemplar 却用户／论断在前、典例犹…甩尾 → 已强制重写 */
  exemplarOrderRewritten?: boolean;
  /** 重写后仍缺三件套 */
  bridgeReflectFailed?: boolean;
  /** 三件套校验摘要 */
  bridgeReflect?: {
    hasUserPole: boolean;
    hasCorpusPole: boolean;
    hasRelation: boolean;
    missing: string;
  } | null;
  /** 强制换典两步：抽象框架结果 */
  topicShiftFrame?: {
    ok: boolean;
    bridge: string;
    askIntent: string;
    rejectReason?: string;
  };
  topicShiftFrameSkipped?: string;
  /** path2 放宽再抽说明（仅 path2 无张力后；path1 不用） */
  path2Stretch?: string | null;
  /** path2：有张力→一般路线；无张力→清空后放宽再抽 */
  hasTension?: boolean | null;
  /** lens 来源：严格张力 / 放宽再抽 / 无 */
  lensSource?: 'strict' | 'loose' | 'empty' | null;
  /** 模型语料义项裁决短桥（何以由用户事至此典） */
  corpusBridge?: string | null;
  /** 裁决：仅换主语则可直化；false 则成句须写桥 */
  corpusBridgeSubjectOnly?: boolean | null;
  /** 选典后的可见成句形态：①直用／②化用／③写清桥 */
  sentenceMode?: 'direct' | 'hua' | 'bridge' | null;
  /** @deprecated 旧联想 condensed；现检索一律用问旨 condensed */
  associationQuery?: string | null;
  /** 情绪分层 A8/B1/B2/C/D */
  moodTier?: string | null;
  wantDieSense?: string | null;
  /** 本轮是否走 C 成句策略（含粘滞） */
  cStrategy?: boolean;
  /** C 成句模式：A=共情语料一步；B=两步 */
  cReplyMode?: 'A' | 'B' | null;
  /** C 成句落成讲义/大道理后已强制改写 */
  cEmpathyRewritten?: boolean;
  cStickyRemaining?: number;
  earlyExitSticky?: boolean;
  /** help = 求助面板文案已作为回复；ban = 一般禁谈（预留） */
  uiPanel?: 'help' | 'ban' | null;
  /** 本轮是否识别为夸赞（松议题粘滞） */
  praiseTurn?: boolean;
  /** 本轮是否释放了议题 sticky（activeLens） */
  stickyReleased?: boolean;
  /** 释放原因摘要，如 praise / shift / meta */
  stickyReleaseReason?: string | null;
}

export interface PipelineResult {
  text: string | null;
  outputMode: OutputMode;
  debug: PipelineDebug;
}
