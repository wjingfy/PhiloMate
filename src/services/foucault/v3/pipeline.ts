/**
 * 选典管线（02-input-corpus-match-logic.md 完整控制流）
 *
 * 流程（与文档 §2 总流程同序）：
 *   0. 预处理（去句首客套笑）→ semanticInput
 *   1. Step 0.5 问旨 → condensed（必含意图）+ relation + speechAct
 *   2. Step 0  路由 → path1 | path2
 *   3. Step 1  严格透镜（fixedCondensed=问旨 condensed）→ lenses + hasTension
 *   4. Step 1b path2 且 hasTension≠true → 清空 → 放宽再抽（可二次 avoid）
 *   5. Step 1c sanitize → primaryLens；无 → 无典
 *   6. Step 2  同 key 池 → 义项裁决（最多 3 轮换条，末轮强制择一）
 *   7. Step 2b 无 entry → 无典
 *   8. 交出 §9 对象
 *
 * 每步 LLM 失败均有本地兜底（02 §4.4 精神），保证无密钥也能跑通控制流。
 */
import { chatJson, llmAvailable, llmConfig } from './llm';
import {
  PROMPT_ASK_INTENT_SYSTEM,
  PROMPT_ROUTE_SYSTEM,
  PROMPT_LENS_SYSTEM,
  buildLensLoosePrompt,
  PROMPT_CORPUS_FIT_SYSTEM,
  PROMPT_CORPUS_FIT_MUST_PICK,
} from './prompts';
import {
  poolByLens,
  getEntryById,
  coveredThemeSet,
  coveredCategorySet,
  coveredThemes,
  coveredCategories,
  getReinterpretationSource,
  matchProperName,
} from './corpus';
import type {
  Path,
  Lens,
  LensSource,
  LensExtractResult,
  CorpusEntry,
  CorpusMatchOutput,
  AskIntentResult,
  DialogueState,
} from './types';

const MAX_POOL = 24;
const MAX_REPICKS = 3;

/* ---- 丧失/分手识别（2026-09-05 盲评整改三，供 selectCorpus 步骤 6b 硬注入用）----
 * 只认长期亲密关系的撤除（分手、丧亲、绝交），不认一般不如意；
 * 宁窄勿宽：误命中会把普通日常题硬推向主体化池。 */
const BEREAVEMENT_LENS_KEY = '主体化';
const BEREAVEMENT_DIRECT = /分手|离婚|丧亲|丧偶|去世|离世|过世|病逝|病故|永别|阴阳两隔|天人永隔|绝交|断交|不在了/;
const BEREAVEMENT_PERSON_LEFT = /(爸|妈|父|母|爷爷|奶奶|外公|外婆|哥哥|姐姐|弟弟|妹妹|对象|男友|女友|丈夫|妻子|老公|老婆|爱人|伴侣|挚友|好友|他|她).{0,8}(走了|离开了|没能留住|再也|撒手)/;

export function isBereavementInput(text: string): boolean {
  return BEREAVEMENT_DIRECT.test(text) || BEREAVEMENT_PERSON_LEFT.test(text);
}

/** 0 · 预处理：去句首客套笑/寒暄前缀 */
export function preprocessInput(raw: string): string {
  return raw
    .replace(/^(?:哈哈+|嘿嘿+|呵呵+|嗯+|呃+)[，,。.!！\s]*/, '')
    .trim();
}

/**
 * 纯应酬语识别（问候/打招呼/在吗）：无实质内容，不进选典，走无典短应（03 §13）。
 * 防止 LOOSE 放宽对空内容输入强行套范畴导致答非所问。
 */
const PHATIC_RE =
  /^((你好|您好)(呀|啊|哦)?|嗨|哈喽|哈啰|hello|hi|hey|早上好|早安|午安|下午好|晚上好|晚安|在吗|在不在|喂|嘿)[!！。.~～，,？?\s]*$/i;

export function isPhaticInput(semanticInput: string): boolean {
  return semanticInput.length <= 12 && PHATIC_RE.test(semanticInput);
}

/* ================================================================
   1 · 问旨（Step 0.5）
   ================================================================ */

