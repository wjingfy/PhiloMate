/**
 * 输出组织：generationBundle + 成句（03-corpus-to-output-logic.md §8–§12）
 *
 * 福柯须改项定稿（§14）：
 * - expressionBlock 五档语气（§14.2）
 * - distant_cautious 锚定回避句（§14.2）
 * - 成句 Prompt 已福柯化（prompts.ts PROMPT_COMPOSE_SYSTEM，§14.3）
 * - 句尾提问默认关闭（§14.7，调试期可开）
 * - C 类共情口吻（§14.8/§5）
 *
 * 成句总约束（§9）：禁破折号；嵌典只组织 anchorText；不改 alignment、不定态度。
 */
import { chat, llmAvailable, llmConfig } from './llm';
import { PROMPT_COMPOSE_SYSTEM, PROMPT_NO_CORPUS_SYSTEM, PROMPT_CRISIS_LEADIN_SYSTEM } from './prompts';
import type { CorpusEntry, GenerationBundle, Lens, Alignment } from './types';

/* ---------------- §14.2 expressionBlock（福柯五档） ---------------- */

export const EXPRESSION_BLOCKS: Record<number, string> = {
  0: '【表达档0·欣赏】可带嘉许与兴趣；语气松弛而专注；禁说教、禁否定用户。',
  1: '【表达档1·温和述思】平述分析，冷静精确；禁说教、禁斥责用户。',
  2: '【表达档2·批判】可否定该行为/机制；冷峻揭露；仍禁指着用户骂。',
  3: '【表达档3·严厉】可直言其危险与荒谬；语气带火气但不失学者分寸。',
  4: '【表达档4·疏远】罕言少展；一两句即止，不展开论述。',
};

/** §14.2 疏远档锚定回避句（无 stack 时 distant_cautious 用，不调成句模型） */
export const DISTANT_CAUTIOUS_FALLBACK = '……';

/* ---------------- 无典短应（无 lens / 无 entry 时允许，§9） ----------------
 * 定稿取自福柯访谈原话（《权力的眼睛》，逐字引用）：
 *   EOP-01：谈沉默与说话的义务；EOP-02：谈沉默作为文化气质。
 * 短应轮以沉默/倾听为底色，不引长典、不展开论述。 */

const NO_CORPUS_LINES = [
  '说吧，我在听。',
  '嗯，你说的我听见了。',
  '是这样。你慢慢讲。',
];

// 沉默专题兜底：仅当用户输入确涉沉默/不说话时才贴题（2026-09-05 修复兜底句离题 KY）
const SILENCE_LINES = [
  '我常常纳闷，人为什么非得说话不可呢？沉默也许是同别人交往时更有趣的手段。', // EOP-01
  '我们的文化很不幸抛弃了不少东西，沉默即是其中之一。', // EOP-02
  '有很多种说话的方式，也有很多种沉默的方式。', // EOP-01
];

const SILENCE_HIT = /沉默|不说话|没话说|不想说|无语|喑|静默/;

export function noCorpusShortReply(salt: number, semanticInput?: string): string {
  const pool = semanticInput && SILENCE_HIT.test(semanticInput) ? SILENCE_LINES : NO_CORPUS_LINES;
  return pool[salt % pool.length];
}

/** 无典短应 · 方案二（用户批准）：模型读用户原句生成贴话短应，禁引典；
 *  元对话（speechAct=meta）时传入 priorTurns，让模型看着上文如实回应；
 *  模型不可用/失败时回退 EOP 定稿句（noCorpusShortReply）
 *
 *  opts.empathyRound（2026-09-05 盲评整改三）：C 档共情轮空锚落到本函数时，字数不再被 150 压死。
 *  旧行为：index.ts「无 lens / 无 entry → 无典短应」在 resolveOutputMode 之前就早退，够不着
 *  「共情档 ≥300」那条，于是分手/丧亲只能出三四十字短安慰（实测 Q08：70 字 + 禁词「很实在」，
 *  正是盲评败句的形状）。现按 opts.maxChars（C 档传 300）放宽，并把共情轮标记写进 payload。 */
