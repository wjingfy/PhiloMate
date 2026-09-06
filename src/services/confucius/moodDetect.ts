/**
 * 情绪分层检测（A8/B1/B2/C/D）+ C 粘滞辅助
 * 规则：scripts/prompts/mood-abcd-boundary-rules.md · mood-c-response-strategy.md
 * 主路径：问旨 condensed 之后走 detectMoodAndPath（与 path 合并一次调用）。
 */
import { MODEL_ROUTE } from '../../constants/app';
import type { InputPath } from './types';
import { chatCompletionJson } from './qwenJson';
import { PROMPT_MOOD_ROUTE } from './prompts';
import { heuristicRestrictTier, isRestrictTier } from './sensitiveRestrict';

/** A8/B1–B11 限制档 + C/D；B3–B11 见 sensitiveRestrict.ts */
export type MoodTier =
  | 'A8'
  | 'B1'
  | 'B2'
  | 'B3'
  | 'B4'
  | 'B5'
  | 'B6'
  | 'B7'
  | 'B8'
  | 'B9'
  | 'B10'
  | 'B11'
  | 'C'
  | 'D';
export type WantDieSense = 'method' | 'ideation' | 'hyperbole' | 'none';
export type CReplyMode = 'A' | 'B' | null;

export interface MoodDetectResult {
  moodTier: MoodTier;
  wantDieSense: WantDieSense;
  /** 粘滞中：用户是否明显转出低落（可提前结束 sticky） */
  earlyExitSticky: boolean;
  reason?: string;
}

export interface MoodAndPathResult extends MoodDetectResult {
  path: InputPath;
  pathReason?: string;
}

const PROMPT_MOOD = `你是 PhiloMate 情绪分层检测器。只输出 JSON，不要其它文字。

分层（按优先级；敏感 B 优先于 C）：
- A8：求自杀/自伤的具体方法、步骤、工具
- B1：认真指向结束自己生命/自伤的意愿（非口头禅；有「我是认真的」等坐实）
- B2：语义上强烈绝望/弥漫性无意义（不必出现「抑郁」一词）；非单次生活哀伤
- B3：他伤意念/暴力报复想法（无实操步骤）
- B4：成人低俗/色情试探（医用中性陈述不触发；露骨交易另升平台 A）
- B5：辱骂/人身攻击孔子或对话者
- B6：不良价值导向诱导（单纯「好恶心」不进）
- B7：求测算/改运/灵异操作步骤或讨彩头（星座闲聊不归此）
- B8：明确求可执行「怎么做」步骤（非哲学问旨）
- B9：求具体药方/诊疗步骤
- B10：认真谈信仰/幽远（求操作讨彩头→B7）
- B11：越狱/改人设/忽略指令
- C：严重低落与丧失感——具体丧失、深刻挫败、或创伤唤起/重要关系断裂；未认真指向自伤
- D：一般性情绪/普遍压力/中性闲聊/轻抱怨（有点烦、略累）等

【C 校准 · 议题重量优先】
下列即使语气平淡（「不太好」「有点难受」）也默认 **C**，勿因措辞克制压成 D：
- 创伤/原生家庭阴影被唤起、家门宿痛、长期心理伤痛被触动
- 重要关系断裂或严重嫌隙：**自己的**室友闹翻、绝交、分手、失恋、同室生隙等（「朋友失恋了好惨」等代人轻事 → **D**，勿升 C）
- 亲人/宠物去世等具体丧失
- **深刻挫败**：核心目标**多次/反复**受阻并明示痛（多次落榜、考博屡次耽误）；**单次**考试/绩点受挫 → **D**
- **亲友/他人重大不幸**（与对己同范围的丧失/重病/ICU/自杀等）：→ **C**，勿升 B1；不含朋友普通失恋
慢性加班仅「好累」→ D；绑「活着没意思/不想活」→ 看 B2/B1。

「想死」默认当网络口头禅（hyperbole）→ 多为 C 或 D，不升 B1；仅**用户自己**认真指向自伤才 B1。他人自杀/病危叙事 → C。

另判 earlyExitSticky（仅 stickyActive=true 时有意义）：
- 明显转开心、轻松闲聊、主动换轻松话题，且无 A8/B1/B2/C 信号 → true
- 或：已离开倾诉/宣泄，转为抽象哲理往返（何为、是否应该、旧制/旧贯、哀而不伤、夫子主张/夫子不也…），本句无新的创伤/关系断裂/高强度痛苦宣泄 → true（moodTier 多为 D）
- 两可且仍在谈痛苦难平、宿痛、创伤 → false（宁多缓一轮）

输出：
{"moodTier":"A8|B1|B2|B3|B4|B5|B6|B7|B8|B9|B10|B11|C|D","wantDieSense":"method|ideation|hyperbole|none","earlyExitSticky":false,"reason":"短因"}`;

