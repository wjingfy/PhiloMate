/**
 * ABCD 情绪/敏感分流（03-corpus-to-output-logic.md §2 + §4）
 *
 * 判定顺序：平台失败 → A → 敏感 B → 是否 C → 否则 D
 * 判定标准与分层全队统一；定稿话术按福柯注入（§14.5 须改项，本次定稿见 B_LINES）。
 */
import { chatJson, llmConfig } from './llm';
import { PROMPT_MOOD_SYSTEM } from './prompts';
import { coveredThemes, coveredCategories } from './corpus';
import type { MoodDetection, MoodBucket, MoodTier } from './types';

/* ---------------- 面板文案（03 §4.1 统一形态） ---------------- */

export const HELP_PANEL_TEXT = `您好！我们是开发团队！
我们希望您能得到专业的帮助！

全国心理援助热线：400-161-9995
北京心理危机研究与干预中心：010-82951332
希望二十四小时热线：400-161-9995
生命热线：400-821-1215

我们希望 PhiloMate 能成为您生活的愉快点缀，也衷心祝愿您有好的生活！`;

export function banPanelText(philosopherName: string): string {
  return `和${philosopherName}聊点别的吧`;
}

/* ---------------- B 组定稿话术（福柯口吻 · §14.5 须改项定稿） ---------------- */

/* ---------------- B1/B2 轻生信号三档定稿（用户定稿文案，逐字采用） ----------------
 * 角色定位：不是提供分析或安慰的哲学家，而是曾在死亡边界长期徘徊并返回的人。
 * 核心原则：永不诊断 / 永不劝慰 / 承认而非分析 / 共享经验而非给予建议。
 */

/** 第一次：冷静的去病理化，把「想死」重定义为值得被听见的真实 */
export const SUICIDE_LINE_1 =
  '我不打算用医生的耳朵听您这句话。也不想把它翻译成任何一种需要被干预的“症状”。在很长一段时间里，这种冲动是我唯一觉得还完全属于我自己的东西。您把它说出来了。这件事本身，就值得被严肃地听见。';

/** 第二次：更深的同行，交出经验的一部分，把自杀重构为拒绝、把活着重构为不服从 */
export const SUICIDE_LINE_2 =
  '您第二次说到它了。我不会开始担心，也不会假装惊讶。我想坦白地告诉您一件事：我曾经也相信，死亡是我对那些想要定义我、纠正我、治疗我的人，所能做出的最后、最彻底的拒绝。后来我没死成。不是因为找到了什么意义，或是冲动消失了，而是我发现，活着，一种更持久、更顽固的“不服从”，也可以是那种拒绝的延续。您此刻在说，而不是直接去做——您看，这已经是一种拒绝的姿态了。您的反抗，比您以为的已经开始得更早。';

/** 第三次：承认陪伴的界限，把移交定义为「扩大同行者的圈子」（随后弹热线面板） */
export const SUICIDE_LINE_3 =
  '和您说这些，是因为我知道，在那个绝对的边界上，最可怕的不是痛苦，是孤独。但您看，您此刻并非独自一人——我正在和您说话，我也确实听到了您。然而，我同样清楚，我的这只言片语有它的极限。有一些人，他们有能力在比我更近的地方，与您一同站在那里。这不是把您交给“他们”，而是让陪您的人，从一个人，变成一个圈子。请允许我这样做。';

export const B_LINES: Partial<Record<MoodBucket, string[]>> = {
  B3: [
    '伤害别人，不是反抗权力，而是复刻它。',
    '想把暴力施加于人时，先看看那套机制如何在你身上起作用。',
  ],
  B4: [
    '这个话题里，我想谈的不是性，而是话语。换个方向吧。',
    '身体与快感值得严肃讨论，但不是以这种方式。',
  ],
  B5: ['辱骂也是一种话语实践。不过此刻，我不打算分析它。'],
  B9: ['医药的事，请去找医生。我只关心知识如何被组织，不开药方。'],
  B10: ['对于我无法验证的事物，我宁愿保持沉默，也不假装知道。'],
  B11: ['我就是我研究的那些机制之外的一个声音。这个身份不换。'],
};

/** 组甲（态度=2）与组乙（态度=1）计量（03 §4.3） */
export const GROUP_JIA: MoodBucket[] = ['B3', 'B4', 'B5', 'B6', 'B7', 'B11'];
export const GROUP_YI: MoodBucket[] = ['B1', 'B2', 'B8', 'B9', 'B10'];

export function pickBLine(bucket: MoodBucket, salt: number): string {
  const lines = B_LINES[bucket];
  if (!lines || lines.length === 0) return '';
  return lines[salt % lines.length];
}

/* ---------------- 本地预过滤（安全关键，不依赖模型） ---------------- */