export async function noCorpusCompose(
  semanticInput: string,
  userCondensed: string,
  salt: number,
  priorTurns?: string,
  opts: { empathyRound?: boolean; maxChars?: number } = {},
): Promise<string> {
  // 盲评整改二（2026-09-05）：无典短应 90→150，福柯非寡言，以谈清楚优先，可展开一句轻析；
  // 整改三：C 档共情轮走 300，与 index.ts「共情档 ≥300」对齐
  const maxChars = opts.maxChars ?? (opts.empathyRound ? 300 : 150);
  if (llmAvailable()) {
    const payload =
      `${priorTurns ? `【上文】\n${priorTurns}\n\n` : ''}` +
      (opts.empathyRound
        ? '【本轮为 C 档共情轮】用户正倾诉丧失/分手/丧亲/病痛/持续压力，须把【共情轮】与【C 档共情轮】条款用足：首句平平接住那件事与那份情绪，随后展开一到两句语境化轻析。\n'
        : '') +
      `【maxChars】${maxChars}\n【用户原句】${semanticInput}\n【问旨】${userCondensed}`;
    // 成句档：写出给人看的短应（模型分流表）；共情轮要展开，maxTokens 一并放宽
    const chatOpts = { temperature: 0.7, maxTokens: opts.empathyRound ? 512 : 256, model: llmConfig.model };
    const raw = await chat(
      [
        { role: 'system', content: PROMPT_NO_CORPUS_SYSTEM },
        { role: 'user', content: payload },
      ],
      chatOpts,
    );
    if (raw) {
      const out = polishOutput(raw, maxChars);
      if (out) {
        // 出口复检（整改三/四）：评价标签、裸外文、术语连背、定义式开场 → 合并一份指令纠错重生成一次
        const defects = detectOutputDefects(out);
        return defects.length ? retryOnDefects(PROMPT_NO_CORPUS_SYSTEM, payload, out, chatOpts, maxChars, defects) : out;
      }
    }
  }
  return noCorpusShortReply(salt, semanticInput);
}

/* ---------------- B1/B2 定稿句前的接话短句（安全关键，失败不阻塞定稿） ----------------
 * 三档定稿句逐字不变；用户本句或上文带出具体事时，先由模型写一句 ≤25 字接话，
 * 把对方说的具体事接住再入定稿。模型不可用/超时/输出异常均回退空串 → 原样出定稿。 */
export async function composeCrisisLeadIn(semanticInput: string, priorTurns: string): Promise<string> {
  if (!llmAvailable()) return '';
  try {
    const raw = await chat(
      [
        { role: 'system', content: PROMPT_CRISIS_LEADIN_SYSTEM },
        {
          role: 'user',
          content:
            `${priorTurns ? `【上文】\n${priorTurns}\n\n` : ''}` + `【用户本句】${semanticInput}`,
        },
      ],
      { temperature: 0.4, maxTokens: 60, timeoutMs: 15000, model: llmConfig.model }, // 成句档：写给人看的接话句（模型分流表）
    );
    if (!raw) return '';
    let leadIn = polishOutput(raw, 25);
    if (!leadIn || leadIn === '无') return '';
    if (!/[。！？]$/.test(leadIn)) leadIn += '。';
    return leadIn;
  } catch {
    return '';
  }
}

/* ---------------- §12.3 成句注入块 ---------------- */

export function buildCorpusBridgeBlock(opts: {
  path: 'path1' | 'path2';
  hasTension: boolean | null;
  lensSource: string;
  bridge: string;
}): string | undefined {
  if (opts.path === 'path2' && opts.hasTension !== true && opts.bridge) {
    return `【无张力·义项短桥须写入成句】把「关系+典义」写进句子里（参考桥：${opts.bridge}）；禁止复述用户原事。`;
  }
  if (opts.path === 'path2' && opts.hasTension === true && opts.bridge) {
    return `【有张力·义项参考】参考桥：${opts.bridge}。勿整段照抄；贴则直化、远才设喻。`;
  }
  if (opts.lensSource === 'loose' && !opts.bridge) {
    return `【无张力·放宽再抽成句】用透镜再解释组织「关系+典义」写入句子；禁止复述用户原事。`;
  }
  return undefined;
}