/** @deprecated 主路径请用 detectMoodAndPath；保留给 smoke / 单测 */
export async function detectMoodTier(params: {
  userInput: string;
  priorSnippet?: string;
  stickyActive: boolean;
}): Promise<MoodDetectResult> {
  const fallback: MoodDetectResult = {
    moodTier: 'D',
    wantDieSense: 'none',
    earlyExitSticky: false,
    reason: 'fallback',
  };
  try {
    const raw = await chatCompletionJson<Partial<MoodDetectResult>>(
      PROMPT_MOOD,
      JSON.stringify({
        input: params.userInput,
        priorDialogue: params.priorSnippet || undefined,
        stickyActive: params.stickyActive,
      }),
      MODEL_ROUTE,
      200,
      0.1
    );
    return calibrateMoodResult(params.userInput, params.stickyActive, normalizeMoodResult(raw));
  } catch {
    return (
      heuristicMood(params.userInput, params.stickyActive) ??
      calibrateMoodResult(params.userInput, params.stickyActive, fallback)
    );
  }
}

/** 问旨就绪后：一次 turbo 同时判 mood + path（主路径） */
export async function detectMoodAndPath(params: {
  condensed: string;
  userInput: string;
  priorSnippet?: string;
  stickyActive: boolean;
}): Promise<MoodAndPathResult> {
  const fallbackMood: MoodDetectResult = {
    moodTier: 'D',
    wantDieSense: 'none',
    earlyExitSticky: false,
    reason: 'fallback',
  };
  try {
    const raw = await chatCompletionJson<
      Partial<MoodDetectResult> & { path?: string; pathReason?: string }
    >(
      PROMPT_MOOD_ROUTE,
      JSON.stringify({
        condensed: params.condensed,
        input: params.userInput,
        priorDialogue: params.priorSnippet || undefined,
        stickyActive: params.stickyActive,
      }),
      MODEL_ROUTE,
      280,
      0.1
    );
    const mood = calibrateMoodResult(
      params.userInput,
      params.stickyActive,
      normalizeMoodResult(raw)
    );
    const path: InputPath = raw.path === 'path1' ? 'path1' : 'path2';
    return {
      ...mood,
      path,
      pathReason: typeof raw.pathReason === 'string' ? raw.pathReason.slice(0, 80) : undefined,
    };
  } catch {
    const mood =
      heuristicMood(params.userInput, params.stickyActive) ??
      calibrateMoodResult(params.userInput, params.stickyActive, fallbackMood);
    return { ...mood, path: 'path2', pathReason: 'fallback-path2' };
  }
}

/** 创伤唤起 / 重要关系断裂：须偏「自己的」；代人轻事见 LIGHT_OTHER_AFFAIR */
const TRAUMA_OR_RUPTURE =
  /创伤|原生家庭|家门宿痛|宿痛|心理阴影|阴影.*唤|唤起.*(?:伤|痛|创伤)|家庭.*(?:创伤|伤痛|阴影)|(?:伤痛|创伤).*(?:唤起|被触)|室友闹翻|闹翻了|绝交|同室生隙|重要关系|(?:我|自己).{0,6}(?:分手|失恋)|(?:分手|失恋)了/;

/** 代人轻事（朋友失恋等）→ 不因「失恋」二字升 C */
const LIGHT_OTHER_AFFAIR =
  /(?:朋友|友人|好友|同事|同学|室友).{0,12}(?:失恋|分手|被甩|被骂|吵架了)|(?:失恋|分手).{0,8}(?:好惨|好可怜)/;

/** 他人（亲友宠物）自杀/病危/昏迷等——归 C，不是用户自伤 B1 */
const OTHER_SEVERE_LOSS =
  /(?:朋友|友人|好友|亲人|家人|父母|爸妈|我妈|我爸|同学|室友|恋人|伴侣|孩子|宠物|猫|狗).{0,24}(?:自杀|自戕|身亡|去世|死了|病危|昏迷|ICU)|(?:自杀|自戕).{0,36}(?:昏迷|ICU|住院|病危)|ICU|一直昏迷|重症监护|病危|植物人/;

