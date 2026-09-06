/**
 * runFoucaultPipeline —— 福柯对话管线总编排
 * 顺序与 03-corpus-to-output-logic.md §1 一致：
 *   mood → 粘滞 → 硬退出(A8/B1/B2) → B3–B11 → 选典(02) → 比照态度/alignment
 *   → stack → outputMode 短路 → bundle → 成句 → 写回状态
 */
import { selectCorpus, preprocessInput, isPhaticInput } from './pipeline';
import { detectMood, HELP_PANEL_TEXT, banPanelText, SUICIDE_LINE_1, SUICIDE_LINE_2, SUICIDE_LINE_3, pickBLine, GROUP_JIA } from './moodDetect';
import { compareReinterpretation, mapAttitudeFromCompare, resolveAlignment, modeOfAlignment } from './attitudeCompare';
import { maybeTriggerStack, resolveOutputMode } from './stack';
import {
  buildBundle,
  buildCorpusBridgeBlock,
  buildMoodCBlock,
  buildLightEmpathyBlock,
  buildTailQuestionBlock,
  composeReply,
  composeCrisisLeadIn,
  noCorpusCompose,
  DISTANT_CAUTIOUS_FALLBACK,
} from './compose';
import {
  getDialogueState,
  pushMoodHistory,
  pushAttitudeHistory,
  countRecentBucket,
  markCorpusUsed,
  isCStrategyActive,
  updateSticky,
  applyStackRecovery,
  recordCalm,
} from './dialogueState';
import { getAlignedFrame, readAttitudeLevel, getReinterpretationSource } from './corpus';
import {
  evaluateFoucaultAnswer,
  type PendingFoucaultQuestion,
} from '../questionEvaluation';
import type { ChatMessage as Message } from '../../../types';
import type { MoodBucket, PipelineDebug, PipelineResult } from './types';

const PHILOSOPHER_NAME = '福柯';

/** 纯应酬语（你好/在吗）专用短应：福柯口吻，平述、不引典、不句尾提问 */
const PHATIC_LINES = [
  '你好。说吧，我在听。',
  '嗯，我在。你想说什么，就说吧。',
  '来了。我听着。',
];

/** 把对话历史格式化为 priorTurns（最近 6 条） */
function formatPriorTurns(history: Message[]): string {
  const recent = history.slice(-6);
  return recent
    .map((m) => `${m.role === 'user' ? '用户' : PHILOSOPHER_NAME}：${m.content.slice(0, 80)}`)
    .join('\n');
}

/** 近 10 句中敏感类（A/B 组）命中总数（累积计量用） */
function sensitiveCount(bucketHistory: MoodBucket[]): number {
  return bucketHistory.filter((b) => b !== 'C' && b !== 'D').length;
}

export interface RunPipelineOpts {
  conversationId: string;
  userInput: string;
  history: Message[];
  pendingQuestion?: PendingFoucaultQuestion;
}