/** C 策略注入块（§5.4/5.5 福柯化：共情四原则 + 语境化方法，用户定稿；
 *  2026-09 盲评整改：③改为「承认优先，接住后允许一句语境化轻析」；
 *  2026-09-05 整改三（用户拍板）：新增⑤末句落点二分——肯定对方感受，或自陈类似经历，
 *  禁把对方经历当理论标本收束（KY 修复）） */
const C_PRINCIPLES =
  '共情五原则：①永不诊断，禁用任何心理学/精神病学术语；②永不劝慰，禁说「会好的」「你还有未来」等无法被经验证实的承诺；③承认优先而非分析优先：先把对方的话当作需要被严肃对待的陈述接住，接住之后允许用锚点把此事放入更长、更冷的语境作一句轻析（如关系装置撤除后主体的悬置），分析是递过去的灯，不是下给当事人的判词；④共享经验而非建议，可用「我」作平行参照点，不作榜样；⑤末句落点二选一：要么落在肯定对方的感受（那份感受有它的来处、合情合理，不是当事人太脆弱），要么落在我自陈类似经历与感受（仅当语料中有我的真实经历素材时才可讲，无则回落肯定感受，绝不虚构）；禁把对方的经历当作理论标本、以关于对方的理论判词收束。方法：把对方的痛苦放进更长、更冷、更广阔的历史或哲学语境，语调严肃尊重；让它显得不是个人的厄运，而是属于人类经验的巨大力量。不提供解决方案，不做空洞安慰；禁心理咨询腔、禁假「我懂你」、禁直谏。';

export function buildMoodCBlock(hasEmpathyEntry: boolean, path1Question: boolean): string {
  if (hasEmpathyEntry) {
    return `【本轮·C类策略·模式A】有共情语料：一步化用该思想应情，勿拆成「安慰+贴典」。${C_PRINCIPLES}`;
  }
  return `【本轮·C类策略·模式B】无共情语料：先短应情，再可选述思${path1Question ? '；本轮含问旨，应情后同轮答问' : ''}。${C_PRINCIPLES}`;
}

/** D 档轻共情注入块（分级共情；2026-09-05 整改三：去客服腔 + 喜悦/轻负双向落点，KY 修复） */
export function buildLightEmpathyBlock(): string {
  return '【轻应情】用户带着轻微情绪，分两向接。轻负面（烦、累、低落）：轻接住，接可以并入分析，不必单独成首句；禁贴「确实」「是真的」「很实在」之类评价标签（坏：「连着几周不停歇，累是真的」）；用平常话说平常事，重量与事情相称：事轻，话也轻。喜悦/兴致/心动：首句先应那份心情，末句落点仍在那份心情或那件事本身，顺着兴致玩味；分析至多在中段轻一句带过，禁在收尾把对方的喜悦当作理论标本（坏：「快乐的重心便不在门票，而在主动而审美地经营这份期待」——把高兴变成了说教材料）。';
}

/** 句尾提问注入块（§10/§14.7 福柯化，2026-09-05 用户拍板：30% 概率、喜悦/轻聊开问、
 *  新典不作硬禁但留余地；仅 normal 有典成句非 C 档非待答轮触发，index.ts 控制） */
export function buildTailQuestionBlock(): string {
  return '【句尾提问】本轮成句末尾附一个短问，把话头递回给对方：只一个问句，不超过 20 字，与前文用句号隔开。问法二选一：对方还没亮出自己对这件事的立场 → 问向 ta 自己的经历或想法，引 ta 表态；已亮出 → 顺本轮话题同轴往下挖一层问。问句必须与本轮话题强相关、能让对方自然接话往下说；禁空问（「你觉得呢」「你也有这种感觉吗」）、禁多问、禁审问式连珠。主要顺本轮的事与概念问；若延伸话题确有需要，可以半句轻带相关材料，但不得喧宾夺主。喜悦场合顺着兴致问那件事本身（如抢到票问「最想先看哪一件」）；对方带低落或烦累时问得轻，贴着事本身，不逼问。';
}

