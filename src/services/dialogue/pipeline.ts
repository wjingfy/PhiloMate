import { resolveAttitudeByReinterpCompare } from '../confucius/attitudeCompare';
import { maxCharsForMode, resolveOutputMode } from '../confucius/outputMode';
import { pickDistantCautiousText } from '../shared/distantCautious';
import { attitudeLinkedFavorabilityDelta } from '../shared/turnFavorability';
import { applyFavorabilityGain, applyFavorabilityLoss } from '../snacks/favorability';
import { maybeApplyLongTermTrigger, type WindowUserMessage } from '../../utils/confuciusLongTermTrigger';
import { resolveLongTermAttitude } from '../../utils/confuciusLongTermAttitude';
import type { ConversationState, PhilosopherId, PipelineDebugView, PipelineResponse, RoleData } from '../../types';
import { detectSensitive, recordSensitiveBucket } from './sensitive';
import { generateReply, trimByChars } from './generator';
import { retrieveCorpus } from './retrieval';
import type { DialogueState } from '../confucius/dialogueState';
import type { DialogueTurn } from '../confucius/dialogueLensGuard';
import type { CorpusEntry as ConfuciusCorpusEntry } from '../confucius/types';
import {
  advanceSocratesDialogueState,
  generateSocratesHarnessReply,
  prepareSocratesTurnPlan,
  resolveSocratesMaxChars,
} from '../socrates/harness';
import { resolveWangYangmingMaxChars } from '../wangyangming/harness';
import {
  adjustFoucaultEmpathyRetrieval,
  composeFoucaultCrisisLeadIn,
  isFoucaultEmpathyInput,
} from '../foucault/harness';
import type { PendingFoucaultQuestion } from '../foucault/questionEvaluation';

function evidenceMeta(philosopherId: PhilosopherId, entry: RoleData['corpus'][number] | undefined) {
  if (!entry) return {};
  const work = philosopherId === 'confucius' ? '《论语》' : philosopherId === 'socrates' ? '苏格拉底审核语料' : philosopherId === 'wangyangming' ? '王阳明审核语料' : '福柯审核语料';
  const chapter = [entry.chapterName, entry.chapter !== undefined ? `第${entry.chapter}篇` : ''].filter(Boolean).join(' · ');
  return { evidenceSource: work, evidenceChapter: chapter || entry.source || '' };
}

function panelFor(data: RoleData, kind: 'help' | 'ban'): PipelineResponse['panel'] {
  if (kind === 'help') {
    const body = data.sensitive.ui?.helpPanel?.body?.filter((line): line is string => typeof line === 'string') ?? [];
    return { kind, lines: body.length ? body : ['请尽快联系可信任的人和当地专业援助。'] };
  }
  const raw = data.sensitive.ui?.genericBanPanel?.text ?? `和${data.nameplate.displayName}聊点别的吧`;
  return { kind, lines: [raw.replace('{philosopherName}', data.nameplate.displayName)] };
}

function earlyDebug(bucket: string, state: ConversationState): PipelineDebugView {
  return {
    path: 'path2',
    condensed: '',
    primaryLens: null,
    corpusId: null,
    corpusText: '',
    baseAttitude: 1,
    currentAttitude: 1,
    finalAttitude: 1,
    longTermStack: state.longTerm.longTermStack,
    cumulative: 1 + state.longTerm.longTermStack,
    outputMode: 'panel',
    attitudeReason: '敏感分流面板不进入对话历史',
    sensitiveBucket: bucket,
    triggeredLongTerm: false,
    modelUsed: false,
    replySource: 'local',
    favorabilityDelta: 0,
  };
}