async function askIntent(
  semanticInput: string,
  priorTurns: string,
): Promise<AskIntentResult> {
  const userPayload = priorTurns
    ? `【上文】\n${priorTurns}\n\n【本轮用户句】\n${semanticInput}`
    : `【无上文】\n\n【本轮用户句】\n${semanticInput}`;

  const j = await chatJson<AskIntentResult>(PROMPT_ASK_INTENT_SYSTEM, userPayload, {
    model: llmConfig.model, // 成句档：需理解整句（模型分流表）
  });
  if (j && typeof j.condensed === 'string' && j.condensed.length >= 4) {
    return {
      condensed: j.condensed,
      relation: ['same_focus', 'follow_cue', 'shift'].includes(j.relation) ? j.relation : 'same_focus',
      speechAct: ['continue', 'rebuttal', 'consistency', 'refinement', 'question', 'meta'].includes(j.speechAct)
        ? j.speechAct
        : 'continue',
      cueFromAssistant: typeof j.cueFromAssistant === 'string' ? j.cueFromAssistant : null,
    };
  }
  // 本地兜底（02 §4.4）：原句前段作 condensed，仍尽量可读
  const fallbackCondensed = semanticInput.length > 48 ? semanticInput.slice(0, 48) : semanticInput;
  return { condensed: fallbackCondensed, relation: 'same_focus', speechAct: 'continue', cueFromAssistant: null };
}

/* ================================================================
   2 · 路由（Step 0）
   ================================================================ */

/** 本地兜底路由：命中核心思想域词表 → path1 */
function localRoute(semanticInput: string): Path {
  const hit = coveredThemes.some((t) => semanticInput.includes(t)) ||
    coveredCategories.some((c) => semanticInput.includes(c));
  return hit ? 'path1' : 'path2';
}

async function routeInput(semanticInput: string): Promise<{ path: Path; pathReason: string }> {
  const j = await chatJson<{ path?: string; pathReason?: string }>(
    PROMPT_ROUTE_SYSTEM,
    `【用户输入】\n${semanticInput}`,
    { model: llmConfig.routeModel }, // 轻量档：短 JSON 分流（模型分流表）
  );
  if (j && (j.path === 'path1' || j.path === 'path2')) {
    return { path: j.path, pathReason: j.pathReason || '' };
  }
  return { path: localRoute(semanticInput), pathReason: '本地兜底' };
}

/* ================================================================
   3 · 严格透镜（Step 1）+ sanitize（§5.4）
   ================================================================ */

/** 本地兜底透镜：path1 扫 theme 词表；path2 找成对结构信号词 */
const TENSION_SIGNALS: { key: string; words: string[] }[] = [
  { key: '全景敞视主义', words: ['盯着', '监视', '被看', '看着', '摄像头', '定位', '注视', '注视下'] },
  { key: '规范化', words: ['标准', '达标', '考核', '排名', '打分', '评比', '合格', '不合格'] },
  { key: '考核/检查', words: ['检查', '考试', '抽查', '点名', '打卡'] },
  { key: '规训', words: ['作息', '时间表', '操练', '训练', '军训', '排队'] },
];

function localLens(semanticInput: string, path: Path, condensed: string): LensExtractResult {
  const lenses: Lens[] = [];
  if (path === 'path1') {
    for (const t of coveredThemes) {
      if (semanticInput.includes(t)) {
        lenses.push({ kind: 'theme', key: t, reinterpretation: condensed.slice(0, 12) });
        if (lenses.length >= 2) break;
      }
    }
  } else {
    for (const sig of TENSION_SIGNALS) {
      if (sig.words.some((w) => semanticInput.includes(w)) && coveredCategorySet.has(sig.key)) {
        lenses.push({ kind: 'category', key: sig.key, reinterpretation: '被注视与被规制的一侧' });
        break;
      }
    }
  }
  return {
    input: semanticInput,
    path,
    condensed,
    hasTension: path === 'path2' ? lenses.length > 0 : false,
    lenses,
    primaryLensIndex: 0,
  };
}