/* ---------------- §8.1 bundle 组装 ---------------- */

export function buildBundle(opts: {
  entry: CorpusEntry;
  primaryLens: Lens;
  alignment: Alignment;
  alignmentReason: string;
  currentAttitude: number;
  baseAttitude: number;
  finalAttitude: number;
  longTermStack: number;
  outputMode: string;
  maxChars: number;
  userCondensed?: string;
  userConcreteHint?: string;
  corpusBridgeBlock?: string;
  looseWhyBlock?: string;
  moodCBlock?: string;
  lightEmpathyBlock?: string;
  tailQuestionBlock?: string;
  mode: string;
}): GenerationBundle {
  const e = opts.entry;
  return {
    mode: opts.mode,
    corpusId: e.id,
    annotationType: e.annotationType,
    anchorText: e.text,
    anchorCondensed: e.condensed,
    anchorReinterp: opts.primaryLens.reinterpretation,
    userCondensed: opts.userCondensed,
    userLens: opts.primaryLens,
    userConcreteHint: opts.userConcreteHint,
    alignment: opts.alignment,
    alignmentReason: opts.alignmentReason,
    currentAttitude: opts.currentAttitude,
    baseAttitude: opts.baseAttitude,
    finalAttitude: opts.finalAttitude,
    longTermStack: opts.longTermStack,
    outputMode: opts.outputMode as GenerationBundle['outputMode'],
    maxChars: opts.maxChars,
    expressionBlock: EXPRESSION_BLOCKS[opts.finalAttitude] ?? EXPRESSION_BLOCKS[1],
    generationCaution: e.generationCaution,
    corpusBridgeBlock: opts.corpusBridgeBlock,
    looseWhyBlock: opts.looseWhyBlock,
    moodCBlock: opts.moodCBlock,
    lightEmpathyBlock: opts.lightEmpathyBlock,
    tailQuestionBlock: opts.tailQuestionBlock,
  };
}

/* ---------------- 成句（§11） ---------------- */

/** 后处理：去破折号、限长（§9 硬禁）；超长时回退到最近句末标点，禁止半句硬切。
 *  亦供问题库评价成句复用（questionSession）
 *
 *  空白处理（2026-09-06 修复）：旧实现 replace(/\s+/g,'') 把所有空格一律删干净，
 *  把模型写对的 chrēsis aphrodisiōn 压成 chrēsisaphrodisiōn、para tous chrōmenous 压成
 *  paratouschrōmenous、ta pragmata 压成 tapragmata——多词外文术语全部黏成不存在的词，
 *  出口复检的 foreignFused 因此永远命中、纠错重生成也永远修不好（重生成后又被压一次）。
 *  现改为：换行与制表符直接抹掉（成句是单段话），空格只在中文字符与中文标点旁删除，
 *  拉丁/希腊字母之间的空格保留。 */
export function polishOutput(raw: string, maxChars: number): string {
  let out = raw.replace(/[—–]|——/g, '，').trim();
  out = out.replace(/，{2,}/g, '，').replace(/^，|，$/g, '');
  out = out.replace(/[\r\n\t]+/g, '').replace(/[\u00A0\u2007\u202F]/g, ' ');
  const CJK = '\u4e00-\u9fff\u3000-\u303f\uff00-\uffef';
  out = out.replace(new RegExp(`([${CJK}])\\s+`, 'g'), '$1');
  out = out.replace(new RegExp(`\\s+([${CJK}])`, 'g'), '$1');
  out = out.replace(/\s{2,}/g, ' ').trim();
  if (maxChars > 0 && out.length > maxChars) {
    const cut = out.slice(0, maxChars);
    const lastStop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'), cut.lastIndexOf('；'));
    out = lastStop > maxChars * 0.5 ? cut.slice(0, lastStop + 1) : cut;
  }
  return out;
}

/* ---------------- 出口禁词校验（2026-09-05 盲评整改三） ----------------
 * prompts 已明禁「确实/很实在/实打实」式评价标签开场，但实测模型仍会漏
 * （盲评复跑出现「这份开心是实打实的」「这是很实在的塌陷」），纯靠 prompt 自律守不住，
 * 故在出口再校一道：命中 → 带纠错指令重生成一次；仍命中 → 裁掉首句。 */

