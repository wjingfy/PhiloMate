/**
 * 当期态度：用户再解释(+意图 condensed) ↔ 语料 temperament(+condensed) 智能比照
 * 取代关键词极性启发式作为态度定档主路径。
 */
import { MODEL_ROUTE } from '../../constants/app';
import { chatCompletionJson } from './qwenJson';
import type { AttitudeFrame } from './types';
import {
  readFrameAttitudeLevel,
  readFrameStance,
} from '../shared/stanceField';

export type ReinterpFit = 'tight' | 'loose' | 'oppose_topic';
export type StanceRelation = 'same' | 'opposite' | 'unclear' | 'inquire';

export interface ReinterpCompareResult {
  fit: ReinterpFit;
  stanceRelation: StanceRelation;
  reason: string;
  /** 是否走了 API；false 表示本地兜底 */
  viaModel: boolean;
}

export interface AttitudeFromCompareResult {
  attitude: number;
  inverted: boolean;
  softened: boolean;
  baseAttitude: number;
  reason: string;
  compare: ReinterpCompareResult;
  alignment: 'match' | 'mismatch';
}

const PROMPT_REINTERP_COMPARE = `你是 PhiloMate 再解释比照器。比较「用户侧」与「语料侧」是否谈同一判断命题、立场是否同向。

【输入】
- userCondensed：用户本轮问旨；须含**当前语境下的意图**（求教/自省/站队认同/站队反对/辨析等）
- userReinterp：用户对命中范畴的再解释
- corpusCondensed：语料整段缩句
- corpusTemperament：语料对该范畴的再解释（完整判断命题；可含「｜原句：…」指针，比照时读气质段+指针所指义）
- corpusStance：语料帧立场 praise|reject|lament|refuse_talk|neutral_explain|method
- baseAttitude：0欣赏 1温和 2批判 3严厉 4疏远

【输出 JSON】
{
  "fit": "tight"|"loose"|"oppose_topic",
  "stanceRelation": "same"|"opposite"|"unclear"|"inquire",
  "reason": "≤40字"
}

【fit】
- tight：用户再解释与语料 temperament 指向**同一判断命题**（对象+评价结构可对上），非仅同范畴字面
- loose：仅同范畴/沾边，命题不完全符合 temperament
- oppose_topic：范畴或话题根本岔开（少用）

【stanceRelation】
- same：用户意图/再解释与 corpusStance 同向（赞其所赞、斥其所斥）
- opposite：贴合前提下用户站在帧的反面（赞帧所斥、斥帧所赞）——如公然认同无信/舞弊对 reject「人而无信」
- inquire：求教、辨析、未站队
- unclear：读不出立场

【注意】
- 自省「我以前做错了」→ 通常 inquire 或 same（向善），不要仅因出现「骗/恶」就 opposite
- 求教「为何欺诈不好」→ inquire
- 公然认同舞弊「骗很好还要继续」对 reject 帧 → opposite（若命题贴合）或 loose（若不贴）
- 禁止输出 attitude 数字；不要 JSON 以外文字。`;

function stripYuanju(temp: string): string {
  const t = (temp || '').trim();
  const i = t.indexOf('｜原句');
  if (i >= 0) return t.slice(0, i).trim() || t;
  const j = t.indexOf('|原句');
  if (j >= 0) return t.slice(0, j).trim() || t;
  return t;
}

/**
 * 由比照结果映射当期态度（对**用户**的态度，非对语料对象）
 * - tight+same → 与夫子同向：
 *   · base 2/3（帧在斥某恶）且用户同斥 → **0**（欣赏认同，勿把对象批判套到用户）
 *   · base 0/1 → 沿用 base
 * - tight+opposite → 站反面：2/3 **保持**；0→2；1 沿用；4 保持
 * - loose / inquire / unclear / oppose_topic → 1（4 仍保持）
 */
export function mapAttitudeFromCompare(
  baseAttitude: number,
  compare: ReinterpCompareResult,
  _opts?: { corpusStance?: string }
): Omit<AttitudeFromCompareResult, 'compare'> {
  const base =
    Number.isFinite(baseAttitude) && baseAttitude >= 0 && baseAttitude <= 4
      ? Math.floor(baseAttitude)
      : 1;

  const keep = (attitude: number, extra: string, alignment: 'match' | 'mismatch' = 'match') => ({
    attitude,
    inverted: false,
    softened: false,
    baseAttitude: base,
    reason: `${compare.reason || ''}｜${extra}`.slice(0, 120),
    alignment,
  });

  if (base === 4) {
    return keep(4, '疏远帧保持4', 'mismatch');
  }

  if (compare.fit === 'tight' && compare.stanceRelation === 'same') {
    // 帧斥恶、用户同斥 → 欣赏用户（例：以礼节和、斥知和而和）
    if (base === 2 || base === 3) {
      return {
        attitude: 0,
        inverted: true,
        softened: false,
        baseAttitude: base,
        reason: `${compare.reason}｜贴合同向(同斥所斥) ${base}→0`,
        alignment: 'match',
      };
    }
    return keep(base, `贴合同向→沿用base=${base}`);
  }

  if (compare.fit === 'tight' && compare.stanceRelation === 'opposite') {
    if (base === 2 || base === 3) {
      return keep(base, `贴合反向(赞所斥)→保持批判${base}`, 'mismatch');
    }
    if (base === 0) {
      return {
        attitude: 2,
        inverted: true,
        softened: false,
        baseAttitude: base,
        reason: `${compare.reason}｜贴合反向(斥所赞) 0→2`,
        alignment: 'mismatch',
      };
    }
    return keep(1, '贴合反向但base=1→沿用1', 'mismatch');
  }

  // loose / inquire / unclear / oppose_topic（含 loose+same：不贴则不强抬）
  const softReason =
    compare.fit === 'loose'
      ? '仅同范畴不贴→1'
      : compare.stanceRelation === 'inquire'
        ? '求教/辨析未站队→1'
        : '比照不明或不贴→1';
  return {
    attitude: 1,
    inverted: false,
    softened: true,
    baseAttitude: base,
    reason: `${compare.reason || ''}｜${softReason}`.slice(0, 120),
    alignment: compare.fit === 'loose' || compare.stanceRelation === 'opposite' ? 'mismatch' : 'match',
  };
}

