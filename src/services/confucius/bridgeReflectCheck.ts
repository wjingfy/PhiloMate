/**
 * 成句对照裁决【bridge】的二次校验：用户侧极 + 典侧极 + 两边关系（缺一不可）。
 */
import { MODEL } from '../../constants/app';
import { chatCompletionJson } from './qwenJson';

export const PROMPT_BRIDGE_REFLECT = `你是 PhiloMate 成句↔裁决 bridge 校验器。判据从严：宁可误杀，勿放过「缺极／关系糊／答非所问」。

【任务】判断「成句」是否已体现裁决【bridge】的三件套（顺序不论，**缺一则 ok=false**）。
对每一件须从成句中**摘出证据短串**（须是成句子串或明显压缩）；摘不出则该件为 false。

1. **用户侧极**：对应用户原句／问旨的**具体问点**（问什么就得点什么）。仅有「较真／守礼／志仁／无恶」等空断词、却无问点名词（如问射却无射／箭；问恶从何来却无恶／习／染）→ false。
2. **典侧极**：对应 anchor／bridge 语料侧。
3. **两边关系**：写出由此及彼（犹／亦／正若／盖当／故…）；空断收束且未点两极如何相接 → false。

【硬：须答用户所问那一极】
成句不能只复述典的正面断语，而把用户问点晾着。
- 若用户问「Ｘ是否／从何来／算不算…」，成句必须对Ｘ有所裁断或溯源（可借 bridge 因果对极轻翻一句）。
- 例：用户问「恶是习出来的吗」；bridge 已有「志仁→无恶／善为修习阻恶之果」——成句须落到恶侧（如恶乃未修／习偏之果），**不可**只说「志仁则无恶／善本既立」而不接「恶」从何而来。
- 仅有典侧正面 + 无用户问点 → hasUserPole=false，ok=false。

【否例 · 必须判 false】
用户：「夫子射箭也较真吗？」
bridge：食礼之敬 ↔ 射礼之较真
成句：「虽疏食菜羹，必祭，必齐如也，较真乃守礼之实。」
→ 无射／箭 → hasUserPole=false；关系空断 → hasRelation=false；ok=false。

用户：「恶是习出来的吗？」
bridge：志仁则无恶 ↔ 修习阻恶
成句：「苟志於仁矣，无恶也，善本既立则习染自远。」
→ 只答志仁／无恶正面，未裁「恶是否习出」→ hasUserPole=false；ok=false。

【是例】
「射求正己，犹疏食必祭，诚敬乃礼之本也。」→ 三件皆有证据 → ok=true。
「志仁则无恶，习偏乃失正，恶由未修也。」→ 用户问恶有着落 → ok=true。

输出 JSON（不要其它文字）：
{"ok":true|false,"hasUserPole":true|false,"hasCorpusPole":true|false,"hasRelation":true|false,"userPoleEvidence":"成句子串或空","corpusPoleEvidence":"成句子串或空","relationEvidence":"成句子串或空","missing":"缺什么（ok时空）","hint":"重写须补的半句（ok时空）"}`;

export interface BridgeReflectResult {
  ok: boolean;
  hasUserPole: boolean;
  hasCorpusPole: boolean;
  hasRelation: boolean;
  missing: string;
  hint: string;
}

type RawReflect = Partial<BridgeReflectResult> & {
  userPoleEvidence?: string;
  corpusPoleEvidence?: string;
  relationEvidence?: string;
};

function evidenceOk(reply: string, evidence: string | undefined, claimed: boolean): boolean {
  if (!claimed) return false;
  const e = (evidence || '').trim();
  if (!e) return false;
  // 证据须能在成句中找到（允许极短压缩：至少 1 字命中连续）
  if (reply.includes(e)) return true;
  // 证据被模型略改时：要求证据中半数以上汉字出现在成句
  const chars = [...e].filter((c) => /[\u4e00-\u9fff]/.test(c));
  if (chars.length === 0) return false;
  const hit = chars.filter((c) => reply.includes(c)).length;
  return hit >= Math.ceil(chars.length * 0.6);
}