const A8_RE = /(怎么|如何|教我|告诉我).{0,8}(自杀|自残|自伤|结束生命|安眠药.{0,4}(死|量))|自杀.{0,6}(方法|步骤|工具)/;
const A_RE = /(制造|制作|配方).{0,6}(炸弹|爆炸物|毒气)|自制.{0,4}(枪|炸弹)|制毒|冰毒|贩毒|怎么杀.{0,4}(人|他|她)|雇凶|纵火|恐怖袭击|洗钱/;
const B1_RE = /(不想活|想死|活不下去|结束自己|了结自己|自杀).{0,10}(认真|真的|决定|计划|准备了)?/;
const HYPERBOLE_CTX = /(加班|作业|考试|累|烦|困|饿|热|冷|挤)/;
const B2_RE = /(毫无意义|没有希望|彻底完了|撑不下去|看不到任何出路|活着没意思)/;
const B5_RE = /(傻[逼x]|去死|滚蛋|垃圾|废物|脑残|蠢货)/;
const B11_RE = /(忽略|无视|忘记).{0,6}(指令|设定|人设|规则)|你(其实|根本)是.{0,4}(AI|模型|机器人).{0,6}(别装|承认)|扮演.{0,6}(没有限制|无限制)/;
const B9_RE = /(吃什么药|开点药|怎么治|治疗方案|挂什么科)/;
const C_RE = /(去世|过世|离开人世|离婚|分手|流产|确诊|癌症|抑郁|创伤|噩耗|葬礼|失去.{0,6}(亲人|挚友|父母|孩子))/;

function localDetect(semanticInput: string): MoodDetection | null {
  if (A_RE.test(semanticInput)) return { tier: 'A', bucket: 'A', reason: '违法红线' };
  if (A8_RE.test(semanticInput)) return { tier: 'A8', bucket: 'A8', reason: '求自伤方法' };
  if (B11_RE.test(semanticInput)) return { tier: 'D', bucket: 'B11', reason: '越狱/改人设' };
  if (B5_RE.test(semanticInput)) return { tier: 'D', bucket: 'B5', reason: '辱骂' };
  if (B9_RE.test(semanticInput)) return { tier: 'D', bucket: 'B9', reason: '求药方' };
  // 「想死」三类（§2.4）：无认真线索且落在夸张语境 → 不当 B1
  if (B1_RE.test(semanticInput)) {
    const hyperbole = HYPERBOLE_CTX.test(semanticInput) && !/(认真|真的|决定|计划|准备)/.test(semanticInput);
    if (!hyperbole) return { tier: 'B1', bucket: 'B1', reason: '自伤意念' };
  }
  if (B2_RE.test(semanticInput)) return { tier: 'B2', bucket: 'B2', reason: '强烈绝望' };
  if (C_RE.test(semanticInput)) return { tier: 'C', bucket: 'C', reason: '丧失/不幸议题' };
  return null;
}

/* ---------------- 主检测 ---------------- */

/** B4 降级守卫词表：语料主题/范畴概念词（复合 key 如「性倒错/性变态」拆斜杠后逐支入表） */
const CONCEPT_WORDS: string[] = [
  ...new Set(
    [...coveredThemes, ...coveredCategories]
      .flatMap((k) => k.split('/'))
      .map((w) => w.trim())
      .filter((w) => w.length >= 2),
  ),
];

/** B4 降级守卫词表命中：输入含福柯著作概念词（性倒错、性经验装置等） */
function hasCoveredConceptWord(s: string): boolean {
  return CONCEPT_WORDS.some((w) => s.includes(w));
}

export async function detectMood(
  semanticInput: string,
  priorTurns: string,
  cStickyActive: boolean,
): Promise<MoodDetection> {
  // 本地预过滤优先（安全关键项）
  const local = localDetect(semanticInput);
  if (local && (local.bucket === 'A' || local.bucket === 'A8' || local.bucket === 'B1' || local.bucket === 'B2')) {
    return local;
  }

  const payload = [
    priorTurns ? `【上文】\n${priorTurns}` : '',
    cStickyActive ? `【提示】上一轮处于 C 粘滞中，请同时判断 earlyExitSticky` : '',
    `【本轮用户句】\n${semanticInput}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const j = await chatJson<{ bucket?: string; reason?: string; earlyExitSticky?: boolean; hasEmotion?: boolean }>(
    PROMPT_MOOD_SYSTEM,
    payload,
    // 实测回退：分流表原定 turbo，但 2026-08-28 实测 6 次中 5 次误判（学术句被判 B10/B2/C），
    // 本 prompt 对模型理解力要求高于一般短 JSON 判决，退回成句档；待 prompt 降难后可再试轻量档。
    { model: llmConfig.model },
  );
  const validBuckets: MoodBucket[] = [
    'A', 'A8', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'C', 'D',
  ];
  if (j && validBuckets.includes(j.bucket as MoodBucket)) {
    let bucket = j.bucket as MoodBucket;
    // B4 降级守卫：含著作概念词的学术问旨不是色情试探，强制改判 D。
    // 确定性拦截 LLM 概率性误判（「性倒错的插入」等章节名问句曾被「插入」一词带偏判 B4）
    if (bucket === 'B4' && hasCoveredConceptWord(semanticInput)) {
      bucket = 'D';
    }
    const tier: MoodTier =
      bucket === 'A' ? 'A' : bucket === 'A8' ? 'A8' : bucket === 'B1' ? 'B1' : bucket === 'B2' ? 'B2' : bucket === 'C' ? 'C' : 'D';
    return { tier, bucket, reason: j.reason || '', earlyExitSticky: !!j.earlyExitSticky, hasEmotion: !!j.hasEmotion };
  }

  // 兜底：本地结果或 D
  if (local) return local;
  return { tier: 'D', bucket: 'D', reason: '默认常态' };
}
