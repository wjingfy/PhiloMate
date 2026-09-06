import type { CorpusEntry, UserLens, InputPath, SceneDomain } from './types';
import {
  isRebuttalTurn,
  isMetaCritiqueTurn,
  isSelfCultivationShiftTurn,
  isSoftTopicShiftTurn,
  shouldReleaseDialogueSticky,
  isScopeClarificationTurn,
  type DialogueTurn,
  type StickyReleaseContext,
} from './dialogueLensGuard';
import { extractClassicPhrases } from './corpusDiversity';
import { isVocabLensKey, normalizeUserLens } from './lensNormalize';
import type { TurnRelation } from './turnFocus';
import { relationReleasesSticky, speechActIsDebate, type TurnSpeechAct } from './turnFocus';
import { isPraiseInput } from './praiseLensGuard';
import {
  replyLooksLikeTailQuestion,
  resolveContentionUserViewed,
  type TailQuestionKind,
} from './tailQuestion';
import type { MoodTier } from './moodDetect';

/** 跨轮议题状态（Phase A） */
export interface DialogueState {
  activeLens: UserLens | null;
  lastCorpusId: string | null;
  lastAnchorCondensed: string | null;
  /** 孔子侧已主张的 anchor 摘要（供成句禁止重复） */
  confuciusClaims: string[];
  /** 上一轮孔子实际成句（续论禁重复） */
  lastConfuciusReply: string | null;
  /** 用户明确否定的主张/范畴 */
  userRejections: string[];
  /** 跨轮应用领域（scene 词表） */
  activeScenes: SceneDomain[];
  sceneTags: string[];
  /** 本话题开放问旨（首条用户问 / 释放后刷新为 condensed） */
  openQuestion: string | null;
  /** 上一轮用户问旨 condensed（与 lens 分离，供 relation / 禁偏题） */
  lastUserCondensed: string | null;
  /** 本会话已用过的语料 id（降重复） */
  usedCorpusIds: string[];
  /** 本会话已化用过的经典词组 */
  usedClassicPhrases: string[];
  turnCount: number;
  /** 本争点上用户是否已亮出己见（供句尾提问 A→B/C） */
  contentionUserViewed: boolean;
  /** 上轮已句尾提问、等用户答（本轮不再叠问） */
  awaitingTailAnswer: boolean;
  /** 上轮句尾提问模式 */
  lastTailKind: TailQuestionKind | null;
  /** 句尾提问所钉的 lens key（换 lens 则重置观点齐否） */
  lastTailLensKey: string | null;
  /** C 策略粘滞剩余来回（0–3）；A8/B1/B2/C 触发后重设为 3 */
  cModeStickyRemaining: number;
  /** 近窗用户情绪/限制分层（含本轮写入前的历史；update 时追加） */
  moodTierHistory: MoodTier[];
}

export function createInitialDialogueState(): DialogueState {
  return {
    activeLens: null,
    lastCorpusId: null,
    lastAnchorCondensed: null,
    confuciusClaims: [],
    lastConfuciusReply: null,
    userRejections: [],
    activeScenes: [],
    sceneTags: [],
    openQuestion: null,
    lastUserCondensed: null,
    usedCorpusIds: [],
    usedClassicPhrases: [],
    turnCount: 0,
    contentionUserViewed: false,
    awaitingTailAnswer: false,
    lastTailKind: null,
    lastTailLensKey: null,
    cModeStickyRemaining: 0,
    moodTierHistory: [],
  };
}

const WORKPLACE = /上司|下属|成员|同事|领导|员工|职员|团队|工作|职|管理|督促|老板/;
const NEW_TOPIC = /另外|换个话题|不说这个|再问一下|还想问|另一个|说说别的/;
const NEGATE_XIAOTI = /跟.*(孝|悌|弟).*没|与.*(孝|悌|弟).*无|非.*(孝|悌|弟)|不.*(孝|悌|弟)|没关系.*(孝|悌|弟)/;

function stickyCtx(
  state: DialogueState,
  priorTurns?: DialogueTurn[],
  turnRelation?: TurnRelation | null
): StickyReleaseContext {
  const lastUser = [...(priorTurns || [])].reverse().find((t) => t.role === 'user');
  const lastAsst = [...(priorTurns || [])].reverse().find((t) => t.role === 'assistant');
  return {
    openQuestion: state.openQuestion,
    lastUserMessage: lastUser?.content ?? null,
    lastAssistantMessage: lastAsst?.content ?? state.lastConfuciusReply,
    lastUserCondensed: state.lastUserCondensed,
    turnRelation: turnRelation ?? null,
  };
}

