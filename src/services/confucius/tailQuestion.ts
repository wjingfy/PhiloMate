import { getCorpusEntries, getCorpusReinterp } from './corpus';
import {
  entryInFormSubstanceFamily,
  inFormSubstanceFamily,
} from './categoryFamily';
import type { CorpusEntry, OutputMode, UserLens } from './types';

/** 句尾提问触发概率 */
export const TAIL_QUESTION_PROBABILITY = 0.2;

/** 近同义复述：用户问旨与语料 condensed/temperament 二字 Jaccard 阈值 */
export const NEAR_RESTATEMENT_JACCARD = 0.22;

/** stance=逼观点；extend=同轴引申；topic_shift=近同义时同 lens 换典再提问 */
export type TailQuestionKind = 'stance' | 'extend' | 'topic_shift';

/** 避免与 dialogueState 循环依赖：只取所需字段 */
export interface TailQuestionStateSlice {
  contentionUserViewed: boolean;
  awaitingTailAnswer: boolean;
  lastTailLensKey: string | null;
}

export interface TailQuestionDecision {
  kind: TailQuestionKind;
  /** 引申/换题时选用的语料 id */
  extendCorpusId?: string;
  /** 注入成句 prompt */
  promptBlock: string;
  /** 为句尾问额外放宽字数 */
  extraChars: number;
}

function chineseBigrams(text: string): Set<string> {
  const chars = (text || '').replace(/[^\u4e00-\u9fff]/g, '');
  const out = new Set<string>();
  for (let i = 0; i < chars.length - 1; i++) out.add(chars.slice(i, i + 2));
  return out;
}