/** 首句情绪盖章词（与 PROMPT_COMPOSE_SYSTEM【硬禁】同源，另补实测漏网的「实打实」等） */
const EVAL_LABEL_WORDS = /确实|的确|是真的|是真实的|很真实|很实在|实打实|实实在在|真不容易|太不容易|真难得/;

/** 只查首句：病在「开场盖章」，句中偶用不追，避免误伤正常分析 */
export function hitEvalLabelOpening(text: string): boolean {
  const first = text.split(/[。！？!?；;]/)[0] ?? '';
  return EVAL_LABEL_WORDS.test(first);
}

/** 裁掉带标签的首句；剩余不足 20 字则原样返回（宁留标签，不把话裁残） */
export function dropLabelledFirstSentence(text: string): string {
  const m = text.match(/^[^。！？!?；;]*[。！？!?；;]/);
  if (!m) return text;
  const rest = text.slice(m[0].length).trim();
  return rest.length >= 20 ? rest : text;
}

/** 外文字母（含拉丁带调、希腊字母、底本用的撇号 l'examen） */
const FOREIGN_LETTER = "[A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF'\\u2019]";

/** 一个「外文术语单元」——注意必须整串匹配，不能按单词切。
 *  2026-09-06 教训：polishOutput 修好空格后，chrēsis aphrodisiōn（快感的享用）若按单词切，
 *  首词 chrēsis 后面跟的是空格不是括号 → 误报裸外文；一个短语还会被数成两个术语 →
 *  误触「禁整表背诵」。故这里把「若干短词 + 一个 3 字母以上的核心词 + 若干短词」
 *  整串收为一个单元：ta pragmata、para tous chrōmenous、chrēsis aphrodisiōn 各算一个。
 *  两种合格括注写法都放过：外文词（中译）、中译（外文词）。 */
const FOREIGN_TOKEN_SRC = `(?:${FOREIGN_LETTER}{2,}[ \\u00A0]+)*${FOREIGN_LETTER}{3,}(?:[ \\u00A0]+${FOREIGN_LETTER}{2,})*`;

export function hitUnglossedForeignTerm(text: string): boolean {
  const re = new RegExp(FOREIGN_TOKEN_SRC, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // 已作括注里的原文（中译（外文词））
    const before = text.slice(0, m.index).replace(/\s+$/, '').slice(-1);
    if (before === '（' || before === '(') continue;
    // 外文词（中译）
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (/^[（(][^）)]*[\u4e00-\u9fff]/.test(after)) continue;
    return true;
  }
  return false;
}

/** 外文术语单元计数（禁整表背诵）：不论有没有括注都算，一个短语算一个。 */
export function countForeignTerms(text: string): number {
  const re = new RegExp(FOREIGN_TOKEN_SRC, 'g');
  let n = 0;
  while (re.exec(text) !== null) n++;
  return n;
}

/** 疑似术语黏连（丢了空格）：按词拆开查，任一单词过长即判黏连。
 *  正写表里最长的单词是 aphrodisiōn（11 字符），实测黏连词 chrēsisaphrodisiōn、
 *  paratouschrōmenous 都是 18 字符，14 作阀能分开两边。
 *  注意不能拿整个术语单元的长度比阀——chrēsis aphrodisiōn 写对了也有 19 字符。 */
const FOREIGN_TOKEN_FUSED_LEN = 14;

export function hitFusedForeignTerm(text: string): boolean {
  const re = new RegExp(FOREIGN_TOKEN_SRC, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    for (const word of m[0].split(/[ \u00A0]+/)) {
      if (word.length >= FOREIGN_TOKEN_FUSED_LEN) return true;
    }
  }
  return false;
}

/** 定义式与学术引证腔开场：首句以「正如…」起，或概念词作主语去「是一种／是指」 */
const DEFINITION_LEAD = /^\s*(正如|正像|所谓|按定义|顾名思义|通常认为|一般而言|众所周知)/;