export function isNewTopicTurn(
  userInput: string,
  state: DialogueState,
  priorTurns?: DialogueTurn[],
  turnRelation?: TurnRelation | null
): boolean {
  if (state.turnCount === 0) return true;
  if (NEW_TOPIC.test(userInput)) return true;
  if (isRebuttalTurn(userInput)) return false;
  // turnFocus.shift：豆浆粉→荤素等具体侧面切换
  if (turnRelation === 'shift') return true;
  // 粗域切换兜底（食物↔公器等）
  if (isSoftTopicShiftTurn(userInput, stickyCtx(state, priorTurns, turnRelation))) return true;
  return false;
}

/** 从用户反驳句提取否定项 */
export function extractUserRejections(userInput: string): string[] {
  const found: string[] = [];
  if (NEGATE_XIAOTI.test(userInput)) found.push('职场非孝悌', '孝悌');
  if (/跟.*(仁|德).*没|非.*仁|不.*算仁/.test(userInput)) found.push('非仁');
  if (/跟.*(礼).*没|非.*礼/.test(userInput)) found.push('非礼');
  if (WORKPLACE.test(userInput)) found.push('职场语境');
  if (isScopeClarificationTurn(userInput)) found.push('勿再论作息', '作息已澄清');
  if (isMetaCritiqueTurn(userInput)) found.push('质疑孔子发言方式');
  return found;
}

export function buildSceneTags(userInput: string, priorTurns: DialogueTurn[]): string[] {
  const tags = new Set<string>();
  const blob = userInput + priorTurns.map((t) => t.content).join('');
  if (WORKPLACE.test(blob)) tags.add('workplace');
  if (/朋友|秘密|解纷|交游/.test(blob)) tags.add('social');
  if (isRebuttalTurn(userInput)) tags.add('rebuttal');
  if (isMetaCritiqueTurn(userInput)) tags.add('meta_critique');
  if (isScopeClarificationTurn(userInput) || priorTurns.some((t) => isScopeClarificationTurn(t.content))) {
    tags.add('scope_resolved');
  }
  return [...tags];
}

/** 已澄清或 meta / 自修切换：禁止再扯回早期具体事例 */
export function getForbidDriftTopics(
  state: DialogueState,
  userInput: string,
  opts?: { relationReleases?: boolean; newCondensed?: string | null }
): string[] {
  const topics: string[] = [];
  const blob = `${userInput}${state.sceneTags.join('')}${state.userRejections.join('')}`;
  if (
    isMetaCritiqueTurn(userInput) ||
    state.sceneTags.includes('meta_critique') ||
    state.sceneTags.includes('scope_resolved') ||
    /勿再论作息/.test(blob)
  ) {
    topics.push('十时', '十点', '起床', '晨兴', '作息', '知好乐', '未若好之');
  }
  if (isMetaCritiqueTurn(userInput)) {
    topics.push('怠于', '行已不及');
  }
  // 已转到自修/良心：勿再扯本案有司/诽谤（除非本轮仍点名）
  if (isSelfCultivationShiftTurn(userInput) && !/报警|有司|诽谤|律法|刑书|网暴/.test(userInput)) {
    topics.push('有司', '报警', '报官', '诽谤', '谤言', '律法', '网暴', '何烦讼', '诉诸');
  }
  // 问旨已换/跟点：从上轮 condensed/openQuestion 抽实体词，本轮未再提则禁偏题
  if (opts?.relationReleases) {
    const prev = `${state.lastUserCondensed || ''}${state.openQuestion || ''}`;
    const cur = `${opts.newCondensed || ''}${userInput}`;
    for (const obj of prev.match(
      /豆浆粉|麦片|燕麦|红茶|原味|咖啡|蛋黄酥|自行车|诽谤|有司|十时|起床/g
    ) || []) {
      if (!cur.includes(obj)) topics.push(obj);
    }
    if (!/思齐|贤/.test(userInput)) {
      topics.push('见贤思齐', '思齐', '见不贤', '内自省');
    }
  }
  return [...new Set(topics)];
}