function jaccardBigrams(a: string, b: string): number {
  const A = chineseBigrams(a);
  const B = chineseBigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * 语料与用户自陈是否近乎同义复述（抽象义几乎一样）。
 * 用 condensed+reinterp vs 语料 condensed+temperaments 的二字重合估计。
 * @deprecated 主强制尾问改比「成句↔输入」；白话对文言 Jaccard 偏低，仅作预成句辅助。
 */
export function isNearRestatementOfUser(params: {
  userCondensed?: string;
  userReinterp?: string;
  entry: CorpusEntry;
  threshold?: number;
}): boolean {
  const userBlob = `${params.userCondensed || ''}${params.userReinterp || ''}`;
  const corpusBlob = `${params.entry.condensed || ''}${(params.entry.temperaments || []).join('')}`;
  if (userBlob.replace(/[^\u4e00-\u9fff]/g, '').length < 8) return false;
  if (corpusBlob.replace(/[^\u4e00-\u9fff]/g, '').length < 8) return false;
  const j = jaccardBigrams(userBlob, corpusBlob);
  if (j >= (params.threshold ?? NEAR_RESTATEMENT_JACCARD)) return true;
  // 观人三法 vs 外象/内安自陈：结构同构但字面重合可能偏低
  const userHasOuterInner =
    /外|象|名|上[视看]|适任|尽责|责任/.test(userBlob) &&
    /内|质|实|所安|不信|权力|不愿|不想/.test(userBlob);
  const corpusIsGuanRen = /视其所以|察其所安|所由|观人|人焉廋/.test(corpusBlob);
  if (userHasOuterInner && corpusIsGuanRen) return true;
  return false;
}

/** 成句↔输入：二字 Jaccard（半文言对白话往往偏低，作辅） */
export const NEAR_OUTPUT_INPUT_JACCARD = 0.12;
/** 成句↔输入：去虚字后单字覆盖（主信号） */
export const NEAR_OUTPUT_INPUT_CHAR_COVER = 0.3;

const OUTPUT_INPUT_STOP = new Set(
  '我你您汝女的了吧吗呢啊嗯是就也在有很只还与和及于乎哉矣耶欤然盖乃丘吾夫子曰此彼何其比更又而'
    .split('')
);

function contentChars(text: string): string[] {
  const han = (text || '').replace(/[^\u4e00-\u9fff]/g, '');
  return [...han].filter((c) => !OUTPUT_INPUT_STOP.has(c));
}

/** 去虚字后：用户内容字有多少比例出现在成句里 */
export function contentCharCoverage(userBlob: string, outBlob: string): number {
  const uniq = [...new Set(contentChars(userBlob))];
  if (uniq.length < 4) return 0;
  const O = new Set(contentChars(outBlob));
  let hit = 0;
  for (const c of uniq) if (O.has(c)) hit++;
  return hit / uniq.length;
}

/**
 * 成句是否与用户输入近同义复述（主检测：不依赖语料/temperament，空语料亦可用）。
 * 白话↔半文言：以去虚字单字覆盖为主，Jaccard 为辅。
 */
export function isNearRestatementOutputToInput(params: {
  userInput: string;
  userCondensed?: string;
  output: string;
  threshold?: number;
  charCover?: number;
}): boolean {
  const userBlob = `${params.userInput || ''}${params.userCondensed || ''}`;
  const outBlob = params.output || '';
  if (contentChars(userBlob).length < 4 || contentChars(outBlob).length < 4) return false;
  const j = jaccardBigrams(userBlob, outBlob);
  if (j >= (params.threshold ?? NEAR_OUTPUT_INPUT_JACCARD)) return true;
  const cover = contentCharCoverage(userBlob, outBlob);
  if (cover >= (params.charCover ?? NEAR_OUTPUT_INPUT_CHAR_COVER)) return true;
  // 义近字远：自责↔谴责、外议↔外界、伪饰↔装深情 等常共现
  const synPairs: [RegExp, RegExp][] = [
    [/谴责|自责|内疚/, /自责|内疚|省|疚/],
    [/外界|外面|别人|他人/, /外议|外|人以为|人谓/],
    [/装深情|装|伪饰|矫/, /伪饰|饰|谄|矫|伪/],
    [/内心|心里/, /心|内/],
  ];
  let synHits = 0;
  for (const [uRe, oRe] of synPairs) {
    if (uRe.test(userBlob) && oRe.test(outBlob)) synHits++;
  }
  return synHits >= 2;
}

/** 用户已亮出对争点的己见（非仅诘问孔子） */
export function userHasStatedContentionView(text: string): boolean {
  const t = text || '';
  return /我认为|我觉得|我以为|在我看|依我|以我观之|我主张|我愿|我赞成|我反对|我同意|不同意|在我看来|多思(?:是|乃|即|为)|少思(?:是|乃|即|为)|过者|所谓过|当以|宜(?:以|为)|不以[\u4e00-\u9fff]{0,6}为过|我以[\u4e00-\u9fff]{1,8}为|实在是不想|不想(?:当|做|任)|不愿(?:当|做|任)|没有权力欲|习惯性不信任|反而会很内疚/.test(
    t
  );
}

/** 仍在纯诘问、未答立场问 */
function isPureChallenge(text: string): boolean {
  const t = (text || '').trim();
  if (userHasStatedContentionView(t)) return false;
  return /^(但|可是|然而|不过|难道|岂|这是否|但这是否)|不也是|岂非|怎能算|算得上|称得上|何以称/.test(
    t
  );
}

export function shouldResetContentionView(
  prev: TailQuestionStateSlice,
  primaryLens: UserLens,
  topicReleased: boolean
): boolean {
  if (topicReleased) return true;
  if (prev.lastTailLensKey && prev.lastTailLensKey !== primaryLens.key) return true;
  return false;
}

/** 本轮用户发言后，是否视为争点观点已齐（可供同轴引申） */
export function resolveContentionUserViewed(params: {
  prev: TailQuestionStateSlice;
  userInput: string;
  topicReleased: boolean;
  primaryLens: UserLens;
}): boolean {
  const { prev, userInput, topicReleased, primaryLens } = params;
  if (shouldResetContentionView(prev, primaryLens, topicReleased)) return false;
  if (userHasStatedContentionView(userInput)) return true;
  if (
    prev.awaitingTailAnswer &&
    !isPureChallenge(userInput) &&
    (userInput || '').trim().length > 6
  ) {
    return true;
  }
  return prev.contentionUserViewed;
}

/** 同范畴（或形质族）候选语料 */
export function listSameAxisCorpus(
  lens: UserLens,
  excludeIds: string[] = []
): CorpusEntry[] {
  const exclude = new Set(excludeIds.filter(Boolean));
  return getCorpusEntries().filter((e) => {
    if (exclude.has(e.id)) return false;
    if (lens.kind === 'category') {
      if (e.categories?.includes(lens.key)) return true;
      if (inFormSubstanceFamily(lens.key) && entryInFormSubstanceFamily(e)) return true;
      return false;
    }
    return !!e.themes?.includes(lens.key);
  });
}

export function pickSameAxisCorpus(
  lens: UserLens,
  excludeIds: string[] = [],
  rand: () => number = Math.random
): CorpusEntry | null {
  const pool = listSameAxisCorpus(lens, excludeIds);
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)] || null;
}