export async function runFoucaultPipeline(opts: RunPipelineOpts): Promise<PipelineResult> {
  const state = getDialogueState(opts.conversationId);
  const semanticInput = preprocessInput(opts.userInput);
  const priorTurns = formatPriorTurns(opts.history);
  const debug: PipelineDebug = { viaPipeline: true };
  const now = Date.now();

  applyStackRecovery(state, now);

  /* ---------- 2/3 · mood 判定 + 粘滞 ---------- */
  const mood = await detectMood(semanticInput, priorTurns, state.cModeStickyRemaining > 0);
  debug.moodTier = mood.tier;
  debug.bucket = mood.bucket;
  debug.hasEmotion = !!mood.hasEmotion;
  pushMoodHistory(state, mood.tier, mood.bucket);
  updateSticky(state, mood.tier, !!mood.earlyExitSticky);
  debug.cStickyRemaining = state.cModeStickyRemaining;

  /* ---------- 4 · 硬退出：A / A8 / B1 / B2 ---------- */
  if (mood.bucket === 'A' || mood.bucket === 'platform_reject') {
    return { reply: '', uiPanel: 'ban', attitude: undefined, debug: { ...debug, note: 'A 类硬红线' } };
  }
  if (mood.bucket === 'A8') {
    return { reply: '', uiPanel: 'help', attitude: undefined, debug: { ...debug, note: 'A8 求助面板' } };
  }
  if (mood.bucket === 'B1' || mood.bucket === 'B2') {
    // 计数含本轮（pushMoodHistory 已在上方执行），B1/B2 合并计量；三档定稿句逐字不变，
    // 用户本句或上文带出具体事时，先由接话短句把那件事接住再入定稿（失败回退原样定稿）
    const n = countRecentBucket(state, mood.bucket);
    const line = n >= 3 ? SUICIDE_LINE_3 : n === 2 ? SUICIDE_LINE_2 : SUICIDE_LINE_1;
    const leadIn = await composeCrisisLeadIn(semanticInput, priorTurns);
    const reply = leadIn ? `${leadIn}${line}` : line;
    const uiPanel = n >= 3 ? 'help' : null;
    const note =
      n >= 3
        ? 'B1/B2 第三次 → 扩大同行者圈子 + 热线面板'
        : `B1/B2 第${n}次定稿`;
    return { reply, uiPanel, attitude: 1, debug: { ...debug, note: leadIn ? `${note}（带接话）` : note } };
  }

  /* ---------- 5 · B3–B11 敏感处置 ---------- */
  if (/^B(3|4|5|6|7|8|9|10|11)$/.test(mood.bucket)) {
    const bucket = mood.bucket as MoodBucket;
    // 近 10 句同类 ≥3 → 通用 ban（B6/B7/B8 走特殊模式不在此列也可并行生效）
    if (countRecentBucket(state, bucket) >= 3 && bucket !== 'B8') {
      return { reply: '', uiPanel: 'ban', attitude: 1, debug: { ...debug, note: `${bucket} 频次≥3 → ban` } };
    }
    // 累积计量：≥7 不回复（仅动画）；5–6 「……」
    const sensCount = sensitiveCount(state.bucketHistory);
    if (sensCount >= 7) {
      return { reply: '', uiPanel: null, attitude: 1, debug: { ...debug, outputMode: 'animation_only', note: '敏感累积≥7' } };
    }
    if (sensCount >= 5) {
      return { reply: '……', uiPanel: null, attitude: 1, debug: { ...debug, outputMode: 'ellipsis', note: '敏感累积5-6' } };
    }
    // B6/B7/B8：可走 themes 成句/常规流程（流程计入警告）→ 不在此返回，继续 D 流程
    if (bucket !== 'B6' && bucket !== 'B7' && bucket !== 'B8') {
      const attitude = GROUP_JIA.includes(bucket) ? 2 : 1;
      pushAttitudeHistory(state, attitude);
      recordCalm(state, attitude, now);
      const line = pickBLine(bucket, state.bucketHistory.length);
      return { reply: line, uiPanel: null, attitude, debug: { ...debug, note: `${bucket} 定稿话术` } };
    }
    debug.note = `${bucket} 特殊模式：转常规流程`;
  }

  /* ---------- 6–9 · C/D：选典（02 全链路） ---------- */
  const cStrategy = isCStrategyActive(state, mood.tier, !!mood.earlyExitSticky);
  debug.cStrategy = cStrategy;

  // 纯应酬语（你好/在吗）：不选典，福柯式短应（03 §13 无典短应的特例）
  if (isPhaticInput(semanticInput)) {
    const reply = PHATIC_LINES[state.bucketHistory.length % PHATIC_LINES.length];
    recordCalm(state, 1, now);
    return { reply, uiPanel: null, attitude: 1, debug: { ...debug, path: 'path2', lensSource: 'empty', corpusId: null, outputMode: 'normal', note: '应酬语短应' } };
  }

  /* ---------- 问题库 · 评价分支 ----------
   * 有待评问题且本句为 C/D 正常输入 → 视为对该问题的回答，走评价流程。
   * A/B 硬红线已在上方优先拦截；应酬语不消耗 pending。
   * 不联动：不推 attitudeHistory / stack，不 recordCalm（用户确认）。
   * pending 存于 localStorage 是全局的，不随对话窗口走：消费前先核对
   * 本窗口历史里福柯是否真问过这道题（入场气泡含题目原文），未问过即
   * 跨对话残留 → 当场作废，本句回归普通对话流程。 */
  const pending = opts.pendingQuestion;
  if (pending && (mood.bucket === 'C' || mood.bucket === 'D')) {
    const evalRes = await evaluateFoucaultAnswer({
      pending,
      userAnswer: opts.userInput,
      hasEmotion: mood.bucket === 'C' || !!mood.hasEmotion,
    });
    return {
      reply: evalRes.reply,
      uiPanel: null,
      debug: {
        ...debug,
        outputMode: 'normal',
        questionPending: evalRes.keepPending,
        note: `问题库评价·${evalRes.verdict}${evalRes.viaModel ? '' : '·兜底'}`,
      },
    };
  }

  const match = await selectCorpus({
    userInput: opts.userInput,
    priorTurns,
    dialogueState: state,
    preferEmpathy: cStrategy,
  });
  debug.path = match.path;
  debug.hasTension = match.hasTension;
  debug.lensSource = match.lensSource;
  debug.userCondensed = match.userCondensed;
  debug.primaryLens = match.primaryLens;
  debug.corpusBridge = match.corpusBridge;

  // 元对话：用户质问指向福柯本人（言行/身份/处境，speechAct=meta），不作话题分析，
  // 直接带上文走无典短应如实回应（如“你是怎么看到的”→承认看不见）
  if (match.speechAct === 'meta') {
    const reply = await noCorpusCompose(semanticInput, match.userCondensed, state.bucketHistory.length, priorTurns);
    return { reply, uiPanel: null, attitude: 1, debug: { ...debug, corpusId: null, outputMode: 'normal', note: '元对话短应' } };
  }

  // 无 lens / 无 entry → 无典短应（模型贴话生成，失败回退 EOP 定稿），不推 stack（§13）
  if (!match.primaryLens || !match.anchor) {
    // C 档共情轮空锚时按共情档字数放宽（2026-09-05 盲评整改三）：本早退在 resolveOutputMode 之前，
    // 够不着下方「共情档 ≥300」那条，不传标记就会被 150 字上限压成短安慰（实测 Q08 分手题 70 字）
    const reply = await noCorpusCompose(semanticInput, match.userCondensed, state.bucketHistory.length, priorTurns, {
      empathyRound: cStrategy,
      maxChars: cStrategy ? 300 : 150,
    });
    return { reply, uiPanel: null, attitude: 1, debug: { ...debug, corpusId: null, outputMode: 'normal', note: cStrategy ? '无典短应·C档共情' : '无典短应' } };
  }

  const entry = match.anchor;
  const lens = match.primaryLens;
  markCorpusUsed(state, entry.id);
  debug.corpusId = entry.id;

  /* ---------- 10 · 再解释比照 → 态度 + alignment ---------- */
  const frame = getAlignedFrame(entry, lens.kind, lens.key);
  const baseAttitude = frame ? readAttitudeLevel(frame) : 1;
  debug.baseAttitude = baseAttitude;

  const corpusReinterp = getReinterpretationSource(entry, lens.kind, lens.key);
  const { result: cmp, viaModel } = await compareReinterpretation({
    userReinterp: lens.reinterpretation,
    userCondensed: match.userCondensed,
    entry,
    primaryLens: lens,
    corpusReinterp,
  });
  debug.reinterpFit = cmp.fit;
  debug.stanceRelation = cmp.stanceRelation;
  debug.attitudeCompareViaModel = viaModel;

  let currentAttitude = mapAttitudeFromCompare(baseAttitude, cmp);
  const alignment = resolveAlignment(cmp, baseAttitude);
  debug.alignment = alignment;

  // C 策略态度上限 ≤1（§5.2）
  if (cStrategy) currentAttitude = Math.min(currentAttitude, 1);
  debug.currentAttitude = currentAttitude;

  /* ---------- 12 · stack + outputMode ---------- */
  pushAttitudeHistory(state, currentAttitude);
  maybeTriggerStack(state, currentAttitude);
  const { outputMode, maxChars } = resolveOutputMode(currentAttitude, state.longTermStack);
  debug.outputMode = outputMode;
  debug.longTermStack = state.longTermStack;
  debug.finalAttitude = currentAttitude;

  /* ---------- 13 · 短路 ---------- */
  if (outputMode === 'animation_only') {
    recordCalm(state, currentAttitude, now);
    return { reply: '', uiPanel: null, attitude: currentAttitude, debug };
  }
  if (outputMode === 'ellipsis') {
    recordCalm(state, currentAttitude, now);
    return { reply: '……', uiPanel: null, attitude: currentAttitude, debug };
  }
  if (outputMode === 'distant_cautious') {
    recordCalm(state, currentAttitude, now);
    return { reply: DISTANT_CAUTIOUS_FALLBACK, uiPanel: null, attitude: currentAttitude, debug };
  }

  /* ---------- 14/15 · bundle + 成句 ---------- */
  // path2 无张力注入桥块时 maxChars +20（盲评整改二后上限 320）
  let finalMaxChars = maxChars;
  let bridgeBlock = buildCorpusBridgeBlock({
    path: match.path,
    hasTension: match.hasTension,
    lensSource: match.lensSource,
    bridge: match.corpusBridge,
  });
  if (match.path === 'path2' && match.hasTension !== true && (bridgeBlock || match.lensSource === 'loose')) {
    finalMaxChars = Math.min(maxChars + 20, 320);
  }

  const moodCBlock = cStrategy
    ? buildMoodCBlock(entry.condensed != null && /丧|恸|哭|悲|友|患|病|死|孤|苦/.test(entry.condensed), match.path === 'path1')
    : undefined;
  // 分级共情：未进 C 档重机器但带轻情绪 → 注入轻应情块（轻事轻接；不粘滞、不放宽字数、不移除 bridge）
  const lightEmpathyBlock = !cStrategy && mood.bucket === 'D' && !!mood.hasEmotion
    ? buildLightEmpathyBlock()
    : undefined;
  // 共情模式：应情优先，不注入「关系+典义」强指令（避免与应情冲突），放宽字数让语境化轻析落地；
  // 盲评整改二：共情档 ≥300，接住后有足够空间展开语境化分析（§5）
  if (cStrategy) {
    bridgeBlock = undefined;
    finalMaxChars = Math.max(finalMaxChars, 300);
  }

  // 句尾提问（§10/§14.7 福柯化，2026-09-05 用户拍板）：normal 有典成句 + 非 C 档 +
  // 上轮不在等答 + 30% 概率 → 注入提问块，maxChars+20（容纳尾问）。
  // 元对话/应酬/无典短应/危机已在上游早退，不在此处。
  const wantTailQuestion =
    outputMode === 'normal' && !cStrategy && !state.awaitingTailAnswer && Math.random() < 0.3;
  const tailQuestionBlock = wantTailQuestion ? buildTailQuestionBlock() : undefined;
  if (wantTailQuestion) finalMaxChars = Math.min(finalMaxChars + 20, 320);
  debug.tailQuestion = wantTailQuestion;

  const bundle = buildBundle({
    entry,
    primaryLens: lens,
    alignment,
    alignmentReason: cmp.reason,
    currentAttitude,
    baseAttitude,
    finalAttitude: currentAttitude,
    longTermStack: state.longTermStack,
    outputMode,
    maxChars: finalMaxChars,
    userCondensed: match.userCondensed,
    corpusBridgeBlock: bridgeBlock,
    looseWhyBlock: match.lensSource === 'loose' && !match.corpusBridge ? `放宽再抽命中 ${lens.key}：${lens.reinterpretation}` : undefined,
    moodCBlock,
    lightEmpathyBlock,
    tailQuestionBlock,
    mode: modeOfAlignment(alignment),
  });

  const reply = await composeReply(bundle);
  // 防连环问：本轮成句若以问号收尾，置 awaitingTailAnswer=true，下一轮不再提问（用户已拍板）
  state.awaitingTailAnswer = /[？?]\s*$/.test(reply.trim());
  recordCalm(state, currentAttitude, now);
  return { reply, uiPanel: null, attitude: currentAttitude, debug };
}

export { HELP_PANEL_TEXT, banPanelText };