/** 检索时应排除的语料 id */
export function getExcludedCorpusIds(state: DialogueState, rebuttal: boolean): string[] {
  const ids: string[] = [...state.usedCorpusIds];
  if (rebuttal && state.lastCorpusId && !ids.includes(state.lastCorpusId)) {
    ids.push(state.lastCorpusId);
  }
  const rejectBlob = state.userRejections.join('');
  if (
    /孝|悌|弟/.test(rejectBlob) ||
    state.sceneTags.includes('workplace') ||
    state.activeScenes.includes('为政') ||
    state.activeScenes.includes('交游') ||
    state.sceneTags.includes('social')
  ) {
    ids.push('1.2', '2.6');
  }
  return [...new Set(ids)];
}

/** 成句时禁止重复的关键词/主张 */
export function getMustNotRepeat(state: DialogueState, rebuttal: boolean): string[] {
  const items = [
    ...state.confuciusClaims,
    ...state.userRejections,
    ...state.usedClassicPhrases,
  ];
  if (state.lastConfuciusReply) {
    items.push(state.lastConfuciusReply);
  }
  if (rebuttal && state.lastAnchorCondensed) {
    items.push(state.lastAnchorCondensed);
  }
  if (state.userRejections.some((r) => /孝|悌/.test(r))) {
    items.push('孝弟为仁之本', '孝悌为本', '本立道生');
  }
  return [...new Set(items)].slice(-14);
}

/** 续论同一话题时锁定 activeLens；收窄/核对/自修切换/软换题/反驳/夸赞/换题则放开 */
export function applyStickyActiveLens(
  extract: { lenses: UserLens[]; primaryLensIndex: number; path?: InputPath },
  state: DialogueState,
  userInput: string,
  rebuttal: boolean,
  priorTurns: DialogueTurn[] = [],
  turnRelation?: TurnRelation | null,
  turnSpeechAct?: TurnSpeechAct | null
): void {
  const ctx = stickyCtx(state, priorTurns, turnRelation);
  if (!state.activeLens || rebuttal || isNewTopicTurn(userInput, state, priorTurns, turnRelation)) {
    return;
  }
  // 夸赞轮：禁止把旧议题 lens 盖回（即使 relation 误标 same_focus）
  if (isPraiseInput(userInput)) return;
  if (shouldReleaseDialogueSticky(userInput, ctx)) return;
  // 与 updateDialogueState / pipeline.releaseSticky 对齐：收窄·发问·争辩轮勿盖回旧 lens
  // （否则「若父真害人，还隐吗」仍粘本/末 → 空接「务本」）
  if (
    turnSpeechAct === 'refinement' ||
    turnSpeechAct === 'question' ||
    (turnSpeechAct != null && speechActIsDebate(turnSpeechAct))
  ) {
    return;
  }
  if (turnRelation && relationReleasesSticky(turnRelation)) return;
  // 旧 state 可能残留词表外 key（如「思」），不得粘回
  if (!isVocabLensKey(state.activeLens.key)) return;
  const idx = extract.primaryLensIndex ?? 0;
  const primary = extract.lenses[idx];
  const sticky = normalizeUserLens(state.activeLens, extract.path ?? 'path1');
  if (!primary || primary.key === sticky.key) return;
  extract.lenses[idx] = {
    ...sticky,
    mentionReason: `续论${sticky.key}（state）`,
  };
}