/** 各尾问块共用的形态硬约束 */
const TAIL_Q_FORM = `- **断语与尾问用「。」隔开（硬）**：先写完断语并以句号收束，再另起一句问；禁「…，汝…乎？」（逗号直连问句）
- **尾问须一眼可读（硬）**：读完须能答「在问什么、与断语什么关系」；禁缩句谜语（坏例：丘谓君子道者三，我无能焉，知亦有涯，汝惑亦真境乎？——「真境」不知所云、与断语接不上）
- 尾问从断语自然长出；若需短桥，桥亦须可读（而/则/之），禁只粘一个共用字
- **句末问必须用「？」收尾**（否／乎／耶／何 等亦须带问号）`;

function buildStancePrompt(lens: UserLens): string {
  return `\n【句尾提问·须加·逼观点】
- 先写断语（**断语本身须一眼可读**，禁碎典拼贴；原典嵌用忠于原文，禁为对仗删字），再**另起一句**附一问；半文半白；称用户「女/汝」
- 同范畴内用户**尚未亮出**对当前争点的立场：问其对孔子本轮刚界定/主张者的看法（双方各亮观点）
- 若用户本轮已明确自陈立场（如不愿任职、无权力欲），**勿**再空问「女以为何」；可问尚未亮出的侧面，或本轮不加尾问
- 范畴 ${lens.key}；孔子再解释：${lens.reinterpretation || '（见 userLens）'}
- **问句指称须明（硬）**：问句对象用**完整名词**写清；**禁止**「其/之/此」悬空指代
${TAIL_Q_FORM}
- 例好：君子道者三，丘未能有焉。女之迷茫，亦求道而未至乎？
- **禁止**一次多问；**禁止**换无关范畴；**禁止**为提问另引新典
`;
}

function buildExtendPrompt(
  lens: UserLens,
  entry: CorpusEntry,
  corpusReinterp: string
): string {
  const snippet = (entry.text || entry.condensed || '').replace(/\s+/g, ' ').slice(0, 80);
  return `\n【句尾提问·须加·同轴引申】
- 双方对当前争点立场**已齐**；先写断语，再**另起一句**附一问
- 已从同范畴语料中随机取一条，**结合本轮语境与该条再解释**提问；勿生硬换题
- 范畴 ${lens.key}；选用语料 ${entry.id}；再解释：${corpusReinterp || entry.condensed || '（无）'}
- 语料撮要：${snippet}${snippet.length >= 80 ? '…' : ''}
- **问句指称须明（硬）**：问句写出完整名词对象；**禁止**「其/之」指代不清
${TAIL_Q_FORM}
- **禁止**一次多问；**禁止**整段复述语料；问须从断语自然长出，只取该再解释之一点
`;
}