/** sanitize（§5.4）：丢非法/无覆盖 key；修正 primary；path2 无张力强制清空
 * fromLoose=true：放宽轮结果不走「path2 无张力清空」（否则 LOOSE 永空），
 * 且共情轮（allowTheme）允许 theme 通过 */
function sanitizeLens(r: LensExtractResult, opts?: { fromLoose?: boolean; allowTheme?: boolean }): LensExtractResult {
  let lenses = (r.lenses || []).filter((l) => {
    if (!l || typeof l.key !== 'string') return false;
    if (l.kind === 'theme') {
      if (r.path === 'path2' && !(opts?.fromLoose && opts?.allowTheme)) return false; // path2 themes 禁用（共情放宽轮除外）
      return coveredThemeSet.has(l.key);
    }
    if (l.kind === 'category') return coveredCategorySet.has(l.key);
    return false;
  });

  let hasTension = !!r.hasTension;
  if (r.path === 'path2' && hasTension !== true && !opts?.fromLoose) {
    lenses = [];
    hasTension = false;
  }
  // path1 已有 theme 则 primary 必须是 theme
  if (r.path === 'path1' && lenses.some((l) => l.kind === 'theme')) {
    const ti = lenses.findIndex((l) => l.kind === 'theme');
    const idx = typeof r.primaryLensIndex === 'number' && lenses[r.primaryLensIndex] ? r.primaryLensIndex : ti;
    return { ...r, lenses, hasTension, primaryLensIndex: lenses[idx].kind === 'theme' ? idx : ti };
  }
  let pi = typeof r.primaryLensIndex === 'number' ? r.primaryLensIndex : 0;
  if (pi < 0 || pi >= lenses.length) pi = 0;
  return { ...r, lenses, hasTension, primaryLensIndex: pi };
}

async function strictLens(
  semanticInput: string,
  path: Path,
  fixedCondensed: string,
): Promise<LensExtractResult> {
  const payload = [
    `【用户输入】\n${semanticInput}`,
    `【fixedCondensed（condensed 必须逐字采用）】\n${fixedCondensed}`,
    `【path】${path}`,
  ].join('\n\n');
  const j = await chatJson<LensExtractResult>(PROMPT_LENS_SYSTEM, payload, {
    model: llmConfig.model, // 成句档：透镜不算轻量，选错成句救不回（模型分流表）
  });
  if (j && Array.isArray(j.lenses)) {
    return sanitizeLens({ ...j, path, condensed: fixedCondensed, input: semanticInput });
  }
  return sanitizeLens(localLens(semanticInput, path, fixedCondensed));
}

/* ================================================================
   4 · 放宽再抽（Step 1b）
   ================================================================ */

async function looseLens(
  semanticInput: string,
  fixedCondensed: string,
  avoid: string[],
  opts?: { allowTheme?: boolean },
): Promise<LensExtractResult | null> {
  const payload = [
    `【用户输入】\n${semanticInput}`,
    `【fixedCondensed（condensed 必须逐字采用）】\n${fixedCondensed}`,
  ].join('\n\n');
  const j = await chatJson<LensExtractResult>(buildLensLoosePrompt(avoid, !!opts?.allowTheme), payload, {
    model: llmConfig.model, // 成句档：放宽再抽同属透镜步（模型分流表）
  });
  if (j && Array.isArray(j.lenses)) {
    // fromLoose：跳过 path2 无张力清空；共情轮另放 theme 通过
    const r = sanitizeLens(
      { ...j, path: 'path2', hasTension: false, condensed: fixedCondensed, input: semanticInput },
      { fromLoose: true, allowTheme: !!opts?.allowTheme },
    );
    return r.lenses.length > 0 ? r : null;
  }
  return null;
}