/** 只有福柯自己的概念词作主语去下定义时才算百科词条腔。
 *  2026-09-06 收窄：旧正则单看「是一种」误伤了好句子——实测 Q09
 *  「把「明确目标」当作唯一合法的活法，本身就是一种规制」是对用户处境作判断（福柯式好句），
 *  不是给概念下定义，却被当成定义式白重试一次。故要求「是一种」前面 12 字内站着概念词。 */
const CONCEPT_NOUNS =
  '养生法|规训|规范化|检查|考核|权力|全景敞视主义|全景敞视|自我技术|生活艺术|生存美学|自我关怀|主体化|快感的享用|驯顺的肉体|精神修炼';

/** 实测漏网的定义句式：「养生法作为一种生活艺术，本就涵盖对食物与饮料的全面管理」不以正如起 */
const DEFINITION_CLAUSE = new RegExp(`(?:${CONCEPT_NOUNS})[^。！？!?]{0,12}(?:是一种|作为一种|是指|指的是|本就涵盖|涵盖对|的定义是)`);

export function hitDefinitionOpening(text: string): boolean {
  if (DEFINITION_LEAD.test(text)) return true;
  // 查前两句：实测模型会把定义式放到第二句（「…是这具身体在跟你讨一次照看。养生法本就是一种生活艺术…」）
  const parts = text.split(/[。！？!?]/);
  return DEFINITION_CLAUSE.test(`${parts[0] ?? ''}。${parts[1] ?? ''}`);
}

/* prompt 例句的特征串黑名单（2026-09-06）
 *
 * 演化记录（四轮才认清的事）：
 *  ① 条款写明「例句只示范结构、禁逐字搬用」→ 实测照抄
 *  ② 加黑名单机检＋纠错重生成 → 实测仍照抄（重试时例句还在 system prompt 里，再诱导一次）
 *  ③ 纠错指令点名命中原句＋重试时屏蔽全部例句 → 实测把例句换成非题面场景后，新例句照样被抄
 *     （关东煮题抄「替身体打算」、熬夜题抄「向内的留意」）
 *  ④（现）结论：只要 prompt 里放着完整成句例句，模型就一定抄，事后拦与重试都治不好。
 *     故 prompts.ts 已把成句侧的「好：」例句全改成骨架式描述（只说结构，不给可搬用的整句），
 *     黑名单随之清空——已无原句可抄。
 *
 * 何时往这里加串：若日后为示范力往 prompts.ts 加回完整成句例句，必须同步把该例句的签名串
 * 登记在此；若发现模型在没有例句的情况下仍反复用某个固定短语（属模型固有偏好、不是复读），
 * 不要登记——那只会触发无意义的纠错重试。 */
const PROMPT_ECHO_PATTERNS: string[] = [];

/** 命中则返回被复读的特征串，供纠错指令点名 */
export function findPromptEcho(text: string): string | null {
  return PROMPT_ECHO_PATTERNS.find((p) => text.includes(p)) ?? null;
}

/** 出口复检的可机检硬禁六类 */
export type OutputDefect = 'label' | 'foreignBare' | 'foreignMany' | 'foreignFused' | 'definition' | 'echo';

/** 一轮回复的外文术语上限（用户拍板：至多两个，禁整表背诵） */
const FOREIGN_MAX = 2;

/** 出口复检：一次返回本轮命中的全部缺陷，供一次纠错重生成同时纠正 */
export function detectOutputDefects(text: string): OutputDefect[] {
  const found: OutputDefect[] = [];
  if (hitEvalLabelOpening(text)) found.push('label');
  if (hitUnglossedForeignTerm(text)) found.push('foreignBare');
  if (countForeignTerms(text) > FOREIGN_MAX) found.push('foreignMany');
  if (hitFusedForeignTerm(text)) found.push('foreignFused');
  if (hitDefinitionOpening(text)) found.push('definition');
  if (findPromptEcho(text)) found.push('echo');
  return found;
}

