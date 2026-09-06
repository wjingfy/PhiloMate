/**
 * 问旨理解：condensed + relation + speechAct，与 lens（themes/categories）严格分离。
 * 争辩/核对由模型读本句+上文判定，不靠关键词堆砌。
 */

import {
  ensureGlossRepairCondensed,
  inferGlossRepairHeuristic,
  normalizeGlossRepair,
  type GlossRepair,
} from './glossRepair';
import { MODEL } from '../../constants/app';
import { chatCompletionJson } from './qwenJson';
import { PROMPT_TURN_FOCUS } from './prompts';
import { isPraiseInput } from './praiseLensGuard';

export type TurnRelation = 'same_focus' | 'follow_cue' | 'shift';

/** 对本句在对话中的言语行为（模型阅读理解） */
export type TurnSpeechAct =
  | 'continue'
  | 'rebuttal'
  | 'consistency'
  | 'refinement'
  | 'question'
  | 'meta';

export type { GlossRepair };

export interface TurnFocusResult {
  /** 本轮问旨：保留必要逻辑结构，非越短越好 */
  condensed: string;
  relation: TurnRelation;
  speechAct: TurnSpeechAct;
  /** 若 follow_cue：接住的上轮锚点 */
  cueFromAssistant?: string | null;
  /**
   * 概念误读纠偏：用户用词被上轮听成另一义，本轮纠正。
   * 有则 speechAct 应为 rebuttal；成句须先卸误读。
   */
  glossRepair: GlossRepair | null;
  source: 'model' | 'fallback';
}

interface TurnFocusModelOut {
  condensed?: string;
  relation?: string;
  speechAct?: string;
  cueFromAssistant?: string | null;
  glossRepair?: unknown;
}

const CATEGORY_GLOSS =
  /^(过度|不及|适度|饮食|仁|礼|学|乐|政|信|诚|器量|内\/外|人\/己|自然\/人为|工具与手段)/;

/** 同实体换侧面（起名/花纹等）应标 shift；默认 same_focus 仅当无法识别跟点/换侧面。 */
function normalizeRelation(raw: string | undefined): TurnRelation {
  const r = (raw || '').trim().toLowerCase();
  if (r === 'follow_cue' || r === 'follow' || r === '跟点') return 'follow_cue';
  if (r === 'shift' || r === '换题' || r === '换侧面') return 'shift';
  return 'same_focus';
}

function normalizeSpeechAct(raw: string | undefined): TurnSpeechAct {
  const r = (raw || '').trim().toLowerCase();
  if (r === 'rebuttal' || r === 'debate' || r === '反驳' || r === '争辩') return 'rebuttal';
  if (r === 'consistency' || r === '核对' || r === '自相矛盾') return 'consistency';
  if (r === 'refinement' || r === '收窄') return 'refinement';
  if (r === 'question' || r === '提问') return 'question';
  if (r === 'meta' || r === '元对话') return 'meta';
  return 'continue';
}

function looksLikeCategoryGloss(c: string): boolean {
  const t = (c || '').trim();
  if (!t) return true;
  if (t.length <= 4 && CATEGORY_GLOSS.test(t)) return true;
  if (/^(求中|失度|得宜|饮食之宜|重肉|偏肉|吃肉)$/.test(t)) return true;
  return false;
}

/** 本句是否含需消解的代词/指示 */
export function hasAnaphoricPronouns(input: string): boolean {
  return /他|她|它|他们|她们|它们|这个|那个|这种|那种|这样|那样|这些|那些|此人|彼|其(?![实他])/.test(
    input || ''
  );
}

/**
 * condensed 仍带着无着落代词，而原句有代词、且有上文可消解 → 视为未完成指代
 * （「所指未明」明示失败时放过）
 */
export function looksUnresolvedPronounCondensed(
  condensed: string,
  userInput: string
): boolean {
  if (!hasAnaphoricPronouns(userInput)) return false;
  const c = (condensed || '').trim();
  if (!c || /所指未明/.test(c)) return false;
  // condensed 仍以裸代词承指、未写出具体人事
  if (/(?:这种|那种|这样|那样|这个|那个|这些|那些)(?:过|事|情况|人)?/.test(c)) {
    // 若已写成「…之过」「急躁…」等具体，可放过
    if (
      /打断|爽约|领导|朋友|父母|同事|悔而|再犯|当众|放鸽子|创业|考公/.test(c)
    ) {
      return false;
    }
    return true;
  }
  if (/(?:^|，|。|：)(?:他|她|它|他们|她们)(?:总|又|还|却|就|会|说|让|把)/.test(c)) {
    if (/朋友|领导|同事|父母|其人|爽约者|批评者/.test(c)) return false;
    return true;
  }
  return false;
}