/** 本地兜底 LOOSE：把整句当喻体；共情轮优先指向访谈语料的共情主题池 */
function localLoose(fixedCondensed: string, preferEmpathy?: boolean): LensExtractResult | null {
  if (preferEmpathy && coveredThemeSet.has('体验')) {
    // 「体验」池现为 EOP 访谈共情条目（沉默/友谊/自杀文化），比规训语料更贴共情场景
    return {
      input: '',
      path: 'path2',
      condensed: fixedCondensed,
      hasTension: false,
      lenses: [{ kind: 'theme', key: '体验', reinterpretation: '共情轮以体验为底，指向沉默与交往之思' }],
      primaryLensIndex: 0,
    };
  }
  const fallbackKeys = ['驯顺的肉体', '权力-知识', '规训', '规范化'];
  const key = fallbackKeys.find((k) => coveredCategorySet.has(k));
  if (!key) return null;
  return {
    input: '',
    path: 'path2',
    condensed: fixedCondensed,
    hasTension: false,
    lenses: [{ kind: 'category', key, reinterpretation: '整句作喻体见身体与编排之关系' }],
    primaryLensIndex: 0,
  };
}

/* ================================================================
   6 · 同 key 检索 + 义项裁决（Step 2）
   ================================================================ */

interface PoolItem {
  id: string;
  condensed: string;
  temperament: string;
  frameGloss: string;
  generationCaution?: string;
}

function buildPoolCandidates(
  pool: CorpusEntry[],
  kind: 'theme' | 'category',
  key: string,
  excludeIds: Set<string>,
  preferEmpathy: boolean,
  preferIds?: Set<string>,
): CorpusEntry[] {
  let cands = pool.filter((e) => !excludeIds.has(e.id));
  if (cands.length === 0) cands = [...pool]; // exclude 过严时放宽（02 §7.4）

  if (preferEmpathy) {
    // C 策略：共情向排序靠前（只改排序，不改入围规则，03 §5.2）
    const EMPATHY = /丧|恸|哭|悲|友|患|病|死|孤|苦|怜悯|同情|安慰/;
    const PREACH = /禁止|必须|应当|纪律|惩罚|操练/;
    cands = [...cands].sort((a, b) => {
      const sa = (EMPATHY.test(a.condensed) ? 2 : 0) - (PREACH.test(a.condensed) ? 1 : 0);
      const sb = (EMPATHY.test(b.condensed) ? 2 : 0) - (PREACH.test(b.condensed) ? 1 : 0);
      return sb - sa;
    });
  }
  // B 类（有 temperament）可优先（02 §0.2 排序建议）
  cands = [...cands].sort((a, b) => {
    const ba = a.annotationType === 'B' ? 1 : 0;
    const bb = b.annotationType === 'B' ? 1 : 0;
    return bb - ba;
  });
  // 专名直挂命中条置顶（稳定排序，置顶后内部仍保 B 类序）
  if (preferIds && preferIds.size > 0) {
    cands = [...cands].sort((a, b) => (preferIds.has(b.id) ? 1 : 0) - (preferIds.has(a.id) ? 1 : 0));
  }
  void kind;
  void key;
  return cands.slice(0, MAX_POOL);
}

function candidatePayload(pool: CorpusEntry[], kind: 'theme' | 'category', key: string): string {
  const items: PoolItem[] = pool.map((e) => ({
    id: e.id,
    condensed: e.condensed,
    temperament: getReinterpretationSource(e, kind, key),
    frameGloss:
      (e.attitudeFrames || []).find((f) => f.lensKind === kind && f.lensKey === key)?.object as string || '',
    generationCaution: e.generationCaution,
  }));
  return JSON.stringify(items, null, 1);
}

export interface AdjudicationOutcome {
  entry: CorpusEntry | null;
  bridge: string;
}

/**
 * 义项裁决（§7.4 换条重裁）：最多 MAX_REPICKS 轮，末轮 mustPick。
 * LLM 不可用/池为空 → 本地取池首条（保底可用）。
 */