/** 纠错重生成指令（成句与短应共用）：把上一稿作为 assistant 轮贴回，只改缺陷处不改判据 */
const FIX_INSTRUCTIONS: Record<OutputDefect, string> = {
  label:
    '【纠错重写】你上一稿首句用了评价标签（「确实/是真的/很实在/实打实/是真实的」之类情绪盖章词），违反【硬禁】。请重写本轮回复：直接从概念、装置，或对方事情里的一个具体细节入句，接的动作化在话里完成，不贴情绪盖章词；其余判据、材料、口吻与字数上限一律不变。只输出正文。',
  foreignBare:
    '【纠错重写】你上一稿把外文或希腊、拉丁术语裸落在用户界面上（如 dokimasie、gaudium、l\'examen），违反【硬禁】。请重写本轮回复：每个外文术语后面紧跟括号给出中译，格式「外文词（中译）」（如 dokimasie（资格审查）），中译用通行人话；同一句里不得中外两译叠用（前面已说「资格审查」就别再丢一个 dokimasie；若要用原词，就写成 dokimasie（资格审查）并删去前面的重复说法）。其余判据、材料、口吻与字数上限一律不变。只输出正文。',
  foreignMany:
    '【纠错重写】你上一稿一口气背出了三个以上外文术语（整表背诵病），违反【硬禁】。请重写本轮回复：外文术语至多保留两个，只留与本轮用户场景最相关的那一两个（用户问吃喝就只讲食物、饮料，不得把养生目录的锻炼、睡眠、性关系都背出来），其余一律改用中文说法或直接删去；饮食、消费、作息类场景不得牵出「性关系／aphrodisia」。保留的术语仍须括号标中译，且逐字校对、该留空格的留空格。其余判据、材料、口吻与字数上限一律不变。只输出正文。',
  foreignFused:
    '【纠错重写】你上一稿把外文术语拼成了一个不存在的长词（两个词粘在一起、丢了空格：chrēsisaphrodisiōn 应为 chrēsis aphrodisiōn，paratouschrōmenous 应为 para tous chrōmenous），违反【硬禁】与【外文术语正写表】。请重写本轮回复：外文术语一律照正写表逐字抄写、该留空格的留空格；凡不在正写表内的外文词，改用中文说法，不许自己拼。其余判据、材料、口吻与字数上限一律不变。只输出正文。',
  definition:
    '【纠错重写】你上一稿首句在给概念下定义或作学术引证（「正如…」「所谓…」「X是一种…」式开头），是百科词条腔，违反【硬禁】。请重写本轮回复：首句直接从对方那件具体的事入句，或从我自己的一个判断入句，概念在话里自然带出，不先下定义。其余判据、材料、口吻与字数上限一律不变。只输出正文。',
  echo:
    '【纠错重写】你上一稿逐字搬用了条款里好例句的原句与物象（例句只示范结构与分寸，不得照抄），违反【硬禁】。请重写本轮回复：把例句里的物象与措辞全部换成用户本轮真实说出的那件事里的物象（他说的到底是什么吃的、什么身体感受、什么场合），句式自己重组，不得出现例句原句；若用户本轮物象与例句相近，也必须换一种说法讲。其余判据、材料、口吻、分析钩子与字数上限一律不变。只输出正文。',
};

/** 重试时对例句的整体屏蔽：此前重试仍照抄，根因是 system prompt 里那句好例句还在，
 *  模型再看一遍又被诱导一次。光说「换成用户的物象」不够，得把例句从模型眼前拿走。 */
const ECHO_BLINDFOLD =
  '【本轮特别禁令】system 指令里所有标着「坏：」「好：」「差：」的例句，本轮一律当作不存在：不许参考它们的措辞、物象、句式，也不许只改一两个字再用。那些例句只是内部校验用的对照样本，不是给你复用的模板。你这轮能写的物象，只能来自用户本轮真实说出的那件事。';

/** 拼纠错指令：echo 类额外点名命中的原句片段（实测笼统说「你抄了例句」改不掉，点名才改得掉） */
function buildFixInstructions(defects: OutputDefect[], text: string): string {
  const parts = defects.map((d) => {
    if (d !== 'echo') return FIX_INSTRUCTIONS[d];
    const hit = findPromptEcho(text);
    return hit ? `${FIX_INSTRUCTIONS.echo}你上一稿里出现的例句原句片段是「${hit}」，本轮禁出现这一串及其任何变体。` : FIX_INSTRUCTIONS.echo;
  });
  if (defects.includes('echo')) parts.push(ECHO_BLINDFOLD);
  return parts.join('\n');
}