/**
 * condensed 削掉了原句必要逻辑（目的/手段、恰恰是、既然…为何…）→ 过简
 */
export function looksOverSimplifiedCondensed(condensed: string, userInput: string): boolean {
  const c = (condensed || '').trim();
  const input = userInput || '';
  if (!c || c.length < 8) return true;
  if (looksLikeCategoryGloss(c)) return true;
  // 目的-手段 / 纠偏结构被压成单主题词
  if (/为了|所以|反而|恰恰|既然|不是偏|求.*度|补.*不足|搭配/.test(input)) {
    if (/^(偏重)?(荤)?肉|(更)?看重吃肉|重肉|食肉|吃足肉$/.test(c)) return true;
    if (
      c.length < 16 &&
      !/为|求|补|合度|相济|搭配|所以|反而|恰恰|习惯|注意|调节|放任/.test(c)
    ) {
      return true;
    }
  }
  return false;
}

/** 无模型时：保留原句前段作 condensed；speechAct 不猜争辩 */
function resolveGlossRepair(params: {
  modelRaw: unknown;
  userInput: string;
  lastAssistantMessage?: string | null;
  lastUserMessage?: string | null;
}): GlossRepair | null {
  return (
    normalizeGlossRepair(params.modelRaw) ||
    inferGlossRepairHeuristic({
      userInput: params.userInput,
      lastAssistantMessage: params.lastAssistantMessage,
      lastUserMessage: params.lastUserMessage,
    })
  );
}

export function fallbackTurnFocus(
  userInput: string,
  ctx: {
    openQuestion?: string | null;
    lastUserCondensed?: string | null;
    lastUserMessage?: string | null;
    lastAssistantMessage?: string | null;
    turnCount: number;
  }
): TurnFocusResult {
  const glossRepair = resolveGlossRepair({
    modelRaw: null,
    userInput,
    lastAssistantMessage: ctx.lastAssistantMessage,
    lastUserMessage: ctx.lastUserMessage || ctx.lastUserCondensed,
  });
  let condensed = (userInput || '').trim().slice(0, 48) || '待察其事';
  if (glossRepair) condensed = ensureGlossRepairCondensed(condensed, glossRepair);

  if (ctx.turnCount <= 0 || !ctx.lastAssistantMessage) {
    return {
      condensed,
      relation: 'same_focus',
      speechAct: glossRepair ? 'rebuttal' : 'continue',
      glossRepair,
      source: 'fallback',
    };
  }
  // 夸赞上轮 → 换议题（评价对话），勿 same_focus
  if (isPraiseInput(userInput) && !glossRepair) {
    return {
      condensed: condensed.includes('赞') ? condensed : `赞许上轮所言：${condensed.slice(0, 28)}`,
      relation: 'shift',
      speechAct: 'continue',
      glossRepair: null,
      source: 'fallback',
    };
  }
  if (glossRepair) {
    return {
      condensed,
      relation: 'same_focus',
      speechAct: 'rebuttal',
      glossRepair,
      source: 'fallback',
    };
  }
  const last = ctx.lastAssistantMessage;
  const prev = `${ctx.lastUserCondensed || ''}${ctx.openQuestion || ''}`;
  const anchors = last.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  for (const a of anchors) {
    if (userInput.includes(a) && !prev.includes(a) && !/以为|亦可|然|虽非|则/.test(a)) {
      return {
        condensed,
        relation: 'follow_cue',
        speechAct: 'continue',
        glossRepair: null,
        cueFromAssistant: a,
        source: 'fallback',
      };
    }
  }
  return {
    condensed,
    relation: 'same_focus',
    speechAct: 'continue',
    glossRepair: null,
    source: 'fallback',
  };
}