export async function retrieveEntryWithAdjudication(
  primaryLens: Lens,
  opts: {
    semanticInput: string;
    userCondensed: string;
    excludeIds?: Set<string>;
    preferEmpathy?: boolean;
    preferIds?: Set<string>;
    namedHint?: string;
  },
): Promise<AdjudicationOutcome> {
  const rawPool = poolByLens(primaryLens.kind, primaryLens.key);
  if (rawPool.length === 0) return { entry: null, bridge: '' };

  const cands = buildPoolCandidates(
    rawPool,
    primaryLens.kind,
    primaryLens.key,
    opts.excludeIds ?? new Set(),
    !!opts.preferEmpathy,
    opts.preferIds,
  );

  // 本地兜底：无模型时直接取池首条 + 空桥
  if (!llmAvailable()) {
    return { entry: cands[0], bridge: '' };
  }

  const rejected = new Set<string>();
  const poolText = () =>
    candidatePayload(cands.filter((e) => !rejected.has(e.id)), primaryLens.kind, primaryLens.key);

  // 共情轮宁缺毋滥：共情向候选池小，强择不贴条目会被迫设喻或变相指导（「压力→说话的义务」
  // 「失眠→睡眠要有分寸」类硬接），故共情轮末轮不启用强制择一，皆不可用则返空锚走无典短应。
  const forcePick = !opts.preferEmpathy;

  for (let round = 1; round <= MAX_REPICKS; round++) {
    const remaining = cands.filter((e) => !rejected.has(e.id));
    if (remaining.length === 0) break;
    const mustPick = forcePick && round === MAX_REPICKS;

    const system = mustPick ? PROMPT_CORPUS_FIT_MUST_PICK : PROMPT_CORPUS_FIT_SYSTEM;
    const payload = [
      `【用户整句】${opts.semanticInput}`,
      `【问旨 condensed】${opts.userCondensed}`,
      `【透镜】kind=${primaryLens.kind} key=${primaryLens.key} reinterpretation=${primaryLens.reinterpretation}`,
      opts.namedHint && opts.preferIds
        ? `【专名直挂】用户点名「${opts.namedHint}」，候选中条目 ${[...opts.preferIds].join('、')} 含该专名；若其确与问旨相关，优先取之`
        : '',
      `【候选池】\n${poolText()}`,
      opts.preferEmpathy
        ? '【共情轮铁律】候选为体验向语料：usable 须候选与用户切身处境真实对应（同历/同感/同境），且成句后只能陪伴、不能指导；禁止把「静默/说话/书写」等与用户处境无关的议题设喻硬接（如把学业压力接成「说话的义务」）；禁止把养生法/分寸/节制/自我管理之类规范条目接给正在受苦的人（如把失眠接成「睡眠要有分寸」，那是建议而非陪伴）；宁可整体 usable=false，不得为贴而造桥。'
        : '',
    ].filter(Boolean).join('\n');

    const j = await chatJson<{ usable?: boolean; bestId?: string | null; bridge?: string; rejectReason?: string }>(
      system,
      payload,
      { maxTokens: 512, model: llmConfig.model }, // 成句档：裁决不算轻量，选错成句救不回（模型分流表）
    );

    if (j && j.bestId) {
      const entry = cands.find((e) => e.id === j.bestId);
      if (entry && (j.usable === true || mustPick)) {
        return { entry, bridge: typeof j.bridge === 'string' ? j.bridge : '' };
      }
      // bestId 不在池内或判不可用 → 加入 rejected 再裁
      if (j.bestId) rejected.add(j.bestId);
    } else if (mustPick) {
      return { entry: remaining[0], bridge: '' };
    } else {
      rejected.add(remaining[0].id);
    }
  }
  // 共情轮穷尽候选仍不贴 → 返空锚（不硬凑）；非共情轮保旧行为取池首条保底
  if (!forcePick) return { entry: null, bridge: '' };
  return { entry: cands[0], bridge: '' };
}

/* ================================================================
   主控：输入 → §9 交出对象
   ================================================================ */