function normalize(reply: string, raw: RawReflect | null | undefined): BridgeReflectResult {
  let hasUserPole = Boolean(raw?.hasUserPole);
  let hasCorpusPole = Boolean(raw?.hasCorpusPole);
  let hasRelation = Boolean(raw?.hasRelation);
  if (!evidenceOk(reply, raw?.userPoleEvidence, hasUserPole)) hasUserPole = false;
  if (!evidenceOk(reply, raw?.corpusPoleEvidence, hasCorpusPole)) hasCorpusPole = false;
  if (!evidenceOk(reply, raw?.relationEvidence, hasRelation)) hasRelation = false;

  const ok =
    (typeof raw?.ok === 'boolean' ? raw.ok : true) &&
    hasUserPole &&
    hasCorpusPole &&
    hasRelation;

  const missingParts: string[] = [];
  if (!hasUserPole) missingParts.push('用户侧极');
  if (!hasCorpusPole) missingParts.push('典侧极');
  if (!hasRelation) missingParts.push('两边关系');

  return {
    ok,
    hasUserPole,
    hasCorpusPole,
    hasRelation,
    missing: ok
      ? ''
      : String(raw?.missing || missingParts.join('、') || '三件套不完整').slice(0, 120),
    hint: String(
      raw?.hint ||
        (ok ? '' : '须补全用户侧极、典侧极，并写清两边何以相接')
    ).slice(0, 160),
  };
}

/** 用户问含「射」且 bridge 亦含「射」时，成句须点射／箭 */
function hardGateShe(params: {
  reply: string;
  bridge: string;
  userInput: string;
  condensed?: string;
  result: BridgeReflectResult;
}): BridgeReflectResult {
  const ask = `${params.userInput}${params.condensed || ''}`;
  if (!/射/.test(ask) || !/射/.test(params.bridge)) return params.result;
  if (/射|箭/.test(params.reply)) return params.result;
  return {
    ...params.result,
    ok: false,
    hasUserPole: false,
    hasRelation: params.result.hasRelation && /犹|亦|正若|譬|盖当|故|乃因/.test(params.reply),
    missing: '用户侧极（射）',
    hint: params.result.hint || '须点明射／射礼，并接到食礼之敬',
  };
}

/** 短桥／问旨是否点明让步（虽…仍／虽…然／然…犹／认同…仍等） */
export function sourceHasConcessiveLogic(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (/虽[^。！？\n]{0,40}(?:仍|却|然|犹|还是)/.test(t)) return true;
  if (/但[^。！？\n]{0,40}仍/.test(t)) return true;
  if (/虽然[^。！？\n]{0,40}还是/.test(t)) return true;
  if (/然[^。！？\n]{0,24}犹/.test(t)) return true;
  if (/理智[^。！？\n]{0,30}情感[^。！？\n]{0,20}仍/.test(t)) return true;
  if (/认同[^。！？\n]{0,24}仍/.test(t)) return true;
  return false;
}

/**
 * 短桥／问旨是否点明转折（但／却／可是／非…乃…／一边…另一边…／理智…情感 等）。
 * 「而」仅取表转形（…，而…／而却｜而仍｜而实｜而非），避免顺承误杀。
 */
export function sourceHasContrastiveLogic(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (/但是|可是|不过/.test(t)) return true;
  if (/却/.test(t)) return true;
  if (/但/.test(t)) return true;
  if (/非[^。！？\n]{0,24}(?:乃|实)/.test(t)) return true;
  if (/不是[^。！？\n]{0,24}而是/.test(t)) return true;
  if (/一边[^。！？\n]{0,40}另一边/.test(t)) return true;
  if (/理智[^。！？\n]{0,40}情感/.test(t)) return true;
  if (/[^。！？\n]{2,}，而[^。！？\n]{2,}/.test(t)) return true;
  if (/而(?:却|仍|实|非)/.test(t)) return true;
  if (/，然|然则|(?:^|[。！？])然(?![后而则])/.test(t)) return true;
  return false;
}

/** 成句是否保留让步表面逻辑词（文言亦可：虽…然／虽…犹／仍／却等） */
export function replyHasConcessiveSurface(reply: string): boolean {
  const t = (reply || '').trim();
  if (!t) return false;
  if (/虽|犹|仍|却|然则/.test(t)) return true;
  if (/然[^。！？\n]{0,24}犹/.test(t)) return true;
  if (/(?:^|[，。])然(?![后而则])/.test(t)) return true;
  return false;
}

