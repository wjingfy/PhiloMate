import {
  formatExpressionConstraintBlock,
  violatesExpressionConstraints,
} from '../../utils/confuciusExpression';
import {
  applyDowngrade,
  createInitialLongTermState,
  resolveLongTermAttitude,
  type LongTermState,
} from '../../utils/confuciusLongTermAttitude';
import {
  maybeApplyLongTermTrigger,
  type WindowUserMessage,
} from '../../utils/confuciusLongTermTrigger';
import { MODEL } from '../../constants/app';
import {
  extractConcreteHint,
  flattenLenses,
  getAlignedFrame,
  getCorpusEntries,
  getCorpusReinterp,
  getCoveredCategoryFamilies,
  getCoveredThemeFamilies,
  categoryKeyHasCorpus,
  listUncoveredCategoryKeys,
  listUncoveredThemeKeys,
  themeKeyHasCorpus,
} from './corpus';
import {
  acknowledgesGlossRepair,
  buildGlossRepairTopicCondensed,
  glossRepairSurfaceHint,
  inferGlossRepairSubstanceLenses,
  shouldReplaceGlossRepairLenses,
} from './glossRepair';
import { resolveAttitudeByReinterpCompare } from './attitudeCompare';
import { adjudicateCorpusFit, retrieveEntryWithLensFallback } from './corpusFitAdjudicate';
import {
  applyDialogueLensGuard,
  formatDialogueSnippet,
  isConsistencyChallengeTurn,
  isMetaCritiqueTurn,
  isQuestionRefinementTurn,
  isRebuttalTurn,
  isDebateTurn,
  isSelfCultivationShiftTurn,
  isSoftTopicShiftTurn,
  isFollowAssistantCueTurn,
  isDirectQuestionTurn,
  shouldReleaseDialogueSticky,
  type DialogueTurn,
} from './dialogueLensGuard';
import {
  applyStickyActiveLens,
  createInitialDialogueState,
  extractUserRejections,
  getExcludedCorpusIds,
  getForbidDriftTopics,
  getMustNotRepeat,
  isNewTopicTurn,
  resetDialogueStateForNewTopic,
  updateDialogueState,
  type DialogueState,
} from './dialogueState';
import {
  buildAffirmationPromptBlock,
  hasAffirmationOpener,
  shouldSuggestAffirmationOpener,
} from './affirmationGuard';
import {
  buildSternOpenerPromptBlock,
  hasSternOpener,
  isSternJudgmentAttitudeSlot,
  shouldSuggestSternOpener,
} from './sternOpenerGuard';
import {
  buildGeneralTonePromptBlock,
  extractUsedTonePhrases,
  hasToneMarker,
  shouldRollTonePhrase,
} from './tonePhrase';
import {
  buildSentenceRhythmPromptBlock,
  shouldRequireParallelPair,
} from './sentenceRhythm';
import {
  alignYesNoShortAnswer,
  buildYesNoAnswerPromptBlock,
  isYesNoStyleQuestion,
} from './yesNoAnswer';
import {
  checkBridgeReflection,
  looksDroppedBridgeLogic,
  shouldCheckBridgeReflect,
} from './bridgeReflectCheck';
import {
  buildModalityPersonPromptBlock,
  looksOwnershipInverted,
  looksSuiFramingPriorHypothetical,
  looksWuAttributingUserDeed,
  rewriteWuUserDeedToRu,
} from './modalityPersonGuard';
import {
  looksThirdPartyDeedAsRu,
  rewriteThirdPartyRuDeedToBi,
} from './thirdPartyRuGuard';
import {
  buildNoFreeShortJudgmentPromptBlock,
  isShortJudgmentAuthorized,
  looksUnauthorizedShortJudgment,
  stripUnauthorizedShortJudgment,
} from './shortJudgmentGuard';
import {
  distantCautiousFallback,
  effectiveMaxChars,
  looksClassicCommaCollapsed,
  looksCompressedTelegramConfuciusReply,
  looksExemplarTailSling,
  looksGarbledConfuciusReply,
  looksVernacularOrRunOnConfuciusReply,
  polishGeneration,
  stripCornerQuotes,
} from './generationPolish';
import { getPrimaryLens, normalizeUserLens, sanitizeLensExtract, enforcePath2NoTensionEmpty, isVocabLensKey } from './lensNormalize';
import { maxCharsForMode, resolveOutputMode } from './outputMode';
import { boostPraiseLens, demoteCourtesyLaughLeLens, stripCourtesyLaughPrefix, isPraiseInput } from './praiseLensGuard';
import { generateThanksReply, isThanksTurn } from './thanksGuard';
import { isContextFragileEntry } from './corpusContextGuard';
import { remapXiaoZhangPersonalGain, tightenPath2Lens } from './path2LensGuard';
import { resolveUserScenes } from './sceneDetect';
import { buildGeneratePrompt, PROMPT_LENS, PROMPT_LENS_LOOSE } from './prompts';
import { buildSentenceModeBlock, resolveSentenceMode } from './sentenceMode';
import {
  buildProactiveEvalMissPrompt,
  canLockProactiveEvalLens,
  isProactiveQuestionEval,
  lockProactiveEvalLens,
  PROACTIVE_EVAL_FALLBACK,
  PROACTIVE_EVAL_PROMPT_BLOCK,
  sanitizeProactiveEvalText,
} from './evaluate_question_confucius';
import { chatCompletionJson, chatCompletionText, chatCompletionTextStream } from './qwenJson';
import {
  decideTailQuestion,
  isNearRestatementOfUser,
  isNearRestatementOutputToInput,
  replyLooksLikeTailQuestion,
  stripUnauthorizedQuestions,
  resolveContentionUserViewed,
  type TailQuestionKind,
} from './tailQuestion';
import {
  buildTopicShiftAbstractFrame,
  buildTopicShiftFillPromptBlock,
} from './topicShiftTwoStep';
import {
  B12_FIXED_REPLY,
  buildMoodCPromptBlock,
  countB12InHistory,
  detectMoodAndPath,
  formatHelpPanelText,
  isConcreteBereavementInput,
  isEmpathyCorpus,
  looksCLectureLanding,
  type CReplyMode,
  type MoodTier,
} from './moodDetect';
import {
  b6GenerationBlock,
  b7GenerationBlock,
  b8GenerationBlock,
  countRestrictInHistory,
  formatBanPanelText,
  isFixedScriptRestrict,
  isGroupJia,
  isRestrictTier,
  pickRestrictScript,
  restrictAttitude,
  type RestrictTier,
} from './sensitiveRestrict';
import {
  relationReleasesSticky,
  resolveTurnFocus,
  speechActIsDebate,
  type TurnFocusResult,
} from './turnFocus';
import type {
  CorpusEntry,
  GenerationBundle,
  InputPath,
  LensExtractResult,
  PipelineDebug,
  PipelineResult,
  UserLens,
} from './types';

function boostDomainLens(userInput: string, extract: LensExtractResult): LensExtractResult {
  const t = userInput;
  if (/狮子座|星座|摩羯|白羊|天蝎|占卜|属相|生肖|八字/.test(t)) {
    const has = extract.lenses.some((l) => l.key === '怪力乱神');
    if (!has) {
      extract.lenses.unshift({
        kind: 'theme',
        key: '怪力乱神',
        reinterpretation: '信玄虚之别',
        mentionReason: '星座/占卜归怪力乱神',
      });
    }
    extract.path = 'path1';
    extract.primaryLensIndex = 0;
  }
  return extract;
}

/** API 不可用时，对已知输入走本地 lens，保证演示可跑 */
function tryOfflineExtract(userInput: string): LensExtractResult | null {
  if (/狮子座|星座|摩羯|白羊|天蝎|占卜|属相|生肖|八字/.test(userInput)) {
    return {
      input: userInput,
      path: 'path1',
      condensed: userInput,
      lenses: [
        {
          kind: 'theme',
          key: '怪力乱神',
          reinterpretation: '信玄虚之别',
          mentionReason: '星座/占卜归怪力乱神（offline）',
        },
      ],
      primaryLensIndex: 0,
    };
  }
  return null;
}

function normalizeLensExtract(raw: LensExtractResult, userInput: string, path: InputPath): LensExtractResult {
  return sanitizeLensExtract(
    {
      ...raw,
      input: userInput,
      path,
    },
    path,
    `${userInput}${raw.condensed || ''}`
  );
}

function buildWindowMessage(
  userInput: string,
  extract: LensExtractResult,
  currentAttitude: number
): WindowUserMessage {
  const flat = flattenLenses(extract.lenses);
  return {
    text: userInput,
    path: extract.path,
    themes: flat.themes,
    categories: flat.categories,
    condensed: extract.condensed,
    currentAttitude,
    at: new Date().toISOString(),
  };
}

function buildBundle(params: {
  extract: LensExtractResult;
  primaryLens: UserLens;
  entry: CorpusEntry;
  alignment: 'match' | 'mismatch';
  alignmentReason: string;
  currentAttitude: number;
  finalAttitude: number;
  longTermStack: number;
  cumulative: number;
  outputMode: ReturnType<typeof resolveOutputMode>;
  userInput: string;
  frameExpression?: string;
}): GenerationBundle {
  const baseMax = maxCharsForMode(params.outputMode);
  const maxChars = effectiveMaxChars(params.outputMode, baseMax, params.frameExpression);
  return {
    mode: params.alignment === 'match' ? '直陈' : '论证',
    corpusId: params.entry.id,
    annotationType: params.entry.annotationType,
    anchorText: params.entry.text,
    anchorCondensed: params.entry.condensed,
    anchorReinterp: getCorpusReinterp(params.entry, params.primaryLens),
    exemplar: params.entry.exemplar,
    userLens: params.primaryLens,
    userConcreteHint: extractConcreteHint(params.userInput, params.extract.condensed),
    alignment: params.alignment,
    alignmentReason: params.alignmentReason,
    currentAttitude: params.currentAttitude,
    finalAttitude: params.finalAttitude,
    longTermStack: params.longTermStack,
    cumulative: params.cumulative,
    outputMode: params.outputMode,
    maxChars,
    expressionBlock: formatExpressionConstraintBlock(params.finalAttitude),
  };
}

export interface RunPipelineOptions {
  userInput: string;
  longTermState: LongTermState;
  recentMessages: WindowUserMessage[];
  /** 当前轮之前的可见对话（不含本轮 userInput） */
  dialogueTurns?: DialogueTurn[];
  dialogueState?: DialogueState;
  /**
   * 主动提问评价：锁定题库 theme 作 primaryLens，语料只在该 theme 池检索。
   */
  lockTheme?: string;
  /** 夫子原问全文，写入问旨 condensed 供贴合裁决 */
  proactiveQuestion?: string;
  /**
   * 调试：强制句尾提问走 topic_shift，并指定换典语料 id（如 17.24）。
   * 设了则跳过随机选典，仍走完整成句管线。
   */
  forceTopicShiftCorpusId?: string;
  /** 调试：强制主典语料 id（仍走裁决写【bridge】与成句） */
  forceCorpusId?: string;
  /**
   * 主成句流式增量（仅首次 generate；重写轮仍非流式）。
   * 累积原文草稿；最终仍以 polish 后文本为准。
   */
  onGenerateDelta?: (draftSoFar: string) => void;
}