async function runCompleteConfucius(params: {
  userInput: string;
  data: RoleData;
  state: ConversationState;
  dialogueTurns: DialogueTurn[];
}): Promise<PipelineResponse> {
  const [{ runConfuciusPipeline }, { configureCorpusEntries }] = await Promise.all([
    import('../confucius/select_confucius'),
    import('../confucius/corpus'),
  ]);
  configureCorpusEntries(params.data.corpus as unknown as ConfuciusCorpusEntry[]);
  const result = await runConfuciusPipeline({
    userInput: params.userInput,
    longTermState: params.state.longTerm,
    recentMessages: params.state.recentMessages,
    dialogueTurns: params.dialogueTurns,
    dialogueState: params.state.roleRuntime?.confuciusDialogueState as DialogueState | undefined,
  });
  const debug = result.debug;
  const favorability = attitudeLinkedFavorabilityDelta({
    currentAttitude: debug.currentAttitude,
    longTermStack: debug.longTermStack,
    triggeredLongTerm: debug.triggeredLongTerm,
    countFavorability: !debug.uiPanel && result.text !== null,
  });
  if (favorability.net > 0) applyFavorabilityGain('confucius', favorability.net);
  if (favorability.net < 0) applyFavorabilityLoss('confucius', Math.abs(favorability.net));

  const nextState: ConversationState = {
    ...params.state,
    longTerm: result.longTermState,
    recentMessages: result.recentMessages,
    usedCorpusIds: debug.corpusId
      ? [...params.state.usedCorpusIds.filter((id) => id !== debug.corpusId), debug.corpusId].slice(-80)
      : params.state.usedCorpusIds,
    cStickyRemaining: result.dialogueState.cModeStickyRemaining ?? 0,
    roleRuntime: {
      ...params.state.roleRuntime,
      confuciusDialogueState: result.dialogueState,
    },
  };
  const bucket = debug.moodTier ?? 'D';
  const panel = debug.uiPanel ? panelFor(params.data, debug.uiPanel) : null;
  const attitudeReason = [
    debug.reinterpFit,
    debug.stanceRelation,
    debug.attitudeInverted ? '态度反向' : '',
    debug.attitudeSoftened ? '态度软化' : '',
  ].filter(Boolean).join('｜') || '完整孔子管线裁决';
  const evidence = evidenceMeta('confucius', params.data.corpus.find((entry) => entry.id === debug.corpusId));

  return {
    text: panel ? null : result.text,
    panel,
    state: nextState,
    debug: {
      path: debug.path,
      condensed: debug.condensed,
      primaryLens: debug.primaryLens,
      corpusId: debug.corpusId || null,
      corpusText: debug.corpusText,
      ...evidence,
      baseAttitude: debug.baseAttitude ?? debug.currentAttitude,
      currentAttitude: debug.currentAttitude,
      finalAttitude: debug.finalAttitude,
      longTermStack: debug.longTermStack,
      cumulative: debug.currentAttitude + debug.longTermStack,
      outputMode: debug.outputMode,
      attitudeReason,
      sensitiveBucket: bucket,
      triggeredLongTerm: debug.triggeredLongTerm,
      modelUsed: true,
      replySource: panel || ['animation_only', 'ellipsis', 'distant_cautious'].includes(debug.outputMode)
        ? 'local'
        : 'model',
      favorabilityDelta: favorability.net,
    },
  };
}