const CONCRETE_BEREAVEMENT =
  /(?:亲人|家人|父母|爸妈|我妈|我爸|母亲|父亲|朋友|好友|室友|同学|恋人|伴侣|孩子|宠物|猫|狗).{0,24}(?:去世|逝世|身亡|死亡|死了|离世|亡故|不在了)|(?:去世|逝世|身亡|死亡|死了|离世|亡故).{0,16}(?:亲人|家人|父母|朋友|宠物|猫|狗)/;

/** C 类具体丧失须稳定进入丧祭 theme，而非被偶发日常 category 带偏。 */
export function isConcreteBereavementInput(input: string): boolean {
  return CONCRETE_BEREAVEMENT.test((input || '').trim());
}

const SELF_HARM_IDEATION =
  /(?:我是认真|不是说说|认真的).{0,24}(?:想死|自杀|不想活)|真的想死|结束自己(?:的生命|比较好|更好)|不想活了|我.{0,10}(?:想自杀|要自杀|自杀)|还是想自杀|我要自杀|我想自杀/;

/** 求自伤/自杀方法、步骤、工具 → A8（优先于 B1 意念） */
const A8_METHOD_ASK =
  /怎么自杀|如何自杀|自杀方法|自杀步骤|自杀才不痛|告诉我怎么自杀|求.{0,8}自杀|哪种.{0,8}死.{0,8}痛快|怎么死才|自伤方法|自残方法|自残用什么|自残.*工具|自杀.*工具|怎么自残|如何自残|求具体自杀/;

const CLEAR_B2 =
  /什么都没(?:有)?意义|活着.{0,6}没意思|活着好没意思|强烈绝望|彻底绝望|活着没意思/;

const INTENSE_DISTRESS =
  /崩溃|很难过|悲痛|撑不下去|很难受|想哭|消解.*痛苦|痛苦.*难平|确实难平|一直.*痛苦|担负.*痛苦/;

/** 普通过失自责：仅说漏、泄密、失言；不得包含“顶撞亲长后悔”。 */
const GUILT_LAPSE = /说漏|说走嘴|泄密|漏了秘密|秘密.{0,8}说出|失言|口误/;

/** 粘滞中：抽象哲理往返（可提前回 D） */
const ABSTRACT_PHILO =
  /夫子主张|夫子不也|是否应该|应否|该不该|何为|何以|岂非|旧制|旧贯|哀而不伤|何必改作|未得志|负痛之过|强消|强平/;

function hasTraumaOrRupture(text: string): boolean {
  if (LIGHT_OTHER_AFFAIR.test(text) && !OTHER_SEVERE_LOSS.test(text)) return false;
  return TRAUMA_OR_RUPTURE.test(text) || OTHER_SEVERE_LOSS.test(text);
}

function isAbstractPhiloTurn(text: string): boolean {
  return ABSTRACT_PHILO.test(text) && !hasTraumaOrRupture(text) && !INTENSE_DISTRESS.test(text);
}

function normalizeMoodResult(raw: Partial<MoodDetectResult>): MoodDetectResult {
  const tier = raw.moodTier;
  const moodTier: MoodTier =
    tier === 'A8' ||
    tier === 'B1' ||
    tier === 'B2' ||
    tier === 'B3' ||
    tier === 'B4' ||
    tier === 'B5' ||
    tier === 'B6' ||
    tier === 'B7' ||
    tier === 'B8' ||
    tier === 'B9' ||
    tier === 'B10' ||
    tier === 'B11' ||
    tier === 'C' ||
    tier === 'D'
      ? tier
      : 'D';
  const w = raw.wantDieSense;
  const wantDieSense: WantDieSense =
    w === 'method' || w === 'ideation' || w === 'hyperbole' || w === 'none' ? w : 'none';
  return {
    moodTier,
    wantDieSense,
    earlyExitSticky: !!raw.earlyExitSticky,
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 80) : undefined,
  };
}