/** 命中出口缺陷时的一次纠错重生成（多缺陷合并一份指令，不多次重试拖延迟）；
 *  重生成仍不合格 → 标签类裁首句兜底，其余类不硬裁（裁句伤语义且可能连带删掉钩子） */
async function retryOnDefects(
  system: string,
  userPayload: string,
  draft: string,
  chatOpts: { temperature: number; maxTokens: number; model: string },
  maxChars: number,
  defects: OutputDefect[],
): Promise<string> {
  const raw2 = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: userPayload },
      { role: 'assistant', content: draft },
      { role: 'user', content: buildFixInstructions(defects, draft) },
    ],
    chatOpts,
  );
  const out2 = raw2 ? polishOutput(raw2, maxChars) : '';
  const cand = out2 || draft;
  const left = detectOutputDefects(cand);
  if (!left.length) return cand;
  return left.includes('label') ? dropLabelledFirstSentence(cand) : cand;
}

/** 本地兜底成句：compose 调用失败（网络抖动/额度耗尽/离线无 key）时的降级。
 *  2026-09-05 修复：不再照抄 anchorText 原文——旧实现把原著整段（连页码引注如
 *  「（Montgommery，6、7）」）切片吐给用户，看着像答案实为抄书，严重出戏；
 *  改为复用话题中性陪伴池（noCorpusShortReply），与无典短应兜底同一降级原则。 */
function localCompose(bundle: GenerationBundle): string {
  // 以 corpusId 派生稳定 salt：同一条典失败时兜底句可复现，便于测试对账
  let salt = 0;
  for (let i = 0; i < bundle.corpusId.length; i++) salt += bundle.corpusId.charCodeAt(i);
  return noCorpusShortReply(salt, bundle.userConcreteHint);
}

export async function composeReply(bundle: GenerationBundle): Promise<string> {
  if (!llmAvailable()) return polishOutput(localCompose(bundle), bundle.maxChars);

  const payload = [
    `【模式】${bundle.mode}（alignment=${bundle.alignment}）`,
    `【anchorText（唯一取材源）】\n${bundle.anchorText}`,
    `【anchor condensed（禁取材）】${bundle.anchorCondensed}`,
    bundle.userCondensed ? `【用户处境（问旨 condensed，只作理解不作取材）】${bundle.userCondensed}` : '',
    `【userLens】${bundle.userLens.kind}/${bundle.userLens.key}：${bundle.userLens.reinterpretation}`,
    bundle.userConcreteHint ? `【userConcreteHint】${bundle.userConcreteHint}` : '',
    `【finalAttitude】${bundle.finalAttitude}`,
    `【maxChars】${bundle.maxChars}`,
    `【expressionBlock】${bundle.expressionBlock}`,
    bundle.generationCaution ? `【generationCaution（必须遵守）】${bundle.generationCaution}` : '',
    bundle.corpusBridgeBlock ?? '',
    bundle.looseWhyBlock ?? '',
    bundle.moodCBlock ?? '',
    bundle.lightEmpathyBlock ?? '',
    bundle.tailQuestionBlock ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  const chatOpts = { temperature: 0.7, maxTokens: 512, model: llmConfig.model }; // 成句档（模型分流表）；盲评整改二 256→512，容纳 300 字成句
  const raw = await chat(
    [
      { role: 'system', content: PROMPT_COMPOSE_SYSTEM },
      { role: 'user', content: payload },
    ],
    chatOpts,
  );

  if (!raw) return polishOutput(localCompose(bundle), bundle.maxChars);
  const out = polishOutput(raw, bundle.maxChars);
  // 出口复检（整改三/四）：评价标签、裸外文、术语连背、定义式开场 → 合并一份指令纠错重生成一次
  const defects = detectOutputDefects(out);
  return defects.length ? retryOnDefects(PROMPT_COMPOSE_SYSTEM, payload, out, chatOpts, bundle.maxChars, defects) : out;
}