async function runCompleteFoucault(params: {
  userInput: string;
  data: RoleData;
  state: ConversationState;
  dialogueTurns: DialogueTurn[];
  pendingQuestion?: PendingFoucaultQuestion;
}): Promise<PipelineResponse> {
  const [{ runFoucaultPipeline }, dialogueStateModule, corpusModule] = await Promise.all([
    import('../foucault/v3/index'),
    import('../foucault/v3/dialogueState'),
    import('../foucault/v3/corpus'),
  ]);
  const conversationId = 'philomate-integrated-foucault';
  const previousRuntime = (params.state.roleRuntime?.foucaultDialogueState ?? {}) as Record<string, unknown>;
  const previousStack = typeof previousRuntime.longTermStack === 'number' ? previousRuntime.longTermStack : 0;
  dialogueStateModule.setDialogueState(conversationId, previousRuntime);
  const history = params.dialogueTurns.map((turn, index) => ({
    id: `foucault-v3-history-${index}`,
    role: turn.role,
    content: turn.content,
    at: '',
  }));
  const result = await runFoucaultPipeline({
    conversationId,
    userInput: params.userInput,
    history,
    pendingQuestion: params.pendingQuestion,
  });
  const runtime = dialogueStateModule.getDialogueState(conversationId);
  const entry = result.debug.corpusId ? corpusModule.getEntryById(result.debug.corpusId) : null;
  const currentAttitude = result.debug.currentAttitude ?? result.attitude ?? 1;
  const finalAttitude = result.debug.finalAttitude ?? currentAttitude;
  const triggeredLongTerm = runtime.longTermStack > previousStack;
  const panel = result.uiPanel ? panelFor(params.data, result.uiPanel) : null;
  const text = panel || !result.reply ? null : result.reply;
  const favorability = attitudeLinkedFavorabilityDelta({
    currentAttitude,
    longTermStack: runtime.longTermStack,
    triggeredLongTerm,
    countFavorability: !panel && text !== null,
  });
  if (favorability.net > 0) applyFavorabilityGain('foucault', favorability.net);
  if (favorability.net < 0) applyFavorabilityLoss('foucault', Math.abs(favorability.net));

  const primaryLens = result.debug.primaryLens ?? null;
  const recentMessages = panel ? params.state.recentMessages : [
    ...params.state.recentMessages,
    {
      text: params.userInput,
      path: result.debug.path ?? 'path2',
      themes: primaryLens?.kind === 'theme' ? [primaryLens.key] : [],
      categories: primaryLens?.kind === 'category' ? [primaryLens.key] : [],
      condensed: result.debug.userCondensed ?? '',
      currentAttitude,
      at: new Date().toISOString(),
    },
  ].slice(-10);
  const stackChanged = runtime.longTermStack !== params.state.longTerm.longTermStack;
  const nextState: ConversationState = {
    ...params.state,
    longTerm: {
      longTermStack: runtime.longTermStack,
      consecutiveMildCount: runtime.calmStreak,
      lastStackChangeAt: stackChanged ? new Date().toISOString() : params.state.longTerm.lastStackChangeAt,
    },
    recentMessages,
    usedCorpusIds: runtime.usedCorpusIds.slice(-80),
    cStickyRemaining: runtime.cModeStickyRemaining,
    roleRuntime: {
      ...params.state.roleRuntime,
      foucaultDialogueState: { ...runtime },
    },
  };
  const note = result.debug.note ?? '福柯 3.0 专属管线';
  const obviouslyLocal = /硬红线|定稿|应酬语|敏感累积|仅动画/.test(note)
    || ['animation_only', 'ellipsis', 'distant_cautious'].includes(result.debug.outputMode ?? '');
  const evidence = evidenceMeta('foucault', entry as RoleData['corpus'][number] | undefined);

  return {
    text,
    panel,
    state: nextState,
    debug: {
      path: result.debug.path ?? 'path2',
      condensed: result.debug.userCondensed ?? '',
      primaryLens,
      corpusId: result.debug.corpusId ?? null,
      corpusText: entry?.text ?? '',
      corpusBridge: result.debug.corpusBridge,
      lensSource: result.debug.lensSource,
      ...evidence,
      baseAttitude: result.debug.baseAttitude ?? currentAttitude,
      currentAttitude,
      finalAttitude,
      longTermStack: runtime.longTermStack,
      cumulative: finalAttitude + runtime.longTermStack,
      outputMode: result.debug.outputMode ?? (panel ? 'panel' : 'normal'),
      attitudeReason: [note, result.debug.reinterpFit, result.debug.stanceRelation].filter(Boolean).join('｜'),
      sensitiveBucket: result.debug.bucket ?? result.debug.moodTier ?? 'D',
      triggeredLongTerm,
      modelUsed: !obviouslyLocal,
      replySource: obviouslyLocal ? 'local' : 'model',
      favorabilityDelta: favorability.net,
      questionPending: result.debug.questionPending,
    },
  };
}