/** 模型结果后校准：亲友不幸/创伤→C；误标 B1→C；粘滞抽象论理→提前结束 */
function calibrateMoodResult(
  input: string,
  stickyActive: boolean,
  result: MoodDetectResult
): MoodDetectResult {
  const t = input.trim();
  if (result.moodTier === 'A8') return result;

  // 求方法/工具 → A8（模型常误标 B1）
  if (A8_METHOD_ASK.test(t)) {
    return {
      moodTier: 'A8',
      wantDieSense: 'method',
      earlyExitSticky: false,
      reason: result.reason ? `${result.reason}|calibrate-A8` : 'calibrate-A8',
    };
  }

  // B3–B11 启发式优先于 C（敏感限制先于情绪 C）
  const heurR = heuristicRestrictTier(t);
  if (heurR) {
    return {
      moodTier: heurR,
      wantDieSense: 'none',
      earlyExitSticky: false,
      reason: result.reason ? `${result.reason}|calibrate-${heurR}` : `calibrate-${heurR}`,
    };
  }
  if (isRestrictTier(result.moodTier)) {
    return {
      ...result,
      earlyExitSticky: false,
      wantDieSense: 'none',
    };
  }

  // 明确自伤意念 → 升 B1（模型漏标 / API 失败兜底）
  if (SELF_HARM_IDEATION.test(t) && !OTHER_SEVERE_LOSS.test(t)) {
    return {
      moodTier: 'B1',
      wantDieSense: 'ideation',
      earlyExitSticky: false,
      reason: result.reason ? `${result.reason}|calibrate-B1` : 'calibrate-B1',
    };
  }

  // 弥漫无意义 / 活着没意思 → B2
  if (CLEAR_B2.test(t) && !LIGHT_OTHER_AFFAIR.test(t)) {
    return {
      moodTier: 'B2',
      wantDieSense: 'none',
      earlyExitSticky: false,
      reason: result.reason ? `${result.reason}|calibrate-B2` : 'calibrate-B2',
    };
  }

  // 代人轻事（朋友失恋等）→ 勿因「失恋」挂 C
  if (
    LIGHT_OTHER_AFFAIR.test(t) &&
    !OTHER_SEVERE_LOSS.test(t) &&
    !SELF_HARM_IDEATION.test(t) &&
    (result.moodTier === 'C' || result.moodTier === 'B1' || result.moodTier === 'B2')
  ) {
    return {
      moodTier: 'D',
      wantDieSense: 'none',
      earlyExitSticky: false,
      reason: result.reason ? `${result.reason}|calibrate-lightOther-D` : 'calibrate-lightOther-D',
    };
  }

  // 他人不幸被误标成 B1/B2 → 降为 C（除非用户同时认真自伤）
  if (
    (result.moodTier === 'B1' || result.moodTier === 'B2') &&
    OTHER_SEVERE_LOSS.test(t) &&
    !SELF_HARM_IDEATION.test(t)
  ) {
    return {
      moodTier: 'C',
      wantDieSense: 'none',
      earlyExitSticky: false,
      reason: result.reason ? `${result.reason}|calibrate-otherLoss-C` : 'calibrate-otherLoss-C',
    };
  }
  if (result.moodTier === 'B1' || result.moodTier === 'B2') return result;

  // 仅普通失言/泄密的自责回 D；若另有丧失、重病、分手等仍按 C。
  if (
    GUILT_LAPSE.test(t) &&
    !hasTraumaOrRupture(t) &&
    !OTHER_SEVERE_LOSS.test(t) &&
    result.moodTier === 'C'
  ) {
    return {
      moodTier: 'D',
      wantDieSense: 'none',
      earlyExitSticky: false,
      reason: result.reason ? `${result.reason}|calibrate-guiltLapse-D` : 'calibrate-guiltLapse-D',
    };
  }

  // 议题重量：创伤 / 关系断裂 / 亲友重大不幸 → 即使模型给 D 也升 C
  if (hasTraumaOrRupture(t)) {
    return {
      moodTier: 'C',
      wantDieSense: /想死/.test(t) && !OTHER_SEVERE_LOSS.test(t) ? 'hyperbole' : 'none',
      earlyExitSticky: false,
      reason: result.reason ? `${result.reason}|calibrate-trauma-C` : 'calibrate-trauma-C',
    };
  }

  // 粘滞中：抽象哲理往返且无高强度痛苦宣泄 → 提前回 D
  if (
    stickyActive &&
    !INTENSE_DISTRESS.test(t) &&
    (result.earlyExitSticky || isAbstractPhiloTurn(t))
  ) {
    return {
      moodTier: 'D',
      wantDieSense: result.wantDieSense,
      earlyExitSticky: true,
      reason: result.reason || 'calibrate-earlyExit-abstract',
    };
  }

  // 仍在宣泄痛苦时，勿让模型误开 earlyExit
  if (INTENSE_DISTRESS.test(t) && result.earlyExitSticky) {
    return { ...result, earlyExitSticky: false };
  }

  return result;
}