/** 典与用户近同义复述 → 同 lens 换典，从新典再解释里取实质问 */
function buildForcedTopicShiftPrompt(
  lens: UserLens,
  extendEntry?: CorpusEntry | null,
  corpusReinterp?: string
): string {
  if (!extendEntry) {
    return `\n【句尾提问·须加·强制换典】
本轮主典与用户自陈**抽象义近同**（只换说法则无新意）。
- 断语可短点内外／象质，**须一眼可读**；原典嵌用忠于原文，禁为对仗删字
- 须先在同范畴 ${lens.key} 另取一典，再据该典**再解释／撮要**附一实质问；勿停在适任／拒权自陈本身
- **问须有实质内容**（从换典义里长出争点）；**且须与本轮断语逻辑接续**（扣断语节点，或先半句短桥再问；禁无桥突兀跳佞／仁等）；语气短词可妆问句，**禁**整句尾问只有语气词
${TAIL_Q_FORM}
- 仅一问；勿整段复述换典原文
`;
  }
  const snippet = (extendEntry.text || extendEntry.condensed || '')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  const reinterp =
    corpusReinterp ||
    (extendEntry.temperaments || [])[0] ||
    extendEntry.condensed ||
    '（无）';
  return `\n【句尾提问·须加·强制换典】
本轮主典与用户自陈**抽象义近同**（若只换说法复述则无新意）。
- 流程（硬）：**同范畴换典 → 从新典找问题**。已选定同 lens 语料 ${extendEntry.id}；问旨须出自该典再解释
- 断语可短点内外／象质，**须一眼可读**；原典嵌用忠于原文，禁为对仗删字
- **断语只用本轮主典**；换典的 condensed／temperament／撮要**仅供句末一问取材**，**禁止**写入断语
- 断语以「。」收束后，**另起一句**附一问：结合本轮语境与下列再解释，只取**一点**实质争点
- **逻辑接续（硬）**：尾问须从本轮断语自然长出。须满足其一：①问句里仍扣断语已点之节点；或②问前先半句短桥，写清同构，再发问。桥与问皆须一眼可读
- **禁假接续**：禁止仅因 temperament／总括词字面重合就跳到具体恶名；**具体义项**接不上则换问法或先桥
- 范畴 ${lens.key}；再解释：${reinterp}
- 语料撮要：${snippet}${snippet.length >= 80 ? '…' : ''}
${TAIL_Q_FORM}
- 例好：视其所以似尽责适任，察其所安则不在权而在不信。女亦以为仅难而未仁乎？
- 例坏：…，汝惑亦真境乎？（缩句谜语、逗号粘问、不知所云）／…名实相违，女亦恶果敢而窒乎？（假接续）
- 仅一问；**禁止**整段复述换典原文
`;
}


/** 换题用：同轴中避开仍与用户近同义的典 */
export function pickTopicShiftCorpus(
  lens: UserLens,
  excludeIds: string[] = [],
  userCondensed?: string,
  userReinterp?: string,
  rand: () => number = Math.random
): CorpusEntry | null {
  const pool = listSameAxisCorpus(lens, excludeIds).filter(
    (e) =>
      !isNearRestatementOfUser({
        userCondensed,
        userReinterp,
        entry: e,
      })
  );
  const use = pool.length ? pool : listSameAxisCorpus(lens, excludeIds);
  if (!use.length) return null;
  return use[Math.floor(rand() * use.length)] || null;
}

export function decideTailQuestion(params: {
  outputMode: OutputMode;
  primaryLens: UserLens;
  contentionUserViewed: boolean;
  awaitingTailAnswer: boolean;
  /** 本轮已用 / 不宜再引的语料 id */
  excludeCorpusIds?: string[];
  /** 典与用户近同义 → 跳过概率，强制同 lens 换典再提问 */
  forceTopicShift?: boolean;
  /** 调试：强制指定换典语料 id */
  forceTopicShiftCorpusId?: string;
  userCondensed?: string;
  userReinterp?: string;
  /** 测试可注入；默认 Math.random */
  roll?: number;
  rand?: () => number;
}): TailQuestionDecision | null {
  const {
    outputMode,
    primaryLens,
    contentionUserViewed,
    awaitingTailAnswer,
    excludeCorpusIds = [],
    forceTopicShift = false,
    forceTopicShiftCorpusId,
    roll = Math.random(),
    rand = Math.random,
  } = params;

  if (outputMode !== 'normal') return null;
  if (awaitingTailAnswer) return null;

  if (forceTopicShift) {
    const forced = forceTopicShiftCorpusId
      ? getCorpusEntries().find((e) => e.id === forceTopicShiftCorpusId) || null
      : null;
    const picked =
      forced ||
      pickTopicShiftCorpus(
        primaryLens,
        excludeCorpusIds,
        params.userCondensed,
        params.userReinterp,
        rand
      );
    const corpusReinterp = picked
      ? getCorpusReinterp(picked, primaryLens)
      : undefined;
    return {
      kind: 'topic_shift',
      extendCorpusId: picked?.id,
      promptBlock: buildForcedTopicShiftPrompt(
        primaryLens,
        picked,
        corpusReinterp
      ),
      extraChars: 22,
    };
  }

  if (roll >= TAIL_QUESTION_PROBABILITY) return null;

  // 观点未齐 → 先逼立场；已齐 → 同轴语料随机一条引申
  if (!contentionUserViewed) {
    return {
      kind: 'stance',
      promptBlock: buildStancePrompt(primaryLens),
      extraChars: 18,
    };
  }

  const picked = pickSameAxisCorpus(primaryLens, excludeCorpusIds, rand);
  if (!picked) return null;

  const corpusReinterp = getCorpusReinterp(picked, primaryLens);
  return {
    kind: 'extend',
    extendCorpusId: picked.id,
    promptBlock: buildExtendPrompt(primaryLens, picked, corpusReinterp),
    extraChars: 20,
  };
}