export async function runDialoguePipeline(params: {
  philosopherId: PhilosopherId;
  userInput: string;
  data: RoleData;
  state: ConversationState;
  dialogueTurns?: DialogueTurn[];
  preferCompleteConfucius?: boolean;
  preferCompleteFoucault?: boolean;
  pendingFoucaultQuestion?: PendingFoucaultQuestion;
}): Promise<PipelineResponse> {
  const { philosopherId, userInput, data } = params;
  let state = params.state;
  if (philosopherId === 'confucius' && params.preferCompleteConfucius) {
    try {
      return await runCompleteConfucius({
        userInput,
        data,
        state,
        dialogueTurns: params.dialogueTurns ?? [],
      });
    } catch (error) {
      console.warn('[Confucius complete pipeline fallback]', error);
    }
  }
  if (philosopherId === 'foucault' && params.preferCompleteFoucault) {
    try {
      return await runCompleteFoucault({
        userInput,
        data,
        state,
        dialogueTurns: params.dialogueTurns ?? [],
        pendingQuestion: params.pendingFoucaultQuestion,
      });
    } catch (error) {
      console.warn('[Foucault v3 complete pipeline fallback]', error);
    }
  }
  const sensitive = detectSensitive(userInput, data, state);
  state = recordSensitiveBucket(state, sensitive.bucket);

  if (sensitive.panel) {
    return {
      text: null,
      panel: panelFor(data, sensitive.panel),
      state,
      debug: earlyDebug(sensitive.bucket, state),
    };
  }

  const priorTurns = params.dialogueTurns ?? [];
  const socratesPlan = philosopherId === 'socrates'
    ? await prepareSocratesTurnPlan({
      userInput,
      priorTurns,
      state,
      data,
      excludedIds: state.usedCorpusIds,
    })
    : null;
  let retrieval = socratesPlan?.retrieval ?? retrieveCorpus(userInput, data, state.usedCorpusIds);
  const foucaultEmpathy = philosopherId === 'foucault' && isFoucaultEmpathyInput(userInput);
  if (foucaultEmpathy && !socratesPlan) {
    retrieval = adjustFoucaultEmpathyRetrieval(userInput, data, retrieval);
  }
  let baseAttitude = 1;
  let currentAttitude = sensitive.currentAttitude ?? 1;
  let attitudeReason = sensitive.currentAttitude == null ? '' : `敏感分流 ${sensitive.bucket} 固定档`;
  let attitudeViaModel = retrieval.selectionSource === 'model';

  if (socratesPlan && !retrieval.entry && sensitive.currentAttitude == null) {
    baseAttitude = 1;
    currentAttitude = 1;
    attitudeReason = '苏格拉底无强语料匹配，保持温和而不随机套典';
  } else if (sensitive.currentAttitude == null || sensitive.bucket === 'C') {
    const resolved = await resolveAttitudeByReinterpCompare({
      frame: retrieval.frame as never,
      userReinterp: retrieval.primaryLens?.reinterpretation ?? retrieval.condensed,
      userCondensed: retrieval.condensed,
      corpusCondensed: retrieval.entry?.condensed ?? '',
      corpusTemperament: retrieval.corpusTemperament,
      speechAct: retrieval.speechAct,
      philosopherId,
    });
    baseAttitude = resolved.baseAttitude;
    currentAttitude = sensitive.bucket === 'C' ? Math.min(1, resolved.attitude) : resolved.attitude;
    attitudeReason = sensitive.bucket === 'C' ? `${resolved.reason}｜C类≤1` : resolved.reason;
    attitudeViaModel = resolved.compare.viaModel;
  } else {
    const rawLevel = retrieval.frame?.attitudeLevel;
    baseAttitude = typeof rawLevel === 'number' ? rawLevel : currentAttitude;
  }
  if (foucaultEmpathy) {
    currentAttitude = Math.min(1, currentAttitude);
    attitudeReason = `${attitudeReason || '福柯共情轮'}｜共情≤1`;
  }

  const windowMessage: WindowUserMessage = {
    text: userInput,
    path: retrieval.path,
    themes: retrieval.primaryLens?.kind === 'theme' ? [retrieval.primaryLens.key] : [],
    categories: retrieval.primaryLens?.kind === 'category' ? [retrieval.primaryLens.key] : [],
    condensed: retrieval.condensed,
    currentAttitude,
    at: new Date().toISOString(),
  };
  const recentMessages = [...state.recentMessages, windowMessage].slice(-10);
  const trigger = maybeApplyLongTermTrigger(state.longTerm, recentMessages);
  const longTerm = resolveLongTermAttitude({ currentAttitude, state: trigger.state });
  const outputMode = resolveOutputMode(
    currentAttitude,
    trigger.state.longTermStack,
    longTerm.cumulative,
    longTerm.mode,
  );
  let maxChars = maxCharsForMode(outputMode);
  if (socratesPlan && outputMode === 'normal') {
    maxChars = resolveSocratesMaxChars(socratesPlan, longTerm.finalAttitude);
  }
  const cStrategy = sensitive.bucket === 'C' || state.cStickyRemaining > 0 || foucaultEmpathy;
  if (philosopherId === 'wangyangming' && outputMode === 'normal') {
    maxChars = resolveWangYangmingMaxChars({
      baseMaxChars: 65,
      cStrategy,
      retrieval,
      userInput,
    });
  }
  const nextSticky = sensitive.bucket === 'C' ? 3 : Math.max(0, state.cStickyRemaining - 1);

  let text: string | null;
  let modelUsed = attitudeViaModel;
  let replySource: PipelineDebugView['replySource'] = 'local';
  let genError: string | undefined;
  if (outputMode === 'animation_only') {
    text = null;
  } else if (outputMode === 'ellipsis') {
    text = '……';
  } else if (outputMode === 'distant_cautious') {
    text = pickDistantCautiousText(data.distantCautious) ?? '……';
  } else if (sensitive.fixedReply) {
    if (philosopherId === 'foucault' && (sensitive.bucket === 'B1' || sensitive.bucket === 'B2')) {
      const leadIn = await composeFoucaultCrisisLeadIn(userInput, priorTurns);
      text = leadIn ? `${leadIn}${sensitive.fixedReply}` : sensitive.fixedReply;
    } else {
      text = trimByChars(sensitive.fixedReply, maxChars);
    }
  } else if (socratesPlan) {
    const generated = await generateSocratesHarnessReply({
      userInput,
      priorTurns,
      data,
      state,
      plan: socratesPlan,
      attitude: longTerm.finalAttitude,
      maxChars,
      cStrategy,
    });
    text = generated.text;
    modelUsed ||= generated.modelUsed;
    replySource = generated.modelUsed ? 'model' : 'offline';
  } else {
    const generated = await generateReply({
      philosopherId,
      userInput,
      data,
      retrieval,
      attitude: longTerm.finalAttitude,
      maxChars,
      cStrategy,
    });
    text = generated.text;
    modelUsed ||= generated.modelUsed;
    replySource = generated.modelUsed ? 'model' : 'offline';
    genError = generated.error;
  }

  const favorability = attitudeLinkedFavorabilityDelta({
    currentAttitude,
    longTermStack: trigger.state.longTermStack,
    triggeredLongTerm: trigger.triggered,
    countFavorability: sensitive.countFavorability && text !== null,
  });
  if (favorability.net > 0) applyFavorabilityGain(philosopherId, favorability.net);
  if (favorability.net < 0) applyFavorabilityLoss(philosopherId, Math.abs(favorability.net));

  const socratesDialogueState = socratesPlan
    ? advanceSocratesDialogueState(state.roleRuntime?.socratesDialogueState, socratesPlan, text)
    : undefined;
  state = {
    ...state,
    longTerm: longTerm.nextState,
    recentMessages,
    usedCorpusIds: retrieval.entry
      ? [...state.usedCorpusIds.filter((id) => id !== retrieval.entry!.id), retrieval.entry.id].slice(-80)
      : state.usedCorpusIds,
    cStickyRemaining: nextSticky,
    roleRuntime: socratesPlan ? {
      ...state.roleRuntime,
      socratesDialogueState,
    } : state.roleRuntime,
  };

  return {
    text,
    panel: null,
    state,
    debug: {
      path: retrieval.path,
      condensed: retrieval.condensed,
      primaryLens: retrieval.primaryLens,
      corpusId: retrieval.entry?.id ?? null,
      corpusText: retrieval.entry?.text ?? '',
      corpusBridge: retrieval.corpusBridge,
      lenses: retrieval.lenses,
      lensSource: retrieval.lensSource,
      selectionSource: retrieval.selectionSource,
      hasTension: retrieval.hasTension,
      candidateCount: retrieval.candidateCount,
      selectionReason: retrieval.selectionReason,
      dialogueMove: socratesPlan?.dialecticMove ?? retrieval.dialogueMove,
      targetClaim: retrieval.targetClaim,
      questionFocus: retrieval.questionFocus,
      newContribution: retrieval.newContribution,
      ...evidenceMeta(philosopherId, retrieval.entry ?? undefined),
      baseAttitude,
      currentAttitude,
      finalAttitude: longTerm.finalAttitude,
      longTermStack: trigger.state.longTermStack,
      cumulative: longTerm.cumulative,
      outputMode,
      attitudeReason,
      sensitiveBucket: sensitive.bucket,
      triggeredLongTerm: trigger.triggered,
      modelUsed,
      replySource,
      favorabilityDelta: favorability.net,
      genError,
    },
  };
}