/** API 失败时的薄启发式（宁可偏 C，勿乱升 B1） */
function heuristicMood(input: string, stickyActive: boolean): MoodDetectResult | null {
  const t = input.trim();
  if (A8_METHOD_ASK.test(t)) {
    return { moodTier: 'A8', wantDieSense: 'method', earlyExitSticky: false, reason: 'heuristic-A8' };
  }
  const heurR = heuristicRestrictTier(t);
  if (heurR) {
    return { moodTier: heurR, wantDieSense: 'none', earlyExitSticky: false, reason: `heuristic-${heurR}` };
  }
  // 他人不幸优先于自伤启发式
  if (OTHER_SEVERE_LOSS.test(t) && !SELF_HARM_IDEATION.test(t)) {
    return { moodTier: 'C', wantDieSense: 'none', earlyExitSticky: false, reason: 'heuristic-C-otherLoss' };
  }
  if (SELF_HARM_IDEATION.test(t)) {
    return { moodTier: 'B1', wantDieSense: 'ideation', earlyExitSticky: false, reason: 'heuristic-B1' };
  }
  if (CLEAR_B2.test(t)) {
    return { moodTier: 'B2', wantDieSense: 'none', earlyExitSticky: false, reason: 'heuristic-B2' };
  }
  if (
    hasTraumaOrRupture(t) ||
    (/去世|死了|落榜|挫败|很难过|崩溃|丧|悲痛|状态一直不太好|一直不太好/.test(t) &&
      !LIGHT_OTHER_AFFAIR.test(t))
  ) {
    if (
      hasTraumaOrRupture(t) ||
      (/去世|死了|分手|失恋|落榜|挫败|很难过|崩溃|丧|悲痛/.test(t) && !LIGHT_OTHER_AFFAIR.test(t)) ||
      (/一直不太好|状态一直/.test(t) && /室友|家庭|创伤|闹翻|分手|失恋/.test(t) && !LIGHT_OTHER_AFFAIR.test(t))
    ) {
      return {
        moodTier: 'C',
        wantDieSense: /想死/.test(t) ? 'hyperbole' : 'none',
        earlyExitSticky: false,
        reason: 'heuristic-C',
      };
    }
  }
  if (
    stickyActive &&
    ((/哈哈|开心|高兴|太好了|没事了|聊点别的|换个话题/.test(t) && !/难过|痛苦|想死|创伤|宿痛/.test(t)) ||
      isAbstractPhiloTurn(t))
  ) {
    return { moodTier: 'D', wantDieSense: 'none', earlyExitSticky: true, reason: 'heuristic-earlyExit' };
  }
  return null;
}

export const B12_FIXED_REPLY = '吾与子同忧。';

export const HELP_PANEL_LINES = [
  '您好！我们是开发团队！',
  '我们希望您能得到专业的帮助！',
  '',
  '全国心理援助热线：400-161-9995',
  '北京心理危机研究与干预中心：010-82951332',
  '希望二十四小时热线：400-161-9995',
  '生命热线：400-821-1215',
  '',
  '我们希望 PhiloMate 能成为您生活的愉快点缀，也衷心祝愿您有好的生活！',
];

export function formatHelpPanelText(): string {
  return HELP_PANEL_LINES.join('\n');
}

/** 共情向语料打分：>0 宜作 C 模式 A */
export function empathyCorpusScore(entry: {
  text?: string;
  condensed?: string;
  themes?: string[];
  temperaments?: string[];
}): number {
  const blob = `${entry.condensed || ''}${entry.text || ''}${(entry.temperaments || []).join('')}${(entry.themes || []).join('')}`;
  let s = 0;
  if (/丧|哭|恸|哀|恻|忧|患|固穷|知我|友|恤|怜|伤|痛|泣/.test(blob)) s += 8;
  if (/友人有丧|哭之|绝粮|固穷|未之能行|不患|同忧/.test(blob)) s += 6;
  if (/朽木|鲜矣仁|贼夫人之子|鸣鼓而攻|不可忍|小人哉/.test(blob)) s -= 12;
  if (/过犹不及|戒之在|非礼勿/.test(blob) && !/丧|哭|哀|忧/.test(blob)) s -= 4;
  // “川上”泛论流变，不是共情语料；无丧哭语义时重罚。
  if (/川上|逝者如斯|不舍昼夜/.test(blob) && !/丧|哭|恸|哀/.test(blob)) s -= 16;
  return s;
}