/** 本地兜底：无 API 时偏保守（loose→1），避免关键词误反推 */
export function fallbackCompareLocal(params: {
  userReinterp: string;
  userCondensed: string;
  corpusTemperament: string;
  corpusCondensed: string;
  speechAct?: string;
}): ReinterpCompareResult {
  const blob = `${params.userCondensed} ${params.userReinterp}`;
  if (
    params.speechAct === 'question' ||
    /求教|为何|怎么看|是否|何为|辨析|相较|难道/.test(blob)
  ) {
    return {
      fit: 'loose',
      stanceRelation: 'inquire',
      reason: '本地兜底：问询/辨析',
      viaModel: false,
    };
  }
  if (/自省|反思|我错了|不该|悔/.test(blob)) {
    return {
      fit: 'loose',
      stanceRelation: 'inquire',
      reason: '本地兜底：自省',
      viaModel: false,
    };
  }
  // 无智能比照时不轻易判 tight/opposite
  return {
    fit: 'loose',
    stanceRelation: 'unclear',
    reason: '本地兜底：保守不贴合',
    viaModel: false,
  };
}

export async function compareReinterpretations(params: {
  userCondensed: string;
  userReinterp: string;
  corpusCondensed: string;
  corpusTemperament: string;
  corpusStance: string;
  baseAttitude: number;
  speechAct?: string;
  model?: string;
}): Promise<ReinterpCompareResult> {
  try {
    const raw = await chatCompletionJson<{
      fit?: string;
      stanceRelation?: string;
      reason?: string;
    }>(
      PROMPT_REINTERP_COMPARE,
      JSON.stringify({
        userCondensed: params.userCondensed,
        userReinterp: params.userReinterp,
        corpusCondensed: params.corpusCondensed,
        corpusTemperament: params.corpusTemperament,
        corpusStance: params.corpusStance,
        baseAttitude: params.baseAttitude,
      }),
      params.model || MODEL_ROUTE,
      220,
      0.1
    );
    const fit = normalizeFit(raw.fit);
    const stanceRelation = normalizeStanceRelation(raw.stanceRelation);
    return {
      fit,
      stanceRelation,
      reason: (raw.reason || '').slice(0, 80) || `${fit}/${stanceRelation}`,
      viaModel: true,
    };
  } catch {
    return fallbackCompareLocal({
      userReinterp: params.userReinterp,
      userCondensed: params.userCondensed,
      corpusTemperament: params.corpusTemperament,
      corpusCondensed: params.corpusCondensed,
      speechAct: params.speechAct,
    });
  }
}

function normalizeFit(s?: string): ReinterpFit {
  if (s === 'tight' || s === 'loose' || s === 'oppose_topic') return s;
  return 'loose';
}

function normalizeStanceRelation(s?: string): StanceRelation {
  if (s === 'same' || s === 'opposite' || s === 'unclear' || s === 'inquire') return s;
  return 'unclear';
}

/** 管线入口：比照 → 定档 */
export async function resolveAttitudeByReinterpCompare(params: {
  frame: Pick<AttitudeFrame, 'attitudeLevel' | 'confuciusStance'> | null | undefined;
  userReinterp: string;
  userCondensed: string;
  corpusCondensed: string;
  corpusTemperament: string;
  speechAct?: string;
  philosopherId?: string;
}): Promise<AttitudeFromCompareResult> {
  const philosopherId = params.philosopherId || 'confucius';
  const frameRec = (params.frame ?? undefined) as Record<string, unknown> | undefined;
  const base = readFrameAttitudeLevel(frameRec, philosopherId);
  const stance = readFrameStance(frameRec, philosopherId);
  const compare = await compareReinterpretations({
    userCondensed: params.userCondensed,
    userReinterp: params.userReinterp,
    corpusCondensed: params.corpusCondensed,
    corpusTemperament: stripYuanju(params.corpusTemperament) || params.corpusCondensed,
    corpusStance: stance,
    baseAttitude: base,
    speechAct: params.speechAct,
  });
  const mapped = mapAttitudeFromCompare(base, compare, { corpusStance: stance });
  return { ...mapped, compare };
}