export function updateDialogueState(params: {
  prev: DialogueState;
  userInput: string;
  rebuttal: boolean;
  primaryLens: UserLens | null;
  entry: CorpusEntry | null;
  priorTurns: DialogueTurn[];
  confuciusReply?: string | null;
  userScenes?: SceneDomain[];
  /** 本轮问旨 condensed（优先于 raw userInput 写入 openQuestion） */
  userCondensed?: string | null;
  turnRelation?: TurnRelation | null;
  turnSpeechAct?: TurnSpeechAct | null;
  /** 本轮句尾提问（若触发） */
  tailQuestionKind?: TailQuestionKind | null;
  /** 本轮情绪分层（写入 history + 更新 sticky） */
  moodTier?: MoodTier | null;
  earlyExitSticky?: boolean;
  appliedCStrategy?: boolean;
}): DialogueState {
  const {
    prev,
    userInput,
    rebuttal,
    primaryLens,
    entry,
    priorTurns,
    confuciusReply,
    userScenes,
    userCondensed,
    turnRelation,
    turnSpeechAct,
    tailQuestionKind = null,
    moodTier = null,
    earlyExitSticky = false,
    appliedCStrategy = false,
  } = params;
  const newRejections =
    rebuttal || isScopeClarificationTurn(userInput) ? extractUserRejections(userInput) : [];
  const claims = [...prev.confuciusClaims];
  if (confuciusReply) {
    claims.push(confuciusReply.slice(0, 48));
  } else if (entry?.condensed) {
    claims.push(entry.condensed.slice(0, 48));
  }

  const sceneTags = new Set([...prev.sceneTags, ...buildSceneTags(userInput, priorTurns)]);
  const classicPhrases = entry ? extractClassicPhrases(entry, confuciusReply) : [];
  const usedCorpusIds = entry
    ? [...new Set([...prev.usedCorpusIds, entry.id])].slice(-12)
    : prev.usedCorpusIds;
  const usedClassicPhrases = [...new Set([...prev.usedClassicPhrases, ...classicPhrases])].slice(-16);
  const ctx = stickyCtx(prev, priorTurns, turnRelation);
  const release =
    (turnRelation ? relationReleasesSticky(turnRelation) : false) ||
    (turnSpeechAct ? speechActIsDebate(turnSpeechAct) : false) ||
    turnSpeechAct === 'refinement' ||
    turnSpeechAct === 'question' ||
    shouldReleaseDialogueSticky(userInput, ctx) ||
    isNewTopicTurn(userInput, prev, priorTurns, turnRelation);
  const condensed = (userCondensed || userInput).trim().slice(0, 56) || userInput;

  const contentionUserViewed = primaryLens
    ? resolveContentionUserViewed({
        prev,
        userInput,
        topicReleased: release,
        primaryLens,
      })
    : release
      ? false
      : prev.contentionUserViewed;
  const asked =
    !!tailQuestionKind &&
    !!confuciusReply &&
    replyLooksLikeTailQuestion(confuciusReply);

  const moodTierHistory = moodTier
    ? [...(prev.moodTierHistory ?? []), moodTier].slice(-10)
    : prev.moodTierHistory ?? [];

  let cModeStickyRemaining = prev.cModeStickyRemaining ?? 0;
  if (moodTier === 'A8' || moodTier === 'B1' || moodTier === 'B2' || moodTier === 'C') {
    cModeStickyRemaining = 3;
  } else if (earlyExitSticky && cModeStickyRemaining > 0) {
    cModeStickyRemaining = 0;
  } else if (appliedCStrategy && cModeStickyRemaining > 0) {
    cModeStickyRemaining = Math.max(0, cModeStickyRemaining - 1);
  }

  return {
    activeLens: primaryLens,
    lastCorpusId: entry?.id ?? (release ? null : prev.lastCorpusId),
    lastAnchorCondensed: entry?.condensed ?? (release ? null : prev.lastAnchorCondensed),
    lastConfuciusReply: confuciusReply?.trim() || prev.lastConfuciusReply,
    confuciusClaims: claims.slice(-6),
    userRejections: [...new Set([...prev.userRejections, ...newRejections])].slice(-8),
    activeScenes: userScenes?.length ? userScenes : prev.activeScenes,
    sceneTags: [...sceneTags].slice(-6),
    openQuestion: release ? condensed : prev.openQuestion ?? condensed,
    lastUserCondensed: condensed,
    usedCorpusIds,
    usedClassicPhrases,
    turnCount: prev.turnCount + 1,
    contentionUserViewed,
    awaitingTailAnswer: asked,
    lastTailKind: asked ? tailQuestionKind : release ? null : prev.lastTailKind,
    lastTailLensKey: asked
      ? primaryLens?.key ?? null
      : release
        ? null
        : prev.lastTailLensKey,
    cModeStickyRemaining,
    moodTierHistory,
  };
}

/** 新对话 / 显式换题时重置议题状态（保留情绪粘滞与 history） */
export function resetDialogueStateForNewTopic(prev: DialogueState): DialogueState {
  return {
    ...createInitialDialogueState(),
    sceneTags: prev.sceneTags,
    cModeStickyRemaining: prev.cModeStickyRemaining ?? 0,
    moodTierHistory: prev.moodTierHistory ?? [],
  };
}