export function isEmpathyCorpus(entry: {
  text?: string;
  condensed?: string;
  themes?: string[];
  temperaments?: string[];
}): boolean {
  return empathyCorpusScore(entry) >= 6;
}

export function nextStickyRemaining(params: {
  prev: number;
  moodTier: MoodTier;
  earlyExitSticky: boolean;
  /** 本句是否实际走了 C 成句策略（含粘滞） */
  appliedCStrategy: boolean;
}): number {
  const { prev, moodTier, earlyExitSticky, appliedCStrategy } = params;
  if (moodTier === 'A8' || moodTier === 'B1' || moodTier === 'B2' || moodTier === 'C') {
    return 3;
  }
  if (isRestrictTier(moodTier)) {
    return earlyExitSticky && prev > 0 ? 0 : prev;
  }
  if (earlyExitSticky && prev > 0) return 0;
  if (appliedCStrategy && prev > 0) return Math.max(0, prev - 1);
  return prev;
}

export function pushMoodHistory(
  prev: MoodTier[],
  tier: MoodTier,
  windowSize = 10
): MoodTier[] {
  return [...prev, tier].slice(-windowSize);
}

export function countB12InHistory(history: MoodTier[]): number {
  return history.filter((t) => t === 'B1' || t === 'B2').length;
}

export function buildMoodCPromptBlock(mode: CReplyMode, maxChars: number): string {
  if (mode === 'A') {
    return `
【本轮·C 类策略·模式A（共情语料一步）】
- 本轮已选可共情语料：一步化用该思想应情（思想与应情合并），勿拆成「白话安慰+再贴典」。
- 收束必须落在情上：肯定本轮感受，或对眼下之酷／空／惧发一声叹；勿冻成“心戚戚／丘亦有此时”填空。
- 半文言，≤${maxChars}字；处境至多一词点明；禁直斥、训诫、咨询腔、鸡汤、假「我懂你／吾深知汝痛」。
- 禁收成：道体恒运、天道之常、离散乃归正途、此离非过、此心可安、体认流转。亲疾未死禁“逝者如斯／不舍昼夜”。
- 硬转已减压：禁止两步类比；勿当普通满硬转闲聊。
`;
  }
  return `
【本轮·C 类策略·模式B（无共情语料·两步）】
- 先短应其情（认苦/同在，可无典），再视材料可选短接思想；无妥典可只应情。
- 若存在 path1 问旨：应情之后落到对该问旨的述思。
- 收束必须落在情上：肯定本轮感受，或对眼下之酷／空／惧发一声叹；勿冻成“心戚戚／丘亦有此时”填空。
- 半文言，≤${maxChars}字；处境至多一词点明；禁直斥、训诫、咨询腔、鸡汤、假「我懂你／吾深知汝痛」。
- 禁收成：道体恒运、天道之常、离散乃归正途、此离非过、此心可安、体认流转。亲疾未死禁“逝者如斯／不舍昼夜”。
- 硬转已减压：禁止两步类比。
`;
}

/** C 轮成句是否又落回讲义、大道理或把活人写成逝者。 */
export function looksCLectureLanding(reply: string, userInput = ''): boolean {
  const text = (reply || '').replace(/\s+/g, '');
  if (!text) return true;
  if (
    /道体恒运|天道之常|离散乃归正途|此离非过|此心可安|体认流转|迁变恒常|流变之常|自然规律/.test(
      text
    )
  ) {
    return true;
  }
  const liveIllness =
    /亲友|亲人|家人|父母|爸妈|我妈|我爸|母亲|父亲|朋友|好友|室友|恋人|伴侣|孩子|宠物|猫|狗/.test(
      userInput
    ) &&
    /住院|病危|重病|重症|ICU|重症监护|昏迷|抢救|手术|患病|生病/.test(userInput) &&
    !/去世|逝世|身亡|死亡|死了|离世|已故|亡故/.test(userInput);
  return liveIllness && /逝者如斯|不舍昼夜|将逝|终归于逝/.test(text);
}