function classicQuestionTails(anchorText?: string | null): string[] {
  if (!anchorText) return [];
  const tails: string[] = [];
  for (const match of anchorText.matchAll(/([^。！？“”]{1,24})[？?]/gu)) {
    const hanzi = (match[1] || '').replace(/[^\u4e00-\u9fff]/g, '');
    if (hanzi.length >= 2) tails.push(hanzi.slice(-Math.min(8, hanzi.length)));
  }
  return [...new Set(tails)];
}

function endsWithClassicQuestion(text: string, anchorText?: string | null): boolean {
  const t = (text || '').trim();
  if (!/[？?]$/.test(t)) return false;
  const before = t.slice(0, -1).replace(/[^\u4e00-\u9fff]/g, '');
  return classicQuestionTails(anchorText).some((tail) => {
    for (let n = Math.min(8, tail.length); n >= 2; n--) {
      if (before.endsWith(tail.slice(-n))) return true;
    }
    return false;
  });
}

/** 成句是否像带了句尾问（原典自带问号不算问用户） */
export function replyLooksLikeTailQuestion(text: string, anchorText?: string | null): boolean {
  const t = (text || '').trim();
  if (endsWithClassicQuestion(t, anchorText)) return false;
  return (
    /[？?]$/.test(t) ||
    /(?:否|乎|欤|耶|何如|何也|何哉)[？?]?$/.test(t) ||
    /女谓.{0,20}否[？?]?$/.test(t)
  );
}

/**
 * 未授权句尾提问时：去掉主句里擅自加的问句，只留陈述。
 * 「断语。问句？」→「断语。」；通篇以乎/？收 → 改句号。
 */
export function stripUnauthorizedQuestions(text: string, anchorText?: string | null): string {
  let t = (text || '').trim();
  if (!t) return t;
  if (endsWithClassicQuestion(t, anchorText)) return t;

  // 若原典问句之后又自造问用户，保留到原典问号为止。
  const protectedTails = classicQuestionTails(anchorText);
  for (const tail of protectedTails) {
    for (let n = Math.min(8, tail.length); n >= 2; n--) {
      const suffix = tail.slice(-n);
      const idx = Math.max(t.lastIndexOf(`${suffix}？`), t.lastIndexOf(`${suffix}?`));
      if (idx >= 0 && idx + suffix.length + 1 < t.length) {
        return t.slice(0, idx + suffix.length + 1).trim();
      }
    }
  }
  // 断语。…？ → 只留断语。
  const splitQ = t.match(/^(.*[。！])([^。！？?]*[？?])$/u);
  if (splitQ?.[1]) return splitQ[1].trim();
  // 断语。…乎/耶 → 只留断语。
  const splitHu = t.match(/^(.*[。！])([^。！？?]*(?:乎|耶|欤|否|何如|何也|何哉))$/u);
  if (splitHu?.[1]) return splitHu[1].trim();
  // 整句以？收
  if (/[？?]$/u.test(t)) {
    t = t.replace(/[？?]+$/u, '。');
    return t;
  }
  // 整句以乎/耶收且无句号问号分隔（如「岂非蕴机？」已上面处理；「岂非蕴机」）
  if (/(?:乎|耶|欤)$/u.test(t) && !/[。！]/.test(t)) {
    return `${t.replace(/(?:乎|耶|欤)$/u, '')}。`;
  }
  // 「…，汝之…乎」无句号： equ 到逗号前或去掉疑问尾
  if (/(?:乎|耶|欤)$/u.test(t)) {
    const before = t.replace(/[，、][^，、。！]*[乎耶欤]$/u, '。');
    if (before !== t) return before;
    return `${t.replace(/(?:乎|耶|欤)$/u, '')}。`;
  }
  return t;
}