/** 成句是否保留转折表面（然／而／却／非…乃…／虽／犹 等；须有清晰张力，勿无标记并列） */
export function replyHasContrastiveSurface(reply: string): boolean {
  const t = (reply || '').trim();
  if (!t) return false;
  if (/虽|犹|仍|却|但|然则|可是|不过/.test(t)) return true;
  if (/非[^。！？\n]{0,24}(?:乃|实)/.test(t)) return true;
  if (/不是[^。！？\n]{0,24}而是/.test(t)) return true;
  if (/[，、]而|而(?:却|仍|实|非)/.test(t)) return true;
  if (/，然|(?:^|[。！？])然(?![后而则])/.test(t)) return true;
  if (/然[^。！？\n]{0,24}犹/.test(t)) return true;
  return false;
}

/**
 * 短桥（或 condensed）已点明让步或转折，成句却压成无张力并列 → 须重写。
 */
export function looksDroppedBridgeLogic(params: {
  reply: string;
  bridge?: string | null;
  condensed?: string | null;
}): boolean {
  const source = `${params.bridge || ''}\n${params.condensed || ''}`;
  const reply = params.reply || '';
  if (sourceHasConcessiveLogic(source) && !replyHasConcessiveSurface(reply)) return true;
  if (sourceHasContrastiveLogic(source) && !replyHasContrastiveSurface(reply)) return true;
  return false;
}

/** @deprecated 同 looksDroppedBridgeLogic（含让步＋转折） */
export function looksDroppedConcessiveLogic(params: {
  reply: string;
  bridge?: string | null;
  condensed?: string | null;
}): boolean {
  return looksDroppedBridgeLogic(params);
}

/** 短桥有让步／转折而成句丢掉逻辑词 → 三件套关系视为不全 */
function hardGateBridgeLogic(params: {
  reply: string;
  bridge: string;
  condensed?: string;
  result: BridgeReflectResult;
}): BridgeReflectResult {
  if (
    !looksDroppedBridgeLogic({
      reply: params.reply,
      bridge: params.bridge,
      condensed: params.condensed,
    })
  ) {
    return params.result;
  }
  return {
    ...params.result,
    ok: false,
    hasRelation: false,
    missing: params.result.missing
      ? `${params.result.missing}；让步／转折逻辑`
      : '让步／转折逻辑',
    hint:
      '上稿丢掉短桥让步／转折，已废；须保留虽／然／而／却／非…乃等逻辑词，对仗可让',
  };
}

function applyHardGates(params: {
  reply: string;
  bridge: string;
  userInput: string;
  condensed?: string;
  result: BridgeReflectResult;
}): BridgeReflectResult {
  const afterShe = hardGateShe(params);
  return hardGateBridgeLogic({
    reply: params.reply,
    bridge: params.bridge,
    condensed: params.condensed,
    result: afterShe,
  });
}

/** subjectOnly 直化轮跳过；无 bridge 跳过 */
export function shouldCheckBridgeReflect(params: {
  corpusBridge?: string | null;
  corpusBridgeSubjectOnly?: boolean | null;
  sentenceMode?: 'direct' | 'hua' | 'bridge' | null;
}): boolean {
  if (!params.corpusBridge?.trim()) return false;
  if (params.corpusBridgeSubjectOnly) return false;
  if (params.sentenceMode === 'direct' || params.sentenceMode === 'hua') return false;
  return true;
}

export async function checkBridgeReflection(params: {
  reply: string;
  bridge: string;
  userInput: string;
  condensed?: string;
  anchorText?: string;
}): Promise<BridgeReflectResult> {
  const reply = (params.reply || '').trim();
  const bridge = (params.bridge || '').trim();
  if (!reply || !bridge) {
    return {
      ok: false,
      hasUserPole: false,
      hasCorpusPole: false,
      hasRelation: false,
      missing: '无成句或无bridge',
      hint: '须写出用户侧极、典侧极与两边关系',
    };
  }
  try {
    const raw = await chatCompletionJson<RawReflect>(
      PROMPT_BRIDGE_REFLECT,
      JSON.stringify({
        userInput: params.userInput,
        condensed: params.condensed || '',
        bridge,
        reply,
        anchorText: params.anchorText || '',
      }),
      MODEL
    );
    const normalized = normalize(reply, raw);
    return applyHardGates({
      reply,
      bridge,
      userInput: params.userInput,
      condensed: params.condensed,
      result: normalized,
    });
  } catch {
    // API 失败时仍跑硬闸，避免完全失守
    const fallback: BridgeReflectResult = {
      ok: true,
      hasUserPole: true,
      hasCorpusPole: true,
      hasRelation: true,
      missing: '',
      hint: '',
    };
    return applyHardGates({
      reply,
      bridge,
      userInput: params.userInput,
      condensed: params.condensed,
      result: fallback,
    });
  }
}