export async function resolveTurnFocus(params: {
  userInput: string;
  openQuestion?: string | null;
  lastUserCondensed?: string | null;
  /** 上轮用户原句（优先于 condensed，供误读纠偏对齐用词） */
  lastUserMessage?: string | null;
  lastAssistantMessage?: string | null;
  priorSnippet?: string;
  turnCount: number;
}): Promise<TurnFocusResult> {
  const { userInput, turnCount } = params;
  if (!userInput?.trim()) {
    return {
      condensed: '待察其事',
      relation: 'same_focus',
      speechAct: 'continue',
      glossRepair: null,
      source: 'fallback',
    };
  }

  try {
    const needsPronounResolve =
      turnCount > 0 &&
      hasAnaphoricPronouns(userInput) &&
      !!(params.priorSnippet || params.lastUserMessage || params.lastAssistantMessage);
    const raw = await chatCompletionJson<TurnFocusModelOut>(
      PROMPT_TURN_FOCUS,
      JSON.stringify({
        input: userInput,
        turnCount,
        lastUserCondensed: params.lastUserCondensed || undefined,
        lastUserMessage: params.lastUserMessage || undefined,
        openQuestion: params.openQuestion || undefined,
        lastAssistantMessage: params.lastAssistantMessage || undefined,
        priorDialogue: params.priorSnippet || undefined,
        pronounResolve: needsPronounResolve
          ? '本句含代词/指示；condensed 必须写出上文先行词，禁残留无着落的他/这种/那样'
          : undefined,
      }),
      MODEL,
      1000
    );
    let condensed = (raw.condensed || '').trim();
    if (!condensed || looksOverSimplifiedCondensed(condensed, userInput)) {
      condensed = userInput.trim().slice(0, 48);
    }
    // 代词未消解：再抽一次问旨（只补指代）
    if (
      needsPronounResolve &&
      looksUnresolvedPronounCondensed(condensed, userInput)
    ) {
      try {
        const retry = await chatCompletionJson<TurnFocusModelOut>(
          PROMPT_TURN_FOCUS,
          JSON.stringify({
            input: userInput,
            turnCount,
            lastUserCondensed: params.lastUserCondensed || undefined,
            lastUserMessage: params.lastUserMessage || undefined,
            openQuestion: params.openQuestion || undefined,
            lastAssistantMessage: params.lastAssistantMessage || undefined,
            priorDialogue: params.priorSnippet || undefined,
            pronounResolve:
              '重做：上稿 condensed 代词未消解。必须对照上文写出「这种/他」等具体所指，再写问旨。',
            previousBadCondensed: condensed,
          }),
          MODEL,
          1000
        );
        const retryC = (retry.condensed || '').trim();
        if (
          retryC &&
          !looksUnresolvedPronounCondensed(retryC, userInput) &&
          !looksOverSimplifiedCondensed(retryC, userInput)
        ) {
          condensed = retryC;
          if (retry.relation) raw.relation = retry.relation;
          if (retry.speechAct) raw.speechAct = retry.speechAct;
          if (retry.cueFromAssistant !== undefined) {
            raw.cueFromAssistant = retry.cueFromAssistant;
          }
          if (retry.glossRepair !== undefined) raw.glossRepair = retry.glossRepair;
        }
      } catch {
        /* keep first condensed */
      }
    }
    let relation = turnCount <= 0 ? 'same_focus' : normalizeRelation(raw.relation);
    let speechAct =
      turnCount <= 0 ? 'continue' : normalizeSpeechAct(raw.speechAct);
    let glossRepair =
      turnCount <= 0
        ? null
        : resolveGlossRepair({
            modelRaw: raw.glossRepair,
            userInput,
            lastAssistantMessage: params.lastAssistantMessage,
            lastUserMessage: params.lastUserMessage || params.lastUserCondensed,
          });
    if (glossRepair) {
      speechAct = 'rebuttal';
      condensed = ensureGlossRepairCondensed(condensed, glossRepair);
    }
    // 模型偶发把夸赞标成 same_focus：强制换题，松 sticky
    if (turnCount > 0 && isPraiseInput(userInput) && relation === 'same_focus' && !glossRepair) {
      relation = 'shift';
      if (!/赞|中肯|好|夸/.test(condensed)) {
        condensed = `赞许上轮所言：${condensed.slice(0, 28)}`;
      }
    }
    return {
      condensed,
      relation,
      speechAct,
      cueFromAssistant: raw.cueFromAssistant ?? null,
      glossRepair,
      source: 'model',
    };
  } catch {
    return fallbackTurnFocus(userInput, params);
  }
}

export function relationReleasesSticky(relation: TurnRelation): boolean {
  return relation === 'follow_cue' || relation === 'shift';
}

/** speechAct 是否进入争辩/核对（松 sticky、成句接驳） */
export function speechActIsDebate(act: TurnSpeechAct): boolean {
  return act === 'rebuttal' || act === 'consistency' || act === 'meta';
}