export async function selectCorpus(opts: {
  userInput: string;
  priorTurns?: string;
  dialogueState?: DialogueState;
  preferEmpathy?: boolean;
}): Promise<CorpusMatchOutput> {
  const s = opts.dialogueState;
  // 0 · 预处理
  const semanticInput = preprocessInput(opts.userInput);

  // 0b · 纯应酬语（你好/在吗）：无实质内容，直接无典，不进问旨/透镜/LOOSE
  if (isPhaticInput(semanticInput)) {
    return {
      path: 'path2',
      hasTension: false,
      lensSource: 'empty',
      userCondensed: semanticInput,
      relation: 'same_focus',
      speechAct: 'continue',
      primaryLens: null,
      lenses: [],
      anchor: null,
      corpusBridge: '',
      philosopherId: 'foucault',
    };
  }

  // 1 · 问旨
  const intent = await askIntent(semanticInput, opts.priorTurns || '');

  // 1b · 专名直挂：输入点名语料已登记的书名/人名（《我的隐秘生活》、萨德、茹伊之类）
  // → 跳过路由与透镜，直接喂对应条目的 lens key，走正常裁决（命中条置顶）。
  // 透镜抽 key 只认词表，书名专名永抽不出；此处激活标注时埋的 keywords/exemplar 锚点。
  const namedHit = matchProperName(semanticInput);
  if (namedHit) {
    const hitEntries = namedHit.entryIds
      .map((id) => getEntryById(id))
      .filter((e): e is CorpusEntry => !!e);
    if (hitEntries.length > 0) {
      // 优先选含命中专名的态度帧定 lens key，否则取首帧；再无则取 themes/categories 首项
      const top = hitEntries[0];
      const frames = top.attitudeFrames || [];
      const frame =
        frames.find((f) => (f.keywords || []).some((k) => k.includes(namedHit.name) || namedHit.name.includes(k))) ||
        frames[0];
      const kind: 'theme' | 'category' =
        frame && frame.lensKind === 'category' ? 'category' : frame && frame.lensKind === 'theme' ? 'theme'
          : top.categories.length > 0 && top.themes.length === 0 ? 'category' : 'theme';
      const key =
        frame?.lensKey ||
        (kind === 'theme' ? top.themes[0] : top.categories[0]) ||
        top.themes[0] || top.categories[0] || '';
      const primaryLens: Lens = {
        kind,
        key,
        reinterpretation: `输入点名「${namedHit.name}」，直挂语料锚点`,
        mentionReason: '专名直挂',
      };
      const preferIds = new Set(hitEntries.map((e) => e.id));
      const excludeIds = new Set(s?.usedCorpusIds ?? []);
      if (s?.lastCorpusId) excludeIds.add(s.lastCorpusId);
      preferIds.forEach((id) => excludeIds.delete(id)); // 用户点名之物不被近期使用史排除
      const { entry, bridge } = await retrieveEntryWithAdjudication(primaryLens, {
        semanticInput,
        userCondensed: intent.condensed,
        excludeIds,
        preferEmpathy: opts.preferEmpathy,
        preferIds,
        namedHint: namedHit.name,
      });
      return {
        path: 'path1',
        hasTension: null,
        lensSource: 'named',
        userCondensed: intent.condensed,
        relation: intent.relation,
        speechAct: intent.speechAct,
        primaryLens,
        lenses: [primaryLens],
        anchor: entry,
        corpusBridge: entry ? bridge : '',
        philosopherId: 'foucault',
      };
    }
  }

  // 2 · 路由
  const { path } = await routeInput(semanticInput);

  // 3 · 严格透镜（fixedCondensed = 问旨 condensed）
  let lensResult = await strictLens(semanticInput, path, intent.condensed);
  let lensSource: LensSource = 'strict';

  // 4 · path2 且无 category → 放宽再抽（可二次 avoid；共情轮允许 theme，以够到访谈语料）
  if (path === 'path2' && lensResult.lenses.length === 0) {
    const allowTheme = !!opts.preferEmpathy;
    // localLoose 仅在无模型时使用：有模型时应尊重模型「无可析内容→空」的判断，不硬套范畴
    const loose1 = (await looseLens(semanticInput, intent.condensed, [], { allowTheme })) || (!llmAvailable() ? localLoose(intent.condensed, allowTheme) : null);
    if (loose1 && loose1.lenses.length > 0) {
      lensResult = { ...loose1, input: semanticInput };
      lensSource = 'loose';
    } else {
      // 抽到无覆盖/仍无 category → 扩大 avoid 再抽一次
      const avoid = loose1 ? loose1.lenses.map((l) => l.key) : [];
      const loose2 = await looseLens(semanticInput, intent.condensed, avoid, { allowTheme });
      if (loose2 && loose2.lenses.length > 0) {
        lensResult = { ...loose2, input: semanticInput };
        lensSource = 'loose';
      } else if (semanticInput.length >= 6 && !llmAvailable()) {
        // 无模型时两轮 LOOSE 均空 → 本地宽松兜底，避免整轮落入无典（应酬语已在 0b 拦截）；
        // 有模型时尊重其「无可析内容→空」的判断（与上方注释同精神），不硬套范畴，落无典短应
        const looseLocal = localLoose(intent.condensed, allowTheme);
        if (looseLocal && looseLocal.lenses.length > 0) {
          lensResult = { ...looseLocal, input: semanticInput };
          lensSource = 'loose';
        } else {
          lensSource = 'empty';
        }
      } else {
        lensSource = 'empty';
      }
    }
  }

  // 5 · primaryLens；无 → 无典
  const primaryLens: Lens | null =
    lensResult.lenses.length > 0 ? lensResult.lenses[lensResult.primaryLensIndex] || lensResult.lenses[0] : null;

  if (!primaryLens) {
    return {
      path,
      hasTension: path === 'path2' ? lensResult.hasTension : null,
      lensSource,
      userCondensed: intent.condensed,
      relation: intent.relation,
      speechAct: intent.speechAct,
      primaryLens: null,
      lenses: lensResult.lenses,
      anchor: null,
      corpusBridge: '',
      philosopherId: 'foucault',
    };
  }

  // 6 · 同 key 池 + 义项裁决
  const excludeIds = new Set(s?.usedCorpusIds ?? []);
  if (s?.lastCorpusId) excludeIds.add(s.lastCorpusId);
  let { entry, bridge } = await retrieveEntryWithAdjudication(primaryLens, {
    semanticInput,
    userCondensed: intent.condensed,
    excludeIds,
    preferEmpathy: opts.preferEmpathy,
  });

  /* 6b · 丧失/分手硬注入重裁（2026-09-05 盲评整改三）
   * 共情轮空锚且用户句属长期亲密关系撤除时，按 prompts「丧失例外」把透镜硬注入「主体化」再裁一次。
   * 原因：hasTension 会翻转（同一句实测 false→true），一旦走严格轮就会被【选面孔优先级】
   * 拉去「自我关怀」轻照料池 → 裁决全判不贴 → 共情轮宁缺毋滥返空锚 → 无典短应（实测 Q08：70 字）。
   * 仍不贴则维持空锚走无典短应，不强择（不破坏共情轮宁缺毋滥原则）。 */
  let anchorLens: Lens = primaryLens;
  if (
    !entry &&
    opts.preferEmpathy &&
    isBereavementInput(semanticInput) &&
    primaryLens.key !== BEREAVEMENT_LENS_KEY &&
    coveredCategorySet.has(BEREAVEMENT_LENS_KEY)
  ) {
    const retryLens: Lens = {
      kind: 'category',
      key: BEREAVEMENT_LENS_KEY,
      reinterpretation: '关系装置撤除后主体的悬置',
      mentionReason: '丧失例外硬注入',
    };
    const retry = await retrieveEntryWithAdjudication(retryLens, {
      semanticInput,
      userCondensed: intent.condensed,
      excludeIds,
      preferEmpathy: opts.preferEmpathy,
    });
    if (retry.entry) {
      entry = retry.entry;
      bridge = retry.bridge;
      anchorLens = retryLens;
    }
  }

  // 7/8 · 交出
  return {
    path,
    hasTension: path === 'path2' ? lensResult.hasTension : null,
    lensSource,
    userCondensed: intent.condensed,
    relation: intent.relation,
    speechAct: intent.speechAct,
    primaryLens: anchorLens,
    lenses: anchorLens === primaryLens ? lensResult.lenses : [...lensResult.lenses, anchorLens],
    anchor: entry,
    corpusBridge: entry ? bridge : '',
    philosopherId: 'foucault',
  };
}