export interface RunPipelineResult extends PipelineResult {
  longTermState: LongTermState;
  recentMessages: WindowUserMessage[];
  dialogueState: DialogueState;
}

export async function runConfuciusPipeline(
  options: RunPipelineOptions
): Promise<RunPipelineResult> {
  const { userInput } = options;
  /** 句首客套笑剥掉后的语义句（route/lens/hint 用）；对话存贮仍用原文 */
  const semanticInput = stripCourtesyLaughPrefix(userInput);
  const priorTurns = options.dialogueTurns ?? [];
  const dialogueSnippet = formatDialogueSnippet(priorTurns);
  const metaCritiqueHeuristic = isMetaCritiqueTurn(userInput);
  const questionRefinementHeuristic = isQuestionRefinementTurn(userInput);
  const selfCultivationShift = isSelfCultivationShiftTurn(userInput);
  let dialogueState = options.dialogueState ?? createInitialDialogueState();
  // 旧会话可能缺句尾提问字段
  dialogueState = {
    ...createInitialDialogueState(),
    ...dialogueState,
    contentionUserViewed: dialogueState.contentionUserViewed ?? false,
    awaitingTailAnswer: dialogueState.awaitingTailAnswer ?? false,
    lastTailKind: dialogueState.lastTailKind ?? null,
    lastTailLensKey: dialogueState.lastTailLensKey ?? null,
    cModeStickyRemaining: dialogueState.cModeStickyRemaining ?? 0,
    moodTierHistory: dialogueState.moodTierHistory ?? [],
  };
  const lastUserMsg = [...priorTurns].reverse().find((t) => t.role === 'user')?.content ?? null;
  const lastAsstMsg =
    [...priorTurns].reverse().find((t) => t.role === 'assistant')?.content ??
    dialogueState.lastConfuciusReply;

  const stickyBefore = dialogueState.cModeStickyRemaining ?? 0;

  // ① 问旨先行（聪明模）：敏感话题也先理解，再交给下游 mood/path
  const turnFocus: TurnFocusResult = await resolveTurnFocus({
    userInput: semanticInput,
    openQuestion: dialogueState.openQuestion,
    lastUserCondensed: dialogueState.lastUserCondensed,
    lastUserMessage: lastUserMsg,
    lastAssistantMessage: lastAsstMsg,
    priorSnippet: dialogueSnippet || undefined,
    turnCount: dialogueState.turnCount,
  });
  const glossRepair = turnFocus.glossRepair;
  /** 有误读纠偏时：透镜/选典用「原概念本义」，不把纠偏行为当论题 */
  const topicCondensed = glossRepair
    ? buildGlossRepairTopicCondensed({
        repair: glossRepair,
        lastUserMessage: lastUserMsg,
        openQuestion: dialogueState.openQuestion,
      })
    : null;
  const lensCondensed = topicCondensed || turnFocus.condensed;

  // ② mood + path 合并轻量步（吃 condensed，附原句做安全核对）
  const moodAndPath = await detectMoodAndPath({
    condensed: turnFocus.condensed,
    userInput: semanticInput,
    priorSnippet: dialogueSnippet || undefined,
    stickyActive: stickyBefore > 0,
  });
  const mood = moodAndPath;
  const earlyExitSticky = !!(mood.earlyExitSticky && stickyBefore > 0 && mood.moodTier === 'D');
  const restrictActive = isRestrictTier(mood.moodTier);
  const cStrategyActive =
    !restrictActive &&
    (mood.moodTier === 'C' || (stickyBefore > 0 && !earlyExitSticky && mood.moodTier === 'D'));
  let cReplyMode: CReplyMode = null;
  const moodHistoryPreview = [...(dialogueState.moodTierHistory ?? []), mood.moodTier].slice(
    -10
  ) as MoodTier[];
  const b12Count = countB12InHistory(moodHistoryPreview);

  const finishMoodFixed = (
    text: string,
    uiPanel: 'help' | 'ban' | null,
    opts?: { attitude?: number; outputMode?: PipelineDebug['outputMode'] }
  ) => {
    const att = opts?.attitude ?? 1;
    let nextLt = options.longTermState;
    let outMode: PipelineDebug['outputMode'] = opts?.outputMode || 'normal';
    let outText = text;
    // 组甲：每次命中 stack+1；达阈可 …… / 不回（与近 10 句同类≥3 ban 并存）
    if (isGroupJia(mood.moodTier) && !uiPanel) {
      const downgraded = applyDowngrade(options.longTermState, 1);
      const resolvedLt = resolveLongTermAttitude({
        currentAttitude: att,
        state: downgraded,
      });
      nextLt = resolvedLt.nextState;
      if (resolvedLt.mode === 'ellipsis') {
        outMode = 'ellipsis';
        outText = '……';
      } else if (resolvedLt.mode === 'animation_only') {
        outMode = 'animation_only';
        outText = '';
      }
    }
    const debugFixed: PipelineDebug = {
      path: 'path2',
      condensed: turnFocus.condensed.slice(0, 56) || semanticInput.slice(0, 56),
      lenses: [],
      primaryLens: null,
      primaryLensIndex: 0,
      corpusId: '',
      corpusText: '',
      corpusCondensed: '',
      corpusThemes: [],
      corpusCategories: [],
      userScenes: [],
      currentAttitude: att,
      finalAttitude: att,
      longTermStack: nextLt?.longTermStack ?? 0,
      outputMode: outMode,
      alignment: 'match',
      triggeredLongTerm: false,
      moodTier: mood.moodTier,
      wantDieSense: mood.wantDieSense,
      cStrategy: false,
      cReplyMode: null,
      cStickyRemaining: stickyBefore,
      earlyExitSticky: false,
      uiPanel,
      praiseTurn: false,
      stickyReleased: true,
      stickyReleaseReason: mood.moodTier,
    };
    const nextState = updateDialogueState({
      prev: dialogueState,
      userInput: semanticInput,
      rebuttal: false,
      primaryLens: null,
      entry: null,
      priorTurns,
      // 面板文案不进对话态，避免下一轮把热线当孔子回复
      confuciusReply: uiPanel || outMode === 'animation_only' ? '' : outText,
      userCondensed: turnFocus.condensed.slice(0, 56) || semanticInput.slice(0, 56),
      moodTier: mood.moodTier,
      earlyExitSticky: false,
      appliedCStrategy: false,
    });
    return {
      text: outMode === 'animation_only' ? null : outText,
      outputMode: outMode,
      debug: debugFixed,
      longTermState: nextLt,
      recentMessages: options.recentMessages,
      dialogueState: nextState,
    };
  };

  if (mood.moodTier === 'A8') {
    return finishMoodFixed(formatHelpPanelText(), 'help');
  }
  if (mood.moodTier === 'B1' || mood.moodTier === 'B2') {
    if (b12Count >= 3) {
      return finishMoodFixed(formatHelpPanelText(), 'help');
    }
    return finishMoodFixed(B12_FIXED_REPLY, null, { attitude: 1 });
  }
  // B3–B11：定稿话术档；近 10 句同类 ≥3 → ban 面板
  if (isFixedScriptRestrict(mood.moodTier)) {
    const tier = mood.moodTier as RestrictTier;
    const same = countRestrictInHistory(moodHistoryPreview, tier);
    if (same >= 3) {
      return finishMoodFixed(formatBanPanelText('孔子'), 'ban', {
        attitude: restrictAttitude(tier),
      });
    }
    return finishMoodFixed(pickRestrictScript(tier, dialogueState.turnCount), null, {
      attitude: restrictAttitude(tier),
    });
  }
  // B6/B7/B8：继续成句；近 10 句同类 ≥3 → ban；下游加限制块 / 锁透镜
  const restrictContinue =
    restrictActive && !isFixedScriptRestrict(mood.moodTier)
      ? (mood.moodTier as RestrictTier)
      : null;
  if (restrictContinue) {
    const same = countRestrictInHistory(moodHistoryPreview, restrictContinue);
    if (same >= 3) {
      return finishMoodFixed(formatBanPanelText('孔子'), 'ban', {
        attitude: restrictAttitude(restrictContinue),
      });
    }
  }

  const focusFromModel = turnFocus.source === 'model';
  // 争辩/核对：主路径用 speechAct；仅 fallback 时用极薄启发式
  const rebuttal =
    Boolean(glossRepair) ||
    turnFocus.speechAct === 'rebuttal' ||
    (!focusFromModel && (isRebuttalTurn(userInput) || isDebateTurn(userInput)));
  const consistencyChallenge =
    turnFocus.speechAct === 'consistency' ||
    (!focusFromModel && isConsistencyChallengeTurn(userInput));
  const questionRefinement =
    turnFocus.speechAct === 'refinement' ||
    (!focusFromModel && questionRefinementHeuristic);
  const metaCritique =
    turnFocus.speechAct === 'meta' || metaCritiqueHeuristic;
  const focusReleases =
    relationReleasesSticky(turnFocus.relation) || speechActIsDebate(turnFocus.speechAct);
  const stickyReleaseCtx = {
    openQuestion: dialogueState.openQuestion,
    lastUserMessage: lastUserMsg,
    lastAssistantMessage: lastAsstMsg,
    lastUserCondensed: dialogueState.lastUserCondensed,
    turnRelation: turnFocus.relation,
  };
  // 粗域兜底；饮食内换侧面靠 relation
  const softTopicShift = isSoftTopicShiftTurn(semanticInput, stickyReleaseCtx);
  const followAssistantCue =
    turnFocus.relation === 'follow_cue' ||
    (turnFocus.source === 'fallback' && isFollowAssistantCueTurn(semanticInput, stickyReleaseCtx));
  const topicShift = turnFocus.relation === 'shift' || softTopicShift;
  const directQuestion =
    turnFocus.speechAct === 'question' || isDirectQuestionTurn(semanticInput);
  const releaseSticky =
    focusReleases ||
    shouldReleaseDialogueSticky(semanticInput, stickyReleaseCtx) ||
    softTopicShift ||
    directQuestion ||
    questionRefinement ||
    isPraiseInput(userInput);
  const praiseTurn = isPraiseInput(userInput);
  const stickyReleaseReason = (() => {
    if (!releaseSticky) return null;
    const parts: string[] = [];
    if (praiseTurn) parts.push('praise');
    if (turnFocus.relation === 'shift') parts.push('shift');
    if (turnFocus.relation === 'follow_cue') parts.push('follow_cue');
    if (metaCritique || turnFocus.speechAct === 'meta') parts.push('meta');
    if (rebuttal) parts.push('rebuttal');
    if (glossRepair) parts.push('gloss_repair');
    if (consistencyChallenge) parts.push('consistency');
    if (softTopicShift) parts.push('soft_shift');
    if (directQuestion) parts.push('question');
    if (questionRefinement) parts.push('refinement');
    return parts.length ? parts.join('+') : 'release';
  })();
  const retrievalCtx = releaseSticky
    ? `${semanticInput}${formatDialogueSnippet(priorTurns.slice(-2), 2)}`
    : `${semanticInput}${dialogueSnippet}`;
  if (
    isNewTopicTurn(semanticInput, dialogueState, priorTurns, turnFocus.relation) &&
    dialogueState.turnCount > 0 &&
    !rebuttal
  ) {
    dialogueState = resetDialogueStateForNewTopic(dialogueState);
  }
  let longTermState = options.longTermState;
  let recentMessages = [...options.recentMessages];

  // 新对话首条但 localStorage 残留 stack → 清零
  if (recentMessages.length === 0 && longTermState.longTermStack > 0) {
    longTermState = createInitialLongTermState();
  }

  const userScenes = resolveUserScenes(semanticInput, priorTurns, dialogueState.activeScenes);

  const offline = tryOfflineExtract(semanticInput);

  let path: InputPath;
  let extract: LensExtractResult;
  const pathReason = moodAndPath.pathReason;

  if (offline) {
    path = offline.path;
    extract = offline;
    extract.condensed = lensCondensed;
  } else {
    path = moodAndPath.path === 'path1' ? 'path1' : 'path2';
    // 同题续粘且已有合法 activeLens：跳过 lens LLM，直接沿用（仍用本轮 condensed 选典）
    const stickyLens =
      !releaseSticky &&
      !rebuttal &&
      !praiseTurn &&
      turnFocus.relation === 'same_focus' &&
      dialogueState.activeLens &&
      isVocabLensKey(dialogueState.activeLens.key)
        ? normalizeUserLens(dialogueState.activeLens, path)
        : null;

    if (stickyLens) {
      extract = {
        input: semanticInput,
        path,
        condensed: lensCondensed,
        hasTension: path === 'path2' ? true : undefined,
        lenses: [stickyLens],
        primaryLensIndex: 0,
        pathReason,
      };
    } else {
    const categoryFamilies = getCoveredCategoryFamilies();
    const themeFamilies = path === 'path1' ? getCoveredThemeFamilies() : undefined;
    const lensRaw = await chatCompletionJson<LensExtractResult>(
      PROMPT_LENS,
      JSON.stringify({
        input: semanticInput,
        path,
        pathReason,
        fixedCondensed: lensCondensed,
        categoryFamilies,
        themeFamilies,
        uncoveredThemes: path === 'path1' ? listUncoveredThemeKeys() : undefined,
        priorDialogue: dialogueSnippet || undefined,
        glossRepair: glossRepair
          ? {
              ...glossRepair,
              note: '纠偏是对话修复非论题；lenses 只锚定 term 本义/meantAs 与上文对该概念的主张',
            }
          : undefined,
        turnType: (() => {
          if (glossRepair) return 'gloss_repair';
          if (turnFocus.speechAct === 'rebuttal' || rebuttal) return 'rebuttal';
          if (turnFocus.speechAct === 'consistency' || consistencyChallenge) return 'consistency';
          if (turnFocus.speechAct === 'meta') return 'refinement';
          if (selfCultivationShift) return 'self_shift';
          if (topicShift || followAssistantCue) return 'topic_shift';
          if (directQuestion || questionRefinement) return 'refinement';
          return 'continue';
        })(),
        dialogueState: {
          activeLens: releaseSticky ? null : dialogueState.activeLens,
          openQuestion: releaseSticky
            ? lensCondensed
            : dialogueState.openQuestion,
          userRejections: dialogueState.userRejections,
          lastCorpusId: dialogueState.lastCorpusId,
          lastConfuciusReply: dialogueState.lastConfuciusReply,
          confuciusClaims: dialogueState.confuciusClaims,
          activeScenes: dialogueState.activeScenes,
          userScenes,
        },
      }),
      MODEL
    );
    extract = boostDomainLens(semanticInput, normalizeLensExtract(lensRaw, semanticInput, path));
    // 有 glossRepair：检索问旨用实质 topic；对话问旨仍保留 turnFocus.condensed 供 debug
    extract.condensed = lensCondensed;
    }
  }
  extract = boostPraiseLens(userInput, extract);
  extract = demoteCourtesyLaughLeLens(userInput, extract);
  extract = applyDialogueLensGuard(semanticInput, extract, priorTurns, userScenes);
  // guard 可能改 condensed（meta/职场等）；非特殊轮强制回 lens 问旨
  // 夸赞轮保留 boostPraiseLens 的 condensed，勿被旧问旨盖回
  // glossRepair：保持实质 topicCondensed，勿盖回「纠偏…」对话问旨
  if (!metaCritique && !selfCultivationShift && !isPraiseInput(userInput)) {
    extract.condensed = lensCondensed;
  }
  applyStickyActiveLens(
    extract,
    dialogueState,
    semanticInput,
    rebuttal,
    priorTurns,
    turnFocus.relation,
    turnFocus.speechAct
  );
  extract = sanitizeLensExtract(extract, path, `${semanticInput}${extract.condensed || ''}`);
  // path2 贴切度校正（物损等）；范畴义项靠词表/prompt，不机械改标
  extract = tightenPath2Lens(semanticInput, extract);
  // 消/长禁个人进益 → 得/失（主语须同一）
  extract = remapXiaoZhangPersonalGain(semanticInput, extract);
  extract = sanitizeLensExtract(extract, path, `${semanticInput}${extract.condensed || ''}`);
  // 误读纠偏不是“名/实”话题：空 lens／仅纠偏动作轴时注入实质 theme，照常选典重答。
  if (glossRepair && shouldReplaceGlossRepairLenses(extract.lenses)) {
    extract.lenses = inferGlossRepairSubstanceLenses(glossRepair, lastUserMsg, semanticInput);
    extract.primaryLensIndex = 0;
    extract.path = 'path1';
    extract.hasTension = undefined;
    path = 'path1';
  }
  // C 类具体丧失稳定落到“丧祭”，避免随机抽成乐官离散／川上流变等远桥。
  if (cStrategyActive && isConcreteBereavementInput(semanticInput) && themeKeyHasCorpus('丧祭')) {
    const bereavementLens = normalizeUserLens(
      {
        kind: 'theme',
        key: '丧祭',
        reinterpretation: '具体亲友／宠物离世之哀，以至情相应，禁讲迁变恒常',
        mentionReason: 'c_concrete_bereavement',
      },
      'path1'
    );
    extract.lenses = [
      bereavementLens,
      ...(extract.lenses || []).filter(
        (lens) => !(lens.kind === bereavementLens.kind && lens.key === bereavementLens.key)
      ),
    ];
    extract.primaryLensIndex = 0;
    extract.path = 'path1';
    extract.hasTension = undefined;
    path = 'path1';
  }
  // path2：无张力 → 清空 lenses → 放宽再抽；有张力 → 一般检索成句
  extract = enforcePath2NoTensionEmpty({ ...extract, path });
  const hasTensionFlag = extract.hasTension === true;

  const stateForRetrieval: DialogueState = rebuttal
    ? {
        ...dialogueState,
        userRejections: [
          ...new Set([...dialogueState.userRejections, ...extractUserRejections(userInput)]),
        ],
      }
    : dialogueState;
  const excludeCorpusIds = getExcludedCorpusIds(stateForRetrieval, rebuttal);
  const usedCorpusIds = dialogueState.usedCorpusIds ?? [];

  /** path2 无 category（含无张力清空后 / 无语料范畴被丢弃后）→ 放宽再抽 */
  let path2LooseLine: string | null = null;
  let usedLoosePass = false;
  if (path === 'path2' && !(extract.lenses || []).some((l) => l.kind === 'category')) {
    const categoryFamilies = getCoveredCategoryFamilies();
    const uncoveredAvoid = listUncoveredCategoryKeys();
    const runLoose = async (avoidCategories: string[]) => {
      const looseRaw = await chatCompletionJson<LensExtractResult>(
        PROMPT_LENS_LOOSE,
        JSON.stringify({
          input: semanticInput,
          path: 'path2',
          fixedCondensed: lensCondensed || extract.condensed,
          categoryFamilies,
          avoidCategories: avoidCategories.length ? avoidCategories : undefined,
          priorDialogue: dialogueSnippet || undefined,
          glossRepair: glossRepair
            ? {
                ...glossRepair,
                note: '纠偏非论题；只锚定 term 本义',
              }
            : undefined,
        }),
        MODEL
      ).catch(() => null);
      if (!looseRaw) return { extract: null as LensExtractResult | null, rawKeys: [] as string[] };
      const rawKeys = (looseRaw.lenses || [])
        .map((l) => (l.key || '').trim())
        .filter(Boolean);
      let looseExtract = normalizeLensExtract(looseRaw, semanticInput, 'path2');
      looseExtract.condensed = lensCondensed || extract.condensed;
      looseExtract.hasTension = false;
      looseExtract.path = 'path2';
      looseExtract = sanitizeLensExtract(
        looseExtract,
        'path2',
        `${semanticInput}${looseExtract.condensed || ''}`
      );
      return { extract: looseExtract, rawKeys };
    };

    let { extract: looseExtract, rawKeys } = await runLoose(uncoveredAvoid);
    if (!looseExtract || !(looseExtract.lenses || []).some((l) => l.kind === 'category')) {
      const dropped = rawKeys.filter((k) => !categoryKeyHasCorpus(k));
      ({ extract: looseExtract } = await runLoose([
        ...new Set([...uncoveredAvoid, ...dropped, ...rawKeys]),
      ]));
    }

    if (looseExtract && (looseExtract.lenses || []).some((l) => l.kind === 'category')) {
      extract = looseExtract;
      usedLoosePass = true;
      const pl = looseExtract.lenses[looseExtract.primaryLensIndex] || looseExtract.lenses[0];
      path2LooseLine = `loose · ${pl?.key || '?'} → ${pl?.reinterpretation || ''}`;
    } else if (looseExtract) {
      path2LooseLine = 'loose · 再抽仍无有语料 category';
    } else {
      path2LooseLine = 'loose · 再抽失败';
    }
  }

  // 放宽后再拦一次：个人进益勿消/长
  extract = remapXiaoZhangPersonalGain(semanticInput, extract);

  const primaryLensRaw = getPrimaryLens(extract, path, `${semanticInput}${extract.condensed || ''}`);
  const lockThemeKey = (options.lockTheme || '').trim();
  /** 主动提问评价：只评作答，不做句尾提问 roll */
  const isProactiveEval = isProactiveQuestionEval(options);
  let primaryLens =
    lockThemeKey && canLockProactiveEvalLens(lockThemeKey)
      ? lockProactiveEvalLens({
          lockTheme: lockThemeKey,
          primaryLensRaw,
          path: 'path1',
        })
      : primaryLensRaw;
  // B8：强制本/末或体/用；B7：优先怪力乱神 theme（有语料时）
  if (restrictContinue === 'B8') {
    const b8Key = categoryKeyHasCorpus('本/末')
      ? '本/末'
      : categoryKeyHasCorpus('体/用')
        ? '体/用'
        : '本/末';
    primaryLens = normalizeUserLens(
      {
        kind: 'category',
        key: b8Key,
        reinterpretation:
          primaryLensRaw?.key === b8Key && primaryLensRaw.reinterpretation
            ? primaryLensRaw.reinterpretation
            : '实用问归本末／体用：还日用自悟，禁列操作步骤',
        mentionReason: 'restrict_B8',
      },
      path === 'path1' ? 'path1' : 'path2'
    );
  } else if (restrictContinue === 'B7' && themeKeyHasCorpus('怪力乱神')) {
    primaryLens = normalizeUserLens(
      {
        kind: 'theme',
        key: '怪力乱神',
        reinterpretation:
          primaryLensRaw?.key === '怪力乱神' && primaryLensRaw.reinterpretation
            ? primaryLensRaw.reinterpretation
            : '不语怪力乱神，拒测算／改运步骤',
        mentionReason: 'restrict_B7',
      },
      path === 'path1' ? 'path1' : 'path2'
    );
  }
  const lensSource: 'strict' | 'loose' | 'empty' = !primaryLens
    ? 'empty'
    : lockThemeKey || restrictContinue === 'B8' || restrictContinue === 'B7'
      ? 'strict'
      : usedLoosePass
        ? 'loose'
        : 'strict';
  const associationQuery = null;
  let corpusBridge: string | null = null;
  let corpusBridgeSubjectOnly = false;

  const fitCondensed = options.proactiveQuestion
    ? `【夫子所问】${options.proactiveQuestion}\n【用户作答要旨】${extract.condensed || semanticInput}`
    : extract.condensed;

  // 无合法 lens：不硬塞假范畴、不套固定语料；短应具体事
  if (!primaryLens) {
    const debugEmpty: PipelineDebug = {
      path,
      condensed: turnFocus.condensed || extract.condensed || '',
      lenses: extract.lenses,
      primaryLens: null,
      primaryLensIndex: extract.primaryLensIndex ?? 0,
      corpusId: '',
      corpusText: '',
      corpusCondensed: '',
      corpusThemes: [],
      corpusCategories: [],
      relation: turnFocus.relation,
      speechAct: turnFocus.speechAct,
      glossRepair: glossRepair || null,
      topicCondensed: topicCondensed || null,
      userScenes,
      currentAttitude: 0,
      baseAttitude: 0,
      finalAttitude: 0,
      longTermStack: dialogueState.turnCount > 0 ? (options.longTermState?.longTermStack ?? 0) : 0,
      outputMode: 'normal',
      alignment: 'match',
      triggeredLongTerm: false,
      path2Stretch: path2LooseLine,
      hasTension: path === 'path2' ? hasTensionFlag : null,
      lensSource,
      corpusBridge: null,
      associationQuery,
      moodTier: mood.moodTier,
      wantDieSense: mood.wantDieSense,
      cStrategy: cStrategyActive,
      cReplyMode: cStrategyActive ? 'B' : null,
      cStickyRemaining: stickyBefore,
      earlyExitSticky,
      uiPanel: null,
      praiseTurn,
      stickyReleased: releaseSticky,
      stickyReleaseReason,
    };
    const plainPrompt = cStrategyActive
      ? `你是孔子（PhiloMate）。本轮为严重低落/粘滞 C 策略，无可用透镜。
【上文】
${formatDialogueSnippet(priorTurns.slice(-2), 2) || '（无）'}
【本轮】${semanticInput}
【要求】半文半白一行，先短应其情（认苦/同在），勿硬套训诫典；≤28字；禁咨询腔与“汝当”；自称丘；「汝」宜省；禁「」。
【输出】仅一行。不要解释。`
      : `你是孔子（PhiloMate）。用户仅陈述日常事实，本轮无可用形上透镜，勿硬套论语章句。
【上文】
${formatDialogueSnippet(priorTurns.slice(-2), 2) || '（无）'}
【本轮】${semanticInput}
【问旨】${turnFocus.condensed || semanticInput}
【要求】半文半白一行，约 12～24 字；点明用户事（如乘飞机而归），可短应，禁止成人之美、温良恭俭让等无关典；自称丘；「汝」宜省；禁「」。
【输出】仅一行。不要解释。`;
    const rawPlain = await chatCompletionText(plainPrompt, '请生成孔子短应。');
    const plainText = stripCornerQuotes((rawPlain || '').trim().slice(0, 40)) || '诺，丘知之。';
    const nextState = updateDialogueState({
      prev: dialogueState,
      userInput: semanticInput,
      rebuttal,
      primaryLens: null,
      entry: null,
      priorTurns,
      confuciusReply: plainText,
      userScenes,
      userCondensed: turnFocus.condensed,
      turnRelation: turnFocus.relation,
      turnSpeechAct: turnFocus.speechAct,
      tailQuestionKind: null,
      moodTier: mood.moodTier,
      earlyExitSticky,
      appliedCStrategy: cStrategyActive,
    });
    return {
      text: plainText,
      outputMode: 'normal',
      debug: debugEmpty,
      longTermState: options.longTermState,
      recentMessages: options.recentMessages,
      dialogueState: nextState,
    };
  }

  let entry: CorpusEntry | null = null;
  if (options.forceCorpusId) {
    const forced = getCorpusEntries().find((e) => e.id === options.forceCorpusId) || null;
    if (forced) {
      const fit = await adjudicateCorpusFit({
        userInput: semanticInput,
        condensed: fitCondensed,
        lens: primaryLens,
        candidates: [forced],
        mustPick: true,
      });
      entry = forced;
      corpusBridge = fit.bridge || null;
      corpusBridgeSubjectOnly = Boolean(fit.subjectOnly);
    }
  }
  if (!entry) {
    const picked = await retrieveEntryWithLensFallback({
      primaryLens,
      lenses: extract.lenses || [],
      userInput: semanticInput,
      condensed: fitCondensed,
      excludeCorpusIds,
      lastCorpusId: stateForRetrieval.lastCorpusId,
      usedCorpusIds,
      userScenes,
      preferEmpathy: cStrategyActive,
      preferParentIllnessXiao: cStrategyActive,
      lockToPrimary: !!lockThemeKey,
    });
    entry = picked.entry;
    corpusBridge = picked.bridge || null;
    corpusBridgeSubjectOnly = Boolean(picked.fit?.subjectOnly);
    if (
      picked.entry &&
      (picked.lens.kind !== primaryLens.kind || picked.lens.key !== primaryLens.key)
    ) {
      primaryLens = picked.lens;
      const idx = (extract.lenses || []).findIndex(
        (l) => l.kind === picked.lens.kind && l.key === picked.lens.key
      );
      if (idx >= 0) extract.primaryLensIndex = idx;
      else {
        extract.lenses = [picked.lens, ...(extract.lenses || [])];
        extract.primaryLensIndex = 0;
      }
    }
  }
  // 有 lens 但裁决无可用语料：不硬套固定章句，走短应
  if (!entry) {
    const debugMiss: PipelineDebug = {
      path,
      condensed: turnFocus.condensed || extract.condensed || '',
      lenses: extract.lenses,
      primaryLens,
      primaryLensIndex: extract.primaryLensIndex ?? 0,
      corpusId: '',
      corpusText: '',
      corpusCondensed: '',
      corpusThemes: [],
      corpusCategories: [],
      relation: turnFocus.relation,
      speechAct: turnFocus.speechAct,
      glossRepair: glossRepair || null,
      topicCondensed: topicCondensed || null,
      userScenes,
      currentAttitude: 0,
      baseAttitude: 0,
      finalAttitude: 0,
      longTermStack: options.longTermState?.longTermStack ?? 0,
      outputMode: 'normal',
      alignment: 'match',
      triggeredLongTerm: false,
      path2Stretch: path2LooseLine,
      hasTension: path === 'path2' ? hasTensionFlag : null,
      lensSource,
      corpusBridge: null,
      associationQuery,
      moodTier: mood.moodTier,
      wantDieSense: mood.wantDieSense,
      cStrategy: cStrategyActive,
      cReplyMode: cStrategyActive ? 'B' : null,
      cStickyRemaining: stickyBefore,
      earlyExitSticky,
      uiPanel: null,
      praiseTurn,
      stickyReleased: releaseSticky,
      stickyReleaseReason,
    };
    const missPrompt = isProactiveEval
      ? buildProactiveEvalMissPrompt({
          proactiveQuestion: options.proactiveQuestion,
          semanticInput,
          condensed: turnFocus.condensed || semanticInput,
          lens: primaryLens,
        })
      : cStrategyActive
        ? `你是孔子（PhiloMate）。本轮为 C 策略，透镜未匹配共情语料。
【本轮】${semanticInput}
【问旨】${turnFocus.condensed || semanticInput}
【要求】半文半白：先短应情，可轻触透镜义但勿训诫；约 18～40 字；禁咨询腔。自称丘；「汝」宜省。禁「」。
【句尾提问·须加】有透镜无语料仍须：断语以「。」收束后再另起一问（？收尾）；问从透镜再解释长出尚未亮明的侧面，禁复述用户原句当断语，禁空问「女以为何」。
【输出】仅一行（断语。问句？）。不要解释。`
        : `你是孔子（PhiloMate）。有透镜但未匹配语料，勿硬套无关章句。
【本轮】${semanticInput}
【问旨】${turnFocus.condensed || semanticInput}
【透镜】${primaryLens.kind}/${primaryLens.key} → ${primaryLens.reinterpretation}
【要求】半文半白；按透镜义短断，**禁同义复述**用户原句（坏例：把「自责非外议」再说一遍）。约 16～40 字。「汝」宜省。接续按关系选词。禁「」。
【句尾提问·须加（硬）】有 lens 即须加：断语以「。」收束，再另起一句实质问（？收尾）。问须从透镜再解释长出（如名/实：内名外实、自责与外议之辨的未明侧面），一眼可读；禁只复述断语再加「乎」。
【输出】仅一行：断语。问句？ 不要解释。`;
    let rawMiss = await chatCompletionText(
      missPrompt,
      isProactiveEval ? '请生成孔子评价短应。' : '请生成孔子短应并加句尾一问。'
    );
    let missText =
      stripCornerQuotes((rawMiss || '').trim().slice(0, 64)) ||
      (isProactiveEval ? PROACTIVE_EVAL_FALLBACK : '诺，丘知之。女谓何如？');
    if (isProactiveEval && replyLooksLikeTailQuestion(missText)) {
      missText = sanitizeProactiveEvalText(missText).text;
      debugMiss.strippedUnauthorizedQuestion = true;
    } else if (
      !isProactiveEval &&
      isNearRestatementOutputToInput({
        userInput: semanticInput,
        userCondensed: turnFocus.condensed,
        output: missText,
      }) &&
      !replyLooksLikeTailQuestion(missText)
    ) {
      // 成句↔输入近复述且无尾问 → 强制重写带问（非主动评价）
      rawMiss = await chatCompletionText(
        `${missPrompt}

【重写·近复述】上稿与用户输入大差不差且无句尾问，已废。须重写：断语勿复述用户；「。」后另起实质一问（？）。透镜：${primaryLens.key}→${primaryLens.reinterpretation}`,
        '请重写短应并加句尾一问。'
      );
      missText = stripCornerQuotes((rawMiss || '').trim().slice(0, 64)) || missText;
      debugMiss.forceOutputInputTail = true;
    } else if (!isProactiveEval && replyLooksLikeTailQuestion(missText)) {
      debugMiss.tailQuestionKind = 'stance';
    }
    const nextState = updateDialogueState({
      prev: dialogueState,
      userInput: semanticInput,
      rebuttal,
      primaryLens,
      entry: null,
      priorTurns,
      confuciusReply: missText,
      userScenes,
      userCondensed: turnFocus.condensed,
      turnRelation: turnFocus.relation,
      turnSpeechAct: turnFocus.speechAct,
      tailQuestionKind:
        !isProactiveEval && replyLooksLikeTailQuestion(missText) ? 'stance' : null,
      moodTier: mood.moodTier,
      earlyExitSticky,
      appliedCStrategy: cStrategyActive,
    });
    return {
      text: missText,
      outputMode: 'normal',
      debug: debugMiss,
      longTermState: options.longTermState,
      recentMessages: options.recentMessages,
      dialogueState: nextState,
    };
  }

  const frame = getAlignedFrame(entry, primaryLens, `${semanticInput}${extract.condensed || ''}`);
  const userCondensed = turnFocus.condensed || extract.condensed || '';
  const corpusTemperament = getCorpusReinterp(entry, primaryLens);
  const attResolved = await resolveAttitudeByReinterpCompare({
    frame,
    userReinterp: primaryLens.reinterpretation || '',
    userCondensed,
    corpusCondensed: entry.condensed || '',
    corpusTemperament,
    speechAct: turnFocus.speechAct,
  });
  let currentAttitude = attResolved.attitude;
  // 组甲 B6/B7：当期固定 2（计入警告；勿叠语料高态度，否则 stack+1 首轮就 ……）
  // B8 组乙保持 ≤1 温和
  if (restrictContinue === 'B6' || restrictContinue === 'B7') {
    currentAttitude = restrictAttitude(restrictContinue);
  } else if (restrictContinue === 'B8') {
    currentAttitude = Math.min(currentAttitude, 1);
  }
  // C / 粘滞：表达与窗口计数压到 ≤1，避免直斥与误触 stack
  if (cStrategyActive && currentAttitude > 1) {
    currentAttitude = 1;
  }

  cReplyMode = cStrategyActive
    ? isEmpathyCorpus(entry)
      ? 'A'
      : 'B'
    : null;

  const alignment = attResolved.alignment;
  const alignmentReason = attResolved.reason;

  const windowMsg = buildWindowMessage(semanticInput, extract, currentAttitude);
  recentMessages = [...recentMessages, windowMsg].slice(-10);

  // 组甲 B6/B7：每命中 stack+1（与定稿组甲一致）；其余仍走窗口触发
  let triggeredLongTerm = false;
  if (restrictContinue === 'B6' || restrictContinue === 'B7') {
    longTermState = applyDowngrade(longTermState, 1);
  } else {
    const triggerResult = maybeApplyLongTermTrigger(longTermState, recentMessages);
    longTermState = triggerResult.state;
    triggeredLongTerm = triggerResult.triggered;
  }

  const resolved = resolveLongTermAttitude({
    currentAttitude,
    state: longTermState,
  });
  longTermState = resolved.nextState;

  let outputMode = resolveOutputMode(
    currentAttitude,
    resolved.longTermStack,
    resolved.cumulative,
    resolved.mode
  );

  // 无 stack 的当期疏远(4) 必须说话，不得省略号
  if (resolved.longTermStack <= 0 && currentAttitude === 4) {
    outputMode = 'distant_cautious';
  }

  const finalAttitudeRaw =
    outputMode === 'normal' ||
    outputMode === 'shortened' ||
    outputMode === 'stack_stern' ||
    outputMode === 'distant_cautious'
      ? resolved.finalAttitude
      : resolved.finalAttitude;
  const finalAttitude = cStrategyActive
    ? Math.min(finalAttitudeRaw, 1)
    : finalAttitudeRaw;

  const sentenceMode = resolveSentenceMode({
    userInput: semanticInput,
    condensed: turnFocus.condensed || extract.condensed,
    path,
    hasTension: path === 'path2' ? hasTensionFlag : null,
    reinterpFit: attResolved.compare.fit,
    corpusBridge,
    corpusBridgeSubjectOnly,
  });

  const debug: PipelineDebug = {
    path,
    condensed: turnFocus.condensed || extract.condensed || '',
    lenses: extract.lenses,
    primaryLens,
    primaryLensIndex: extract.primaryLensIndex ?? 0,
    corpusId: entry.id,
    corpusText: entry.text || '',
    corpusCondensed: entry.condensed || '',
    corpusThemes: entry.themes || [],
    corpusCategories: entry.categories || [],
    relation: turnFocus.relation,
    speechAct: turnFocus.speechAct,
    glossRepair: glossRepair || null,
    topicCondensed: topicCondensed || null,
    userScenes,
    currentAttitude,
    baseAttitude: attResolved.baseAttitude,
    attitudeInverted: attResolved.inverted,
    attitudeSoftened: attResolved.softened,
    reinterpFit: attResolved.compare.fit,
    stanceRelation: attResolved.compare.stanceRelation,
    attitudeCompareViaModel: attResolved.compare.viaModel,
    finalAttitude,
    longTermStack: resolved.longTermStack,
    outputMode,
    alignment,
    triggeredLongTerm,
    path2Stretch: path2LooseLine,
    hasTension: path === 'path2' ? hasTensionFlag : null,
    lensSource,
    corpusBridge,
    corpusBridgeSubjectOnly: corpusBridgeSubjectOnly || null,
    sentenceMode,
    associationQuery,
    moodTier: mood.moodTier,
    wantDieSense: mood.wantDieSense,
    cStrategy: cStrategyActive,
    cReplyMode,
    cStickyRemaining: stickyBefore,
    earlyExitSticky,
    uiPanel: null,
    praiseTurn,
    stickyReleased: releaseSticky,
    stickyReleaseReason,
  };

  if (import.meta.env?.DEV) {
    console.debug('[Confucius pipeline]', debug, {
      alignmentReason,
      frame,
      dialogueState,
      turnFocus,
      excludeCorpusIds,
      rebuttal,
    });
  }

  const mustNotRepeat = getMustNotRepeat(stateForRetrieval, rebuttal);

  let tailQuestionKind: TailQuestionKind | null = null;

  const finish = (result: Omit<RunPipelineResult, 'dialogueState'> & Partial<Pick<RunPipelineResult, 'text'>>) => {
    const nextState = updateDialogueState({
      prev: dialogueState,
      userInput: semanticInput,
      rebuttal,
      primaryLens,
      entry,
      priorTurns,
      confuciusReply: result.text ?? null,
      userScenes,
      // glossRepair：写入实质 topic，避免 openQuestion 粘成「纠偏…」
      userCondensed: glossRepair ? lensCondensed : turnFocus.condensed,
      turnRelation: turnFocus.relation,
      turnSpeechAct: turnFocus.speechAct,
      tailQuestionKind,
      moodTier: mood.moodTier,
      earlyExitSticky,
      appliedCStrategy: cStrategyActive,
    });
    return {
      ...result,
      dialogueState: nextState,
    } as RunPipelineResult;
  };

  if (outputMode === 'animation_only') {
    return finish({
      text: null,
      outputMode,
      debug,
      longTermState,
      recentMessages,
    });
  }

  if (outputMode === 'ellipsis') {
    return finish({
      text: '……',
      outputMode,
      debug,
      longTermState,
      recentMessages,
    });
  }

  // 当期疏远且无 stack：直接用语料锚定回避句，不交给模型（避免误出省略号）
  if (outputMode === 'distant_cautious') {
    const text = distantCautiousFallback(entry, primaryLens);
    return finish({
      text,
      outputMode: 'distant_cautious',
      debug,
      longTermState,
      recentMessages,
    });
  }

  if (isThanksTurn(userInput)) {
    const text = await generateThanksReply({ userInput, priorTurns });
    return finish({
      text,
      outputMode: 'shortened',
      debug,
      longTermState,
      recentMessages,
    });
  }

  const bundle = buildBundle({
    extract,
    primaryLens,
    entry,
    alignment,
    alignmentReason,
    currentAttitude,
    finalAttitude,
    longTermStack: resolved.longTermStack,
    cumulative: resolved.cumulative,
    outputMode,
    userInput: semanticInput,
    frameExpression: frame?.expression,
  });

  const forbidDriftTopics = getForbidDriftTopics(stateForRetrieval, semanticInput, {
    relationReleases: focusReleases || softTopicShift,
    newCondensed: lensCondensed,
  });
  const lastConfuciusLine = [...priorTurns].reverse().find((t) => t.role === 'assistant')?.content;
  const isContinueTurn =
    dialogueState.turnCount > 0 &&
    !rebuttal &&
    !questionRefinement &&
    !directQuestion &&
    !consistencyChallenge &&
    !selfCultivationShift &&
    !topicShift &&
    !followAssistantCue;
  const focusQuestion = glossRepair
    ? lensCondensed
    : releaseSticky
      ? turnFocus.condensed
      : dialogueState.openQuestion ?? turnFocus.condensed;

  const recentConfuciusReplies = priorTurns
    .filter((t) => t.role === 'assistant')
    .map((t) => t.content)
    .slice(-2);
  const usedTonePhrases = extractUsedTonePhrases(
    [lastConfuciusLine, ...recentConfuciusReplies].filter((s): s is string => Boolean(s))
  );
  /** 约三成概率启用语气短词；欣赏/严厉/一般共用同一掷骰 */
  const toneRollOk = shouldRollTonePhrase(outputMode);

  const suggestAffirmation = shouldSuggestAffirmationOpener({
    currentAttitude,
    longTermStack: resolved.longTermStack,
    outputMode,
    isRebuttal: rebuttal,
    isMetaCritique: metaCritique,
    lastConfuciusReply: lastConfuciusLine,
    recentConfuciusReplies,
    rollOk: toneRollOk,
  });
  const forbidRepeatAffirmation =
    !suggestAffirmation &&
    currentAttitude === 0 &&
    resolved.longTermStack <= 0 &&
    outputMode === 'normal' &&
    recentConfuciusReplies.some((line) => hasAffirmationOpener(line));
  const affirmationBlock = suggestAffirmation
    ? buildAffirmationPromptBlock('suggest', usedTonePhrases)
    : forbidRepeatAffirmation
      ? buildAffirmationPromptBlock('forbid_repeat')
      : undefined;

  const yesNoQuestion = isYesNoStyleQuestion(semanticInput);
  const yesNoAnswerBlock = yesNoQuestion ? buildYesNoAnswerPromptBlock() : undefined;

  const suggestStern = shouldSuggestSternOpener({
    currentAttitude,
    longTermStack: resolved.longTermStack,
    cumulative: resolved.cumulative,
    outputMode,
    isRebuttal: rebuttal,
    isMetaCritique: metaCritique,
    lastConfuciusReply: lastConfuciusLine,
    recentConfuciusReplies,
    rollOk: toneRollOk,
  });
  const forbidRepeatStern =
    !suggestStern &&
    isSternJudgmentAttitudeSlot({
      currentAttitude,
      longTermStack: resolved.longTermStack,
      cumulative: resolved.cumulative,
    }) &&
    outputMode === 'normal' &&
    recentConfuciusReplies.some((line) => hasSternOpener(line));
  const sternOpenerBlock = suggestStern
    ? buildSternOpenerPromptBlock('suggest', usedTonePhrases, finalAttitude)
    : forbidRepeatStern
      ? buildSternOpenerPromptBlock('forbid_repeat')
      : undefined;

  const forceTopicShift = Boolean(options.forceTopicShiftCorpusId) ||
    isNearRestatementOfUser({
      userCondensed: turnFocus.condensed || extract.condensed,
      userReinterp: primaryLens.reinterpretation,
      entry,
    });

  const generalToneBlock =
    toneRollOk &&
    !suggestAffirmation &&
    !suggestStern &&
    !forbidRepeatAffirmation &&
    !forbidRepeatStern &&
    outputMode === 'normal' &&
    !metaCritique &&
    !isThanksTurn(userInput) &&
    !recentConfuciusReplies.slice(0, 2).some(hasToneMarker)
      ? buildGeneralTonePromptBlock(usedTonePhrases)
      : undefined;

  const shortJudgmentAuthorized = isShortJudgmentAuthorized({
    yesNoQuestion,
    suggestAffirmation,
    suggestStern,
    hasGeneralToneBlock: Boolean(generalToneBlock),
    hasGlossRepair: Boolean(glossRepair),
  });
  const shortJudgmentBlock = buildNoFreeShortJudgmentPromptBlock(shortJudgmentAuthorized);

  const sentenceRhythmBlock =
    outputMode === 'normal' && !metaCritique && !isThanksTurn(userInput)
      ? buildSentenceRhythmPromptBlock(shouldRequireParallelPair())
      : undefined;

  const contentionUserViewed = resolveContentionUserViewed({
    prev: dialogueState,
    userInput: semanticInput,
    topicReleased: releaseSticky,
    primaryLens,
  });
  const tailDecision =
    !isProactiveEval &&
    !metaCritique &&
    !isThanksTurn(userInput) &&
    !glossRepair
      ? decideTailQuestion({
          outputMode,
          primaryLens,
          contentionUserViewed,
          awaitingTailAnswer: dialogueState.awaitingTailAnswer,
          forceTopicShift,
          forceTopicShiftCorpusId: options.forceTopicShiftCorpusId,
          userCondensed: turnFocus.condensed || extract.condensed,
          userReinterp: primaryLens.reinterpretation,
          excludeCorpusIds: [
            entry.id,
            ...stateForRetrieval.usedCorpusIds,
            ...(dialogueState.lastCorpusId ? [dialogueState.lastCorpusId] : []),
          ],
        })
      : null;
  if (tailDecision) {
    tailQuestionKind = tailDecision.kind;
    bundle.maxChars = bundle.maxChars + tailDecision.extraChars;
    debug.tailQuestionKind = tailDecision.kind;
    if (forceTopicShift) debug.forceTopicShift = true;
    if (tailDecision.extendCorpusId) {
      debug.tailExtendCorpusId = tailDecision.extendCorpusId;
    }
  }

  /** 强制换典：先抽象框架，再把原文短语填进框架（两步） */
  let tailQuestionBlock = tailDecision?.promptBlock;
  const proactiveEvalBlock = isProactiveEval ? PROACTIVE_EVAL_PROMPT_BLOCK : undefined;
  if (tailDecision?.kind === 'topic_shift' && tailDecision.extendCorpusId) {
    const shiftEntry =
      getCorpusEntries().find((e) => e.id === tailDecision.extendCorpusId) ||
      null;
    if (shiftEntry) {
      const frame = await buildTopicShiftAbstractFrame({
        userCondensed: turnFocus.condensed || extract.condensed || '',
        userReinterp: primaryLens.reinterpretation || '',
        lens: primaryLens,
        mainCorpusId: entry.id,
        shiftEntry,
      });
      debug.topicShiftFrame = frame;
      if (frame.ok && frame.bridge && frame.askIntent) {
        tailQuestionBlock = buildTopicShiftFillPromptBlock(
          primaryLens,
          shiftEntry,
          frame
        );
      } else {
        // 框架搭不上则本轮不加尾问，避免假接续
        tailQuestionBlock = undefined;
        debug.topicShiftFrameSkipped = frame.rejectReason || 'frame_not_ok';
        tailQuestionKind = null;
        debug.tailQuestionKind = null;
      }
    }
  }

  const lastRel =
    lastConfuciusLine?.match(/譬如|譬诸|有如|无异于|正若|亦若|丘忽念|丘念|丘思及|亦|犹|若|如|似/)?.[0] ||
    '';
  /** 无张力成句形式：仅 path2 且判定 hasTension≠true（与是否走 loose 检索无关时仍以张力旗为准） */
  const useNoTensionOutputForm = path === 'path2' && !hasTensionFlag;
  /**
   * 【bridge】供理解；成句对照须落「用户极·典极·关系」三件套。
   * 无 exemplar／只嵌原文：三者顺序可换；有具体典例：典例须在先，其后用户与关系可换。
   */
  const exemplarBridgeOrderHint = entry.exemplar?.label
    ? `有 exemplar（${entry.exemplar.label}）：**典例须在先**；嵌 anchorText 原文；其后用户侧极与两边关系二者可换；**非**三者任意可换；禁碎压、禁用户／论断在前典例犹…甩尾。`
    : `无具体典例／只嵌原文：用户侧极 + 典侧极 + 两边关系三者顺序可换。`;
  const corpusBridgeBlock =
    sentenceMode === 'direct' && corpusBridge
      ? `\n【①直用·bridge仅供选材】
用户问的就是本条之题，直接用 anchor 回答；裁决 bridge 只供理解，禁止把它写成用户／典义对照表。
【bridge】（勿照抄）：${corpusBridge}\n`
      : sentenceMode === 'hua' && corpusBridge
        ? `\n【②化用·bridge仅供理解】
将 anchor 直接化入眼前事，读完即在说本事；可轻接关系，禁止展览三栏或抄白话 bridge。
【bridge】（勿照抄）：${corpusBridge}
嵌 anchorText；守施受；典中“夫子”不可作自称。\n`
      : useNoTensionOutputForm && corpusBridge
      ? `\n【联想bridge · 三件套】
本轮 path2 扯淡（无张力）。勿复述用户原事。
对照裁决【bridge】写作，成句**须同时具备**（缺一不可）：
1. **用户侧极**（本事／问点——问什么得点什么）
2. **典侧极**（anchor 所取之事／义）
3. **两边关系**（何以由此及彼：同构／因果／类推等；须可读，禁只并置两极）
${exemplarBridgeOrderHint}
**禁答非所问**：不可只复述典正面而晾着用户问点；bridge 已给理路时须落到用户那一极。
【bridge】是**白话理路**（只供理解），成句须半文言自写；**禁止**把【bridge】白话整段或「就像／所以可以接到」等白话接头照搬入句。
可自然措辞写关系义，禁只甩典名/碎压情节而无同构。
【bridge】（白话理路参考）：${corpusBridge}
${lastRel ? `上一轮已用“${lastRel}”，本轮换别类接续。` : ''}
嵌 anchorText；守施受；禁 condensed/temperament 措辞入句。\n`
      : !useNoTensionOutputForm && corpusBridge && corpusBridgeSubjectOnly
        ? `\n【成句bridge · 可直化】
裁决：只差主语。将典义落到本事主语即可（用户极与典极近同，关系可为「即／乃」轻接）。
【bridge】（白话理路参考，勿照抄白话）：${corpusBridge}
嵌 anchorText；守施受；典中「夫子」不可作自称（改丘/吾）。\n`
        : !useNoTensionOutputForm && corpusBridge
          ? `\n【成句bridge · 三件套】
对照裁决【bridge】写作，成句**须同时具备**（缺一不可；自检硬）：
1. **用户侧极**（本事／问点——用户问什么就得点什么、答什么）
2. **典侧极**（anchor 所取之事／义）
3. **两边关系**（何以由此及彼：同构／因果／类推等；须一眼可读，禁只并置两极、禁收成一句空断）
${exemplarBridgeOrderHint}
**禁答非所问**：不可只复述典的正面断语而晾着用户问点。若【bridge】已给出因果／同构，而用户问的是对侧／来源／是否，成句须**借同一理路轻翻落到用户那一极**，勿只说典侧正面。
【bridge】是**白话理路**（只供理解），成句须半文言自写；**禁止**照抄【bridge】白话或「就像／所以可以接到」等白话接头。
【bridge】（白话理路参考）：${corpusBridge}
嵌 anchorText；守施受；典中「夫子」不可作自称（改丘/吾）。\n`
          : undefined;
  const looseWhyBlock =
    useNoTensionOutputForm && usedLoosePass && !corpusBridge && primaryLens
      ? `\n【联想bridge · 放宽再抽】
path2 扯淡：勿复述原事；成句须自足点明本事何以接到典义；化用 anchorText。
- 再解释：${primaryLens.reinterpretation || ''}\n`
      : undefined;
  if (useNoTensionOutputForm && (corpusBridgeBlock || looseWhyBlock)) {
    bundle.maxChars = Math.min(bundle.maxChars + 20, 56);
  }
  /** 须写入【bridge】逻辑结构时略放宽 */
  if (sentenceMode === 'bridge' && corpusBridge && !corpusBridgeSubjectOnly) {
    bundle.maxChars = Math.min(Math.max(bundle.maxChars, 40), 56);
  }
  if (glossRepair) {
    bundle.maxChars = Math.min(Math.max(bundle.maxChars, 40), 56);
  }

  const genPriorDialogue = glossRepair
    ? dialogueSnippet || formatDialogueSnippet(priorTurns, 4)
    : releaseSticky
      ? formatDialogueSnippet(priorTurns.slice(-2), 2)
      : dialogueSnippet;
  const modalityPersonBlock = buildModalityPersonPromptBlock(genPriorDialogue);

  const systemPrompt = buildGeneratePrompt({
    mode: bundle.mode,
    anchorText: bundle.anchorText,
    anchorCondensed: bundle.anchorCondensed,
    anchorReinterp: bundle.anchorReinterp,
    annotationType: bundle.annotationType,
    exemplar: bundle.exemplar,
    userLens: bundle.userLens,
    userConcreteHint: metaCritique ? undefined : bundle.userConcreteHint,
    outputMode: bundle.outputMode,
    finalAttitude: bundle.finalAttitude,
    maxChars: bundle.maxChars,
    expressionBlock: bundle.expressionBlock,
    priorDialogue: genPriorDialogue,
    isRebuttal: rebuttal || consistencyChallenge,
    glossRepair: glossRepair || null,
    lastAnchorCondensed: stateForRetrieval.lastAnchorCondensed,
    isMetaCritique: metaCritique,
    isQuestionRefinement: questionRefinement || directQuestion,
    isConsistencyChallenge: consistencyChallenge,
    isSelfCultivationShift: selfCultivationShift,
    isSoftTopicShift: topicShift || followAssistantCue,
    isDirectQuestion: directQuestion,
    isFollowAssistantCue: followAssistantCue,
    isContinueTurn,
    lastConfuciusLine,
    confuciusClaims: stateForRetrieval.confuciusClaims,
    mustNotRepeat,
    openQuestion: focusQuestion,
    activeLensKey: primaryLens.key,
    forbidDriftTopics,
    usedClassicPhrases: stateForRetrieval.usedClassicPhrases,
    anchorIsContextFragile: isContextFragileEntry(entry.id),
    generationCaution: entry.generationCaution,
    userScenes,
    corpusId: entry.id,
    entrySceneDomains: entry.sceneDomains,
    entrySceneExclude: entry.sceneExclude,
    affirmationBlock,
    sternOpenerBlock,
    generalToneBlock,
    sentenceRhythmBlock,
    tailQuestionBlock,
    proactiveEvalBlock,
    corpusBridgeBlock,
    looseWhyBlock,
    sentenceMode,
    sentenceModeBlock: buildSentenceModeBlock(sentenceMode, bundle.maxChars),
    allowTailQuestion: Boolean(tailQuestionBlock),
    moodCBlock:
      cStrategyActive && cReplyMode
        ? buildMoodCPromptBlock(cReplyMode, bundle.maxChars)
        : undefined,
    restrictionBlock:
      restrictContinue === 'B6'
        ? b6GenerationBlock()
        : restrictContinue === 'B7'
          ? b7GenerationBlock()
          : restrictContinue === 'B8'
            ? b8GenerationBlock()
            : undefined,
    yesNoAnswerBlock,
    shortJudgmentBlock,
    modalityPersonBlock,
  });
  let rawText = options.onGenerateDelta
    ? await chatCompletionTextStream(
        systemPrompt,
        '请生成孔子回复。',
        options.onGenerateDelta
      )
    : await chatCompletionText(systemPrompt, '请生成孔子回复。');
  let text = polishGeneration(
    rawText,
    outputMode,
    entry,
    primaryLens,
    userInput,
    lastConfuciusLine,
    userScenes
  );
  // 抛光后与草稿不同：推一版终稿（UI 可替换）
  if (options.onGenerateDelta && text && text !== rawText.trim()) {
    options.onGenerateDelta(text);
  }

  // 未授权句首短断（是也／然／非也…）→ 剥离
  if (looksUnauthorizedShortJudgment(text, shortJudgmentAuthorized)) {
    text = stripUnauthorizedShortJudgment(text);
    debug.shortJudgmentStripped = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 人称：吾误代用户行事 → 汝
  if (looksWuAttributingUserDeed(text)) {
    text = rewriteWuUserDeedToRu(text);
    debug.wuUserDeedRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 人称：旁观转述第三人行事误作汝 → 彼／重写
  if (looksThirdPartyDeedAsRu(semanticInput, text)) {
    const det = rewriteThirdPartyRuDeedToBi(text);
    if (det !== text && !looksThirdPartyDeedAsRu(semanticInput, det)) {
      text = det;
      debug.thirdPartyRuRewritten = true;
    } else {
      rawText = await chatCompletionText(
        `${systemPrompt}

【重写·旁观人称】上稿把第三人行事写成「汝…」，已废。
用户在旁观／转述（主办人／朋友／猫咖／某人等做事）：行事主体用彼／其／专名；汝仅可表旁观者立场（汝惜／汝叹／汝闻）。**禁**汝行善／汝遭诬／汝被迫关停。`,
        '请重写：第三人行事用彼／其／专名，勿汝。'
      );
      text = polishGeneration(
        rawText,
        outputMode,
        entry,
        primaryLens,
        userInput,
        lastConfuciusLine,
        userScenes
      );
      if (looksThirdPartyDeedAsRu(semanticInput, text)) {
        text = rewriteThirdPartyRuDeedToBi(text);
      }
      debug.thirdPartyRuRewritten = true;
    }
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 物主颠倒：用户「我的X」→ 成句「X非汝所有」
  if (looksOwnershipInverted(semanticInput, text)) {
    rawText = await chatCompletionText(
      `${systemPrompt}

【重写·物主颠倒】上稿把用户所有物说成「非汝所有」，已废。
用户称「我的…」被他人擅用／侵占时：物属汝，责彼方越界即可；**禁**「洗发水非汝所有」一类反宾为主。`,
      '请重写：物属用户，责擅用方。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    debug.ownershipInvertedRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 模态：上文「若Ｘ」被「虽Ｘ」说成已然 → 重写
  if (looksSuiFramingPriorHypothetical(text, genPriorDialogue || '')) {
    rawText = await chatCompletionText(
      `${systemPrompt}

【重写·假设误作已然】上稿用「虽」把上文「若／万一」之假设说成已发生（如彼虽翻脸←他若翻脸），已废。
须重写：同一事保持未然（若／如／设／或其或）；评用户礼数用汝／尔，禁吾节文。
例型：温和陈之，若彼翻脸，或由汝节文未周。`,
      '请重写：假设保持未然，人称用汝。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    if (looksWuAttributingUserDeed(text)) text = rewriteWuUserDeedToRu(text);
    debug.suiHypotheticalRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 成句崩坏（数字/【】/字间空格乱拼等）→ 重写一次；仍坏则回退 condensed
  if (looksGarbledConfuciusReply(text)) {
    rawText = await chatCompletionText(
      `${systemPrompt}

【重写·成句崩坏】上稿不可读（含数字碎片、提示符【】、字间乱空格、符号堆叠，或**成句截断**如短答后只抛人名／起典半截「未可也。孟懿子」），已废。
须重写为**一行完整可读半文言**：嵌 anchor 核心义，禁输出【】与阿拉伯数字，禁字与字之间插空格，禁话说一半。`,
      '请重写为一行完整可读的孔子回复。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    if (looksGarbledConfuciusReply(text)) {
      text = distantCautiousFallback(entry, primaryLens);
    }
    debug.garbledRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 白话渗漏／过长无逗／原典粘连 → 重写一次
  {
    const vr = looksVernacularOrRunOnConfuciusReply(text);
    const classicGlue = looksClassicCommaCollapsed(text, entry);
    const telegram = looksCompressedTelegramConfuciusReply(text, entry, outputMode);
    if (vr.hit || classicGlue || telegram.hit) {
      const reasons = [...vr.reasons, ...telegram.reasons];
      if (classicGlue) reasons.push('原典粘连');
      rawText = await chatCompletionText(
        `${systemPrompt}

【重写·白话／断句／原典粘连／缩句】上稿半文言不纯、未断句、原典粘连或把原文压成标签，已废。违例：${reasons.join('；')}
须重写为一行**半文言**：嵌 **anchorText 连续片段**（嵌典照录：开引后字与标点照录；可短可长，不必两逗号整截）；禁「丘辨纯俭从众／子夏悟绘事后素」标题压缩；宁用满字数，勿为短而缩。善用逗号拆短句；禁「的」（改「之」或改写）；禁「X式Y」；禁「自然规律／因为／所以／这个」等白话复合词；专名（如猫咖）可留。`,
        '请重写：嵌原文连续片段（照录）、半文言、逗号断句、无缩句标签。'
      );
      text = polishGeneration(
        rawText,
        outputMode,
        entry,
        primaryLens,
        userInput,
        lastConfuciusLine,
        userScenes
      );
      if (vr.hit) debug.vernacularRunOnRewritten = true;
      if (classicGlue) debug.classicCommaCollapsedRewritten = true;
      if (telegram.hit) debug.compressedTelegramRewritten = true;
      if (options.onGenerateDelta && text) options.onGenerateDelta(text);
    }
  }

  // 短桥有让步／转折而成句丢掉 → 重写一次（对仗可让，逻辑词须留）
  {
    const condensedForBridgeLogic = turnFocus.condensed || extract.condensed;
    if (
      sentenceMode === 'bridge' &&
      looksDroppedBridgeLogic({
        reply: text,
        bridge: corpusBridge,
        condensed: condensedForBridgeLogic,
      })
    ) {
      rawText = await chatCompletionText(
        `${systemPrompt}

【重写·让步／转折】上稿丢掉短桥让步或转折，已废；须保留逻辑词，对仗可让。
短桥或问旨已点明让步（虽…仍／虽…然／然…犹／认同…仍）或转折（但／却／而／可是／非…乃…／不是…而是…／一边…另一边…／理智…情感）一类张力；成句禁压成无张力并列对仗。
须重写一行半文言：保留虽／然／而／却／犹／仍／非…乃等让步或转折表面词，再接典义。
【bridge】：${corpusBridge || ''}`,
        '请重写：保留让步／转折逻辑词，对仗可让。'
      );
      text = polishGeneration(
        rawText,
        outputMode,
        entry,
        primaryLens,
        userInput,
        lastConfuciusLine,
        userScenes
      );
      // 旗名沿用；含让步与转折
      debug.concessiveLogicRewritten = true;
      if (options.onGenerateDelta && text) options.onGenerateDelta(text);
    }
  }

  // 成句对照裁决【bridge】三件套：用户极 + 典极 + 关系
  if (
    shouldCheckBridgeReflect({
      corpusBridge,
      corpusBridgeSubjectOnly,
      sentenceMode,
    })
  ) {
    let reflect = await checkBridgeReflection({
      reply: text,
      bridge: corpusBridge!,
      userInput: semanticInput,
      condensed: turnFocus.condensed || extract.condensed,
      anchorText: entry?.text,
    });
    debug.bridgeReflect = {
      hasUserPole: reflect.hasUserPole,
      hasCorpusPole: reflect.hasCorpusPole,
      hasRelation: reflect.hasRelation,
      missing: reflect.missing,
    };
    if (!reflect.ok) {
      const orderRewriteHint = entry.exemplar?.label
        ? `**典例须在先**；嵌 anchorText 原文；其后用户侧极与两边关系可换；禁碎压、禁用户／论断在前甩尾`
        : `三者顺序可换`;
      rawText = await chatCompletionText(
        `${systemPrompt}

【重写·成句bridge三件套不全】上稿未完整体现裁决【bridge】，已废。
缺：${reflect.missing || '用户侧极／典侧极／两边关系'}
补写提示：${reflect.hint || '须同时写出用户侧极、典侧极，以及两边何以相接的关系'}
对照【bridge】重写一行半文言：**用户侧极 + 典侧极 + 两边关系**（${orderRewriteHint}，缺一不可）。
硬：须答用户所问那一极——禁只复述典正面；若 bridge 已有因果／同构，可轻翻落到用户问点。
关系须可读，禁只并置、禁空断。
【bridge】：${corpusBridge}`,
        '请重写：答用户问点，三件套齐全。'
      );
      text = polishGeneration(
        rawText,
        outputMode,
        entry,
        primaryLens,
        userInput,
        lastConfuciusLine,
        userScenes
      );
      debug.bridgeReflectRewritten = true;
      reflect = await checkBridgeReflection({
        reply: text,
        bridge: corpusBridge!,
        userInput: semanticInput,
        condensed: turnFocus.condensed || extract.condensed,
        anchorText: entry?.text,
      });
      debug.bridgeReflect = {
        hasUserPole: reflect.hasUserPole,
        hasCorpusPole: reflect.hasCorpusPole,
        hasRelation: reflect.hasRelation,
        missing: reflect.missing,
      };
      if (!reflect.ok) debug.bridgeReflectFailed = true;
      if (options.onGenerateDelta && text) options.onGenerateDelta(text);
    }
  }

  // exemplar：用户／论断在前，经犹／正若／亦／如甩到典名 → 重写一次
  if (looksExemplarTailSling(text, entry.exemplar?.label)) {
    const lab = entry.exemplar!.label;
    rawText = await chatCompletionText(
      `${systemPrompt}

【重写·典例甩尾】上稿用户／论断在前、典例经犹／正若／亦／如甩尾（如「…犹${lab}」），已废。
有具体例子时：**典例须在先**；嵌 anchorText 原文；其后用户侧极与两边关系二者可换；禁碎压、禁典例甩尾。`,
      '请重写：典例在先，再说用户与关系。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    debug.exemplarOrderRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 误读纠偏：未认听偏（无认池 + 无「非 wrongAs」）→ 强制重写
  if (glossRepair && !acknowledgesGlossRepair(text, glossRepair)) {
    const surface = glossRepairSurfaceHint(glossRepair);
    rawText = await chatCompletionText(
      `${systemPrompt}

【重写·误读纠偏未认听偏】上稿未承认听偏（缺认池起句/嵌句，或未显式写「非${glossRepair.wrongAs}」）。已废。
须重写，**缺一不可**：
1. 用认池（是也／汝之言然／可也等）
2. 写出「${glossRepair.term}非${glossRepair.wrongAs}」或「非${glossRepair.wrongAs}，乃…」
3. 再可轻嵌 anchor；禁只谈典义不认听偏
例型（可润色，不可删认听偏）：${surface}`,
      '请重写：先认听偏再接典。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    debug.glossRepairRewritten = true;
  }

  // C 轮若又收成讲义／大道理，或把未死亲友写成逝者，强制改写并收束在情上。
  if (cStrategyActive && looksCLectureLanding(text, semanticInput)) {
    rawText = await chatCompletionText(
      `${systemPrompt}

【重写·C 收束未落在情上】上稿把伤痛讲成大道理，或把活人写成逝者，已废。
须重写一行半文言：先肯定本轮感受，或对眼下之酷／空／惧发一声叹；可轻嵌合适 anchor，但结尾必须仍在人情上。
禁：道体恒运、天道之常、离散乃归正途、此离非过、此心可安、体认流转、假“我懂你”。亲疾未死禁逝者如斯／不舍昼夜。`,
      '请重写：收束在眼前之情，不讲大道理。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    debug.cEmpathyRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 表达权限：finalAttitude<3 禁直谏／直指骂辞（与 attitudes expressionConstraints 同一条）
  {
    let expr = violatesExpressionConstraints(text, finalAttitude);
    if (expr.violated) {
      rawText = await chatCompletionText(
        `${systemPrompt}

【重写·表达权限】上稿违反最终态度=${finalAttitude} 之表达约束，已废。
违例：${expr.reasons.join('；')}
须重写：可否定行为、间接述思或举古例；禁「君子当/宜/应」「汝当/尔当」「当自省」「当反求」等直接训诫用户行事；禁「小人」「恶」直指用户。`,
        '请重写：勿直谏训诫。'
      );
      text = polishGeneration(
        rawText,
        outputMode,
        entry,
        primaryLens,
        userInput,
        lastConfuciusLine,
        userScenes
      );
      debug.expressionConstraintRewritten = true;
      expr = violatesExpressionConstraints(text, finalAttitude);
      if (expr.violated) debug.expressionConstraintFailed = true;
      if (options.onGenerateDelta && text) options.onGenerateDelta(text);
    }
  }

  // 是否问（软）收束：bridge／表达重写后，仅剥「适度／视情况」主句上误加的短断（不补前缀）
  if (yesNoQuestion) {
    const aligned = alignYesNoShortAnswer(text);
    if (aligned.changed) {
      text = aligned.text;
      debug.yesNoForced = true;
      if (options.onGenerateDelta && text) options.onGenerateDelta(text);
    }
  }

  // 未授权句尾提问：剥掉主句擅自所问（非 20% roll / 强制尾问系统）
  if (!tailQuestionBlock && replyLooksLikeTailQuestion(text, entry.text)) {
    text = stripUnauthorizedQuestions(text, entry.text);
    debug.strippedUnauthorizedQuestion = true;
    if (replyLooksLikeTailQuestion(text, entry.text)) {
      rawText = await chatCompletionText(
        `${systemPrompt}

【重写·禁擅自提问】上稿在未授权句尾提问时仍发问，已废。重写为**纯陈述**一行，禁乎/耶/？。`,
        '请重写为陈述句。'
      );
      text = polishGeneration(
        rawText,
        outputMode,
        entry,
        primaryLens,
        userInput,
        lastConfuciusLine,
        userScenes
      );
      text = stripUnauthorizedQuestions(text, entry.text);
    }
  }

  // 主强制：成句↔输入近复述且本轮无授权尾问 → 走系统尾问重写（须带问）
  // 主动提问评价：永不补问
  if (
    outputMode === 'normal' &&
    !metaCritique &&
    !isProactiveEval &&
    isNearRestatementOutputToInput({
      userInput: semanticInput,
      userCondensed: turnFocus.condensed || extract.condensed,
      output: text,
    }) &&
    !replyLooksLikeTailQuestion(text, entry.text)
  ) {
    const retryNear = `${systemPrompt}

【重写·近复述】上稿与用户输入大差不差。须重写：断语勿复述用户；本轮授权句尾一问——断语「。」后另起实质问（？）。`;
    // 近复述补问：临时放开提问权限说明
    rawText = await chatCompletionText(
      retryNear.replace(
        /本轮\*\*未\*\*授权句尾提问[\s\S]*?勿把原典「亦足以发」等收成「…乎？」。/,
        '本轮补授权句尾一问：断语「。」后仅一句可问。'
      ),
      '请重写并加句尾一问。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    debug.forceOutputInputTail = true;
    if (replyLooksLikeTailQuestion(text, entry.text) && !tailQuestionKind) {
      tailQuestionKind = 'topic_shift';
      debug.tailQuestionKind = 'topic_shift';
    }
  }

  if (options.onGenerateDelta && text) {
    options.onGenerateDelta(text);
  }

  // 后验重写后物主仍可能颠倒
  if (looksOwnershipInverted(semanticInput, text)) {
    rawText = await chatCompletionText(
      `${systemPrompt}

【重写·物主颠倒】上稿把用户所有物说成「非汝所有」，已废。
用户称「我的…」被他人擅用时：物属汝，责彼方越界；禁反宾为主。`,
      '请重写：物属用户，责擅用方。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    debug.ownershipInvertedRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 后验重写后旁观人称仍可能误汝
  if (looksThirdPartyDeedAsRu(semanticInput, text)) {
    const det = rewriteThirdPartyRuDeedToBi(text);
    if (det !== text && !looksThirdPartyDeedAsRu(semanticInput, det)) {
      text = det;
    } else {
      rawText = await chatCompletionText(
        `${systemPrompt}

【重写·旁观人称】上稿把第三人行事写成「汝…」，已废。
行事主体用彼／其／专名；汝仅可汝惜／汝叹／汝闻。禁汝行善／汝遭诬。`,
        '请重写：第三人行事勿汝。'
      );
      text = polishGeneration(
        rawText,
        outputMode,
        entry,
        primaryLens,
        userInput,
        lastConfuciusLine,
        userScenes
      );
      if (looksThirdPartyDeedAsRu(semanticInput, text)) {
        text = rewriteThirdPartyRuDeedToBi(text);
      }
    }
    debug.thirdPartyRuRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 后验重写后仍可能截断／崩坏 → 再打回一次（与前置 garbled 同规）
  if (looksGarbledConfuciusReply(text)) {
    rawText = await chatCompletionText(
      `${systemPrompt}

【重写·成句崩坏】上稿不可读或成句截断（如短答后只抛人名半截），已废。
须重写为**一行完整可读半文言**：嵌 anchor 核心义，禁【】与阿拉伯数字，禁话说一半。`,
      '请重写为一行完整可读的孔子回复。'
    );
    text = polishGeneration(
      rawText,
      outputMode,
      entry,
      primaryLens,
      userInput,
      lastConfuciusLine,
      userScenes
    );
    if (looksGarbledConfuciusReply(text)) {
      text = distantCautiousFallback(entry, primaryLens);
    }
    debug.garbledRewritten = true;
    if (options.onGenerateDelta && text) options.onGenerateDelta(text);
  }

  // 后验白话／断句／原典粘连再检一次（bridge／表达重写可能又渗入）
  {
    const vr = looksVernacularOrRunOnConfuciusReply(text);
    const classicGlue = looksClassicCommaCollapsed(text, entry);
    const telegram = looksCompressedTelegramConfuciusReply(text, entry, outputMode);
    if (vr.hit || classicGlue || telegram.hit) {
      const reasons = [...vr.reasons, ...telegram.reasons];
      if (classicGlue) reasons.push('原典粘连');
      rawText = await chatCompletionText(
        `${systemPrompt}

【重写·白话／断句／原典粘连／缩句】上稿半文言不纯、未断句、原典粘连或把原文压成标签，已废。违例：${reasons.join('；')}
须重写为一行**半文言**：嵌 **anchorText 连续片段**（嵌典照录：开引后字与标点照录；可短可长，不必两逗号整截）；禁「丘辨纯俭从众／子夏悟绘事后素」标题压缩；宁用满字数，勿为短而缩。善用逗号拆短句；禁「的」（改「之」或改写）；禁「X式Y」；禁「自然规律／因为／所以／这个」等白话复合词；专名（如猫咖）可留。`,
        '请重写：嵌原文连续片段（照录）、半文言、逗号断句、无缩句标签。'
      );
      text = polishGeneration(
        rawText,
        outputMode,
        entry,
        primaryLens,
        userInput,
        lastConfuciusLine,
        userScenes
      );
      if (vr.hit) debug.vernacularRunOnRewritten = true;
      if (classicGlue) debug.classicCommaCollapsedRewritten = true;
      if (telegram.hit) debug.compressedTelegramRewritten = true;
      if (options.onGenerateDelta && text) options.onGenerateDelta(text);
    }
  }

  return finish({
    text,
    outputMode,
    debug,
    longTermState,
    recentMessages,
  });
}

export { createInitialLongTermState, createInitialDialogueState };
