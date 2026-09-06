/**
 * 同范畴入围后，用模型做义项/喻体贴合裁决（理解优先，非字面重合）。
 */
import type { CorpusEntry, UserLens } from './types';
import { MODEL } from '../../constants/app';
import { chatCompletionJson } from './qwenJson';
import {
  FORM_SUBSTANCE_FAMILY,
  formSubstanceCategoryMatch,
  inFormSubstanceFamily,
} from './categoryFamily';
import { getCorpusEntries } from './corpus';
import type { SceneDomain } from './types';
import { empathyCorpusScore } from './moodDetect';
import {
  isParentIllnessAliveContext,
  shouldPenalizeCorpusEntry,
} from './corpusContextGuard';
import { passesPolarityGate } from './polarityTag';

export const PROMPT_CORPUS_FIT = `你是 PhiloMate 语料义项裁决器。在「已同范畴入围」的候选中，靠理解挑选最可贴用户整句的一条。

【命名 · 硬】
- **【bridge】**（本字段）= 逻辑上联系**输入 ↔ 语料**的裁决参数，供选型与 debug；**不是**可见成句。
- **【成句bridge】** / **【联想bridge】** = 成句模型另写；**禁止**在本字段预写「成句须…」「完整述例」「分析结论入句」等成句规。

【任务】
给定：用户整句、问旨 condensed、透镜 + reinterpretation、候选（id、condensed、frame 义项、temperament、可选 generationCaution）。
选出**一条** bestId：形上结构同向，或可作喻体桥接。
path2 日常薄事实鼓励喻体；【bridge】须写清同构，禁止只靠单字（度、器、变）沾边。

【极性筛查 · 语料选取固定层】
入围已按再解释尾标与 temperament 尾标**全等**过滤（A 档：名恶实善／表负里正／过度／必 等）。与最终成句形态无关。裁决勿拧标、勿选反极。

【temperament · 原句指针】
temperament 若含「｜原句：…」或点明某分句，表示**本范畴只对应原文该句**。
- 【bridge】须对准该分句之义；**禁止**用同条其他分句硬凑
- temperament / condensed 只供理解与取舍，**不是**成句措辞来源

【同构 checklist · 【bridge】不过则否】
1. 两边是否同一关系型（目的—手段、充—载、整—分、失中—守中、常道—应变等）
2. 是否只有抽象词重合而结构不同（度≠度；器皿≠器量，除非桥写出「所充/所载不足→全体/格局不称」）
3. 形质族互通（体/用·文/质·本/末）可以，但须写清过渡（器用失职→为人失质）
4. 同范畴内选**最贴用户整句语境**的一条；不能完全同构时，【bridge】仍须对句写清接到该典之义
5. **程度与褒贬相称**：勿把仅「未尽善／自省」桥到欺瞒、虚伪、曲、小人等恶劣端 → 换更轻候选或 usable=false
6. **同范畴≠同极轴**：表愚里明（2.9）≠ 表笃里惑／迷茫；外看适任≠犁牛出身轴
7. **边界／极端取舍须落地**：用户问「若…还隐吗／害人时是否仍…」等适用边界时，【bridge】须写清**在该情形下**隐或不隐、好恶如何裁如何接到典义；**禁止**只抬到「务本／本立而道生／立了根本自然正」而不答边界 → 换能落地的候选或 usable=false
不过 checklist → 换候选或 usable=false

【可桥 · 宜选】
- 螳螂畏人失趣 ↔ 颜回无所不说失助 → 11.4
- 星亮于夜 ↔ 岁寒见松柏 → 9.28
- 夜戴墨镜失宜 ↔ 无道则愚藏用 → 5.21（须点「合时/藏用」）
- 遇变无定执 ↔ 君子无适无莫、义之与比 → 4.10（须点「以常道应万变」）

【不可桥 · 才否】
- 对极不通；仅字面沾边；【bridge】缺一层同构
- **字面同字异义**：少眠≠吾少也贱；相信≠守信
- **轻过重比**：自省轻过却比恶劣端 → 否
- 池中无一可桥接时才 usable=false；有可选则必须选出
- usable=false 时：近误仍可填 bestId 供换条，bridge 可空

【generationCaution · 若候选带此字段】
取舍与【bridge】须遵守该条；无法在 caution 内同构则换候选或 usable=false。

【亲疾未死 · 硬禁】
用户说亲友／父母住院、ICU、病危、重病而人仍在：禁止选择 9.17“逝者如斯”与 10.22“于我殡”，不得把活人收成流逝、迁变恒常或将逝。无顶撞／几谏／谏／不听／违命语境时也禁 4.18。父母亲疾优先 2.6“父母唯其疾之忧”等忧亲、孝亲语料。

【bridge】（裁决参数 · 输入↔语料 · **非成句**）
usable 时必写：**现代白话一句或两句**，把两边**何以相接**说清楚（给人看的理路，不是半文言成句稿）。
- 成句另有半文言硬约束，**不会**也不应照抄本字段的白话；本字段只管逻辑清楚。
- 结构：用户这边怎么回事 + 和典的哪一义怎么接上 + 典那边是什么（可压缩，关系不可省、不可让人猜）。
- 关系用白话点明即可，例如：就像／好比／所以可以接到／相当于／由此想到／规范上应对标…（不必硬塞文言「犹／盖当／正若」，逻辑对即可）。
关系类型仍须心里有数，择一写清：
- **同构共鸣**：两边同一关系型（白话例：两边都是「手段伤了目的」）
  - **硬禁冒犯桥**：用户寒暄叹热／闲聊 ≠「子贡担心老师不说话就没法学」；**禁止**写成用户「不知道说啥所以随便找话说」。若用本条接天热，应走「天不言、以四时／暑气自行见道」一极，勿派到子贡忧无言。
- **失中→当守 / 由此极到彼极**：白话写清「这边偏了，典里对应的正法是…」
- **远设喻**：白话写清「用典里Ｘ来比方用户这边的Ｙ」
- **仅换主语**：直接化用到**行事主体**（仅换主语）：用户自己做事→汝／尔；旁观转述第三人→彼／其／专名，**勿一律用户**
并据同构程度填 **subjectOnly**：
- **true**：只差主语／施受 → 用「直接化用到行事主体」式（主语须落实际行事者，旁观勿写汝）
- **false**：尚有结构／义项差 → 须写清关系，**禁止**标 true
- **贴则直化 / 远才设喻**：已同构勿硬套远喻；结构远才用「好比／就像」
- **守施受**；勿冒号申说；少用「汝」；禁破折号
- **禁止**预写【成句bridge】/【联想bridge】（勿「成句须…」「完整述例」）

输出 JSON：
{"usable":true|false,"bestId":"章句号或null","bridge":"白话理路…","subjectOnly":true|false,"rejectReason":"不可用时短因"}
不要 JSON 以外文字。`;

export const PROMPT_CORPUS_FIT_MUST_PICK = `你是 PhiloMate 语料义项裁决器（复裁：池非空必须择一）。
上一轮已判皆不可用，但候选仍在。选**相对最可喻体**的一条，不要 usable=false。
仍须遵守：入围极性尾标同向；同构 checklist；勿假桥；勿轻比恶劣端；有 generationCaution 则【bridge】不得违反。
【bridge】须用**现代白话**写清输入↔典的相接理路（非成句）；禁止只并置两截；禁止预写成句；禁把寒暄叹热写成「子贡忧无言／随便找话说」。
输出 JSON：{"usable":true,"bestId":"…","bridge":"白话理路","subjectOnly":false,"rejectReason":""}
不要 JSON 以外文字。`;

export interface CorpusFitCandidate {
  id: string;
  condensed: string;
  frameObject?: string;
  frameElement?: string;
  temperament?: string;
  textPreview?: string;
  /** 成句/短桥易错备注（有则裁决须遵守） */
  generationCaution?: string;
}

export interface CorpusFitResult {
  usable: boolean;
  bestId: string | null;
  bridge: string;
  /**
   * true=用户事与典义仅差主语，成句可直化；
   * false/缺省=须把短桥写入成句，禁止假装直化。
   */
  subjectOnly?: boolean;
  rejectReason?: string;
}

/**
 * 仅换主语才可直化。模型标 true 也须短桥自证（含「仅换主语」等）；
 * 否则一律 false（成句必须写桥）。宁严勿宽。
 */
export function inferSubjectOnly(bridge: string, flag?: boolean): boolean {
  const bridgeSays =
    /仅换主语|直接化用到(?:用户|行事)主体/.test(bridge || '');
  if (flag === false) return false;
  if (flag === true) return bridgeSays;
  return bridgeSays;
}

const BRIDGE_CORE_STOP = new Set([
  '直接',
  '化用',
  '用户',
  '主体',
  '仅换',
  '主语',
  '正若',
  '譬诸',
  '恰似',
  '好比',
  '犹如',
  '有如',
  '正如',
  '然则',
  '于此',
  '以其',
  '而已',
  '也是',
  '不是',
  '终须',
  '方可',
]);

const BRIDGE_ANALOGY_SPLIT =
  /正若|譬诸|恰似|好比|犹如|有如|正如|就像|相当于|所以可以接到|由此想到|规范上应对标|可以接到/;

function collectCoresFromText(text: string): string[] {
  const cleaned = (text || '')
    .replace(/直接化用到(?:用户|行事)主体（仅换主语）[：:]?/g, '')
    .replace(/[，。；、：:\s·｜|／/（）()「」""''、]/g, ' ');
  const cores: string[] = [];
  for (const part of cleaned.split(/\s+/).filter(Boolean)) {
    if (part.length >= 2 && part.length <= 10 && !BRIDGE_CORE_STOP.has(part)) {
      cores.push(part);
      continue;
    }
    const han = part.replace(/[^\u4e00-\u9fff]/g, '');
    for (let i = 0; i + 2 <= han.length; i += 1) {
      const bi = han.slice(i, i + 2);
      if (!BRIDGE_CORE_STOP.has(bi)) cores.push(bi);
      if (i + 3 <= han.length) {
        const tri = han.slice(i, i + 3);
        if (!BRIDGE_CORE_STOP.has(tri)) cores.push(tri);
      }
      if (i + 4 <= han.length) {
        const quad = han.slice(i, i + 4);
        if (!BRIDGE_CORE_STOP.has(quad)) cores.push(quad);
      }
    }
  }
  return [...new Set(cores)].filter((c) => c.length >= 2).slice(0, 20);
}

/** 短桥用户复述侧（设喻/分析接头前，或首个分号前） */
export function extractBridgeUserPart(bridge: string): string {
  const raw = (bridge || '').trim();
  if (!raw) return '';
  const m = raw.split(BRIDGE_ANALOGY_SPLIT);
  if (m.length >= 2) return m[0].trim();
  const semi = raw.split(/[；;]/);
  if (semi.length >= 2) return semi[0].trim();
  return raw
    .replace(/直接化用到(?:用户|行事)主体（仅换主语）[：:]?/g, '')
    .trim();
}

/**
 * 短桥中「非复述用户」部分：典名框架 + 分析结论。
 * 优先取设喻接头及之后；否则取首个分号之后。
 */
export function extractBridgeNonUserPart(bridge: string): string {
  const raw = (bridge || '').trim();
  if (!raw) return '';
  const conj = raw.match(BRIDGE_ANALOGY_SPLIT);
  if (conj && conj.index != null) {
    return raw.slice(conj.index).trim();
  }
  const semi = raw.split(/[；;]/);
  if (semi.length >= 2) return semi.slice(1).join('；').trim();
  return '';
}

/**
 * 分析结论：非用户部分里去掉接头与「仅典名」后的义理收束
 * （如「正若绘事后素，文饰之美终须以素底为质方可成全」→「文饰之美终须以素底为质方可成全」）
 */
export function extractBridgeConclusionPart(bridge: string): string {
  let nonUser = extractBridgeNonUserPart(bridge);
  if (!nonUser) return '';
  nonUser = nonUser.replace(BRIDGE_ANALOGY_SPLIT, '').trim();
  // 典名短引 + 逗号 + 结论
  const m = nonUser.match(/^([^，、；;]{2,16})[，、；;](.+)$/);
  if (m && m[2].trim().length >= 4) return m[2].trim();
  return nonUser;
}

/** @deprecated 兼容旧名：用户侧义核 */
export function extractBridgeUserCores(bridge: string): string[] {
  return collectCoresFromText(extractBridgeUserPart(bridge));
}

/** @deprecated 成句不再强制吃满【bridge】义核；保留供调试 */
export function extractBridgeMustCores(bridge: string): string[] {
  const conclusion = extractBridgeConclusionPart(bridge);
  if (conclusion.length >= 4) return collectCoresFromText(conclusion);
  const nonUser = extractBridgeNonUserPart(bridge);
  if (nonUser) return collectCoresFromText(nonUser);
  return [];
}

/** @deprecated 主路径已取消「成句吃满【bridge】义核」重生成 */
export function outputCarriesBridge(text: string, bridge: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  const mustCores = extractBridgeMustCores(bridge);
  if (mustCores.length === 0) {
    // 短桥未能分出结论时，退回：至少不能只有用户复述（须有非用户半句痕迹）
    const nonUser = extractBridgeNonUserPart(bridge);
    if (!nonUser) return true;
    return collectCoresFromText(nonUser).some((c) => c.length >= 2 && t.includes(c));
  }
  const hits = mustCores.filter((c) => t.includes(c));
  const need = Math.min(2, mustCores.length);
  if (hits.length >= need) return true;
  if (mustCores.some((c) => c.length >= 4 && t.includes(c))) return true;
  return false;
}

function categoryOrFamilyMatch(lens: UserLens, entry: CorpusEntry): boolean {
  if (lens.kind === 'theme') {
    if (entry.themes?.includes(lens.key)) return true;
    if (
      lens.key === '文/质' &&
      formSubstanceCategoryMatch(lens.key, entry) === 'family'
    ) {
      return true;
    }
    return false;
  }
  if (entry.categories?.includes(lens.key)) return true;
  return formSubstanceCategoryMatch(lens.key, entry) === 'family';
}

function hasLensFrame(entry: CorpusEntry, lens: UserLens): boolean {
  const frames = entry.attitudeFrames || [];
  if (frames.some((f) => f.lensKind === lens.kind && f.lensKey === lens.key)) return true;
  if (lens.kind === 'category' && inFormSubstanceFamily(lens.key)) {
    return frames.some((f) => f.lensKind === 'category' && FORM_SUBSTANCE_FAMILY.has(f.lensKey));
  }
  return false;
}

function sceneHardExcluded(entry: CorpusEntry, userScenes: SceneDomain[]): boolean {
  if (!entry.sceneExclude?.length || !userScenes.length) return false;
  return entry.sceneExclude.some((s) => userScenes.includes(s));
}

/**
 * 硬门槛入围池：同范畴/同族；优先有对应 frame、未用过；不做 keyword/极性打分。
 * 默认上限 12，把裁决预算留给次要 lens 换镜。
 */
export const CORPUS_POOL_LIMIT = 12;
/** primary 失败后最多再试几个次要 lens */
export const MAX_SECONDARY_LENS_TRIES = 2;

export function listCorpusPoolByLens(
  lens: UserLens,
  opts?: {
    excludeCorpusIds?: string[];
    usedCorpusIds?: string[];
    userScenes?: SceneDomain[];
    limit?: number;
    /** C 策略：共情向语料排前 */
    preferEmpathy?: boolean;
    /** 用户句+问旨，供语境降权硬排除 */
    contextBlob?: string;
  }
): CorpusEntry[] {
  const limit = opts?.limit ?? CORPUS_POOL_LIMIT;
  const excluded = new Set(opts?.excludeCorpusIds ?? []);
  const used = new Set(opts?.usedCorpusIds ?? []);
  const userScenes = opts?.userScenes ?? [];
  const preferEmpathy = !!opts?.preferEmpathy;
  const contextBlob = opts?.contextBlob || '';

  type Row = { entry: CorpusEntry; hasFrame: boolean; used: boolean; empathy: number };
  const rows: Row[] = [];
  for (const entry of getCorpusEntries()) {
    if (excluded.has(entry.id)) continue;
    if (!categoryOrFamilyMatch(lens, entry)) continue;
    // 【极性筛查·选取固定层】A 档尾标全等才入围；与成句/联想形态无关
    if (!passesPolarityGate(lens, entry)) continue;
    if (sceneHardExcluded(entry, userScenes)) continue;
    if (
      contextBlob &&
      shouldPenalizeCorpusEntry(contextBlob, entry.id, entry)
    ) {
      continue;
    }
    rows.push({
      entry,
      hasFrame: hasLensFrame(entry, lens),
      used: used.has(entry.id),
      empathy: preferEmpathy ? empathyCorpusScore(entry) : 0,
    });
  }

  rows.sort((a, b) => {
    if (preferEmpathy && a.empathy !== b.empathy) return b.empathy - a.empathy;
    if (a.used !== b.used) return a.used ? 1 : -1;
    if (a.hasFrame !== b.hasFrame) return a.hasFrame ? -1 : 1;
    return 0;
  });

  return rows.slice(0, limit).map((r) => r.entry);
}

function toCandidate(entry: CorpusEntry, lens: UserLens): CorpusFitCandidate {
  const frame =
    (entry.attitudeFrames || []).find((f) => f.lensKind === lens.kind && f.lensKey === lens.key) ||
    (inFormSubstanceFamily(lens.key)
      ? (entry.attitudeFrames || []).find(
          (f) => f.lensKind === 'category' && FORM_SUBSTANCE_FAMILY.has(f.lensKey)
        )
      : undefined);
  const catIdx = entry.categories?.indexOf(lens.key) ?? -1;
  const temperament =
    catIdx >= 0 && entry.temperaments?.[catIdx]
      ? entry.temperaments[catIdx]
      : entry.temperaments?.[0];
  return {
    id: entry.id,
    condensed: entry.condensed || '',
    frameObject: frame?.object,
    frameElement: frame?.element,
    temperament,
    textPreview: (entry.text || '').slice(0, 48),
    ...(entry.generationCaution ? { generationCaution: entry.generationCaution } : {}),
  };
}

export async function adjudicateCorpusFit(params: {
  userInput: string;
  condensed?: string;
  lens: UserLens;
  candidates: CorpusEntry[];
  /** 复裁：池非空时强制择一 */
  mustPick?: boolean;
}): Promise<CorpusFitResult> {
  const { userInput, condensed, lens, candidates, mustPick } = params;
  if (!candidates.length) {
    return { usable: false, bestId: null, bridge: '', rejectReason: '无候选' };
  }

  const payload = {
    userInput,
    condensed: condensed || '',
    lens: {
      kind: lens.kind,
      key: lens.key,
      reinterpretation: lens.reinterpretation,
    },
    candidates: candidates.map((e) => toCandidate(e, lens)),
  };

  try {
    const raw = await chatCompletionJson<CorpusFitResult>(
      mustPick ? PROMPT_CORPUS_FIT_MUST_PICK : PROMPT_CORPUS_FIT,
      JSON.stringify(payload),
      MODEL,
      500,
      0.15
    );
    const bestId = raw.bestId && String(raw.bestId).trim() ? String(raw.bestId).trim() : null;
    const allowed = new Set(candidates.map((c) => c.id));
    if ((!raw.usable && !mustPick) || !bestId || !allowed.has(bestId)) {
      return {
        usable: false,
        bestId: null,
        bridge: '',
        rejectReason: raw.rejectReason || '裁决未选可用 id',
      };
    }
    return {
      usable: true,
      bestId,
      bridge: (raw.bridge || '').trim(),
      subjectOnly: inferSubjectOnly(raw.bridge || '', raw.subjectOnly),
      rejectReason: raw.rejectReason,
    };
  } catch {
    return { usable: false, bestId: null, bridge: '', rejectReason: '裁决调用失败' };
  }
}

/** 入围 + 裁决；否决则换条重裁（排除近误 id），末轮才 mustPick */
export async function retrieveEntryWithAdjudication(params: {
  lens: UserLens;
  userInput: string;
  condensed?: string;
  excludeCorpusIds?: string[];
  usedCorpusIds?: string[];
  userScenes?: SceneDomain[];
  limit?: number;
  preferEmpathy?: boolean;
  /** 换条最多轮数（含末轮 mustPick），默认 3 */
  maxRepicks?: number;
}): Promise<{ entry: CorpusEntry | null; bridge: string; fit: CorpusFitResult }> {
  const pool = listCorpusPoolByLens(params.lens, {
    excludeCorpusIds: params.excludeCorpusIds,
    usedCorpusIds: params.usedCorpusIds,
    userScenes: params.userScenes,
    limit: params.limit ?? CORPUS_POOL_LIMIT,
    preferEmpathy: params.preferEmpathy,
    contextBlob: `${params.userInput || ''}${params.condensed || ''}`,
  });
  if (!pool.length) {
    return {
      entry: null,
      bridge: '',
      fit: { usable: false, bestId: null, bridge: '', rejectReason: '无候选' },
    };
  }

  const maxRepicks = Math.max(1, params.maxRepicks ?? 3);
  const rejected = new Set<string>();
  let lastFit: CorpusFitResult = {
    usable: false,
    bestId: null,
    bridge: '',
    rejectReason: '未裁决',
  };

  for (let round = 0; round < maxRepicks; round++) {
    const candidates = pool.filter((e) => !rejected.has(e.id));
    if (!candidates.length) break;

    const isLast = round === maxRepicks - 1;
    const fit = await adjudicateCorpusFit({
      userInput: params.userInput,
      condensed: params.condensed,
      lens: params.lens,
      candidates,
      mustPick: isLast,
    });
    lastFit = fit;

    if (fit.usable && fit.bestId) {
      const entry = pool.find((e) => e.id === fit.bestId) || null;
      return { entry, bridge: fit.bridge, fit };
    }

    // 换条：排除本轮否决/近误 id，再裁剩余
    if (fit.bestId && pool.some((e) => e.id === fit.bestId)) {
      rejected.add(fit.bestId);
      continue;
    }
    // 未给出可排除 id：末轮已 mustPick 仍失败则停；否则对剩余强制择一试一次
    if (!isLast) {
      const forced = await adjudicateCorpusFit({
        userInput: params.userInput,
        condensed: params.condensed,
        lens: params.lens,
        candidates,
        mustPick: true,
      });
      lastFit = forced;
      if (forced.usable && forced.bestId) {
        const entry = pool.find((e) => e.id === forced.bestId) || null;
        return { entry, bridge: forced.bridge, fit: forced };
      }
      if (forced.bestId) rejected.add(forced.bestId);
    }
  }

  return { entry: null, bridge: '', fit: lastFit };
}

function lensIdentity(lens: UserLens): string {
  return `${lens.kind}:${lens.key}`;
}

/** primary 在前，其后按 lenses[] 顺序去重，最多再带 MAX_SECONDARY_LENS_TRIES 个 */
export function buildLensFallbackQueue(
  primary: UserLens,
  lenses: UserLens[],
  opts?: { lockToPrimary?: boolean; maxSecondary?: number }
): UserLens[] {
  if (opts?.lockToPrimary) return [primary];
  const maxSec = opts?.maxSecondary ?? MAX_SECONDARY_LENS_TRIES;
  const seen = new Set<string>([lensIdentity(primary)]);
  const queue: UserLens[] = [primary];
  for (const l of lenses || []) {
    if (!l?.key) continue;
    const id = lensIdentity(l);
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(l);
    if (queue.length >= 1 + maxSec) break;
  }
  return queue;
}

/**
 * 先 primary（可放宽 exclude），失败再试次要 lens（各建 12 条池）。
 * 次要命中时返回的 lens 即为应切换的 primary。
 */
export async function retrieveEntryWithLensFallback(params: {
  primaryLens: UserLens;
  lenses: UserLens[];
  userInput: string;
  condensed?: string;
  excludeCorpusIds?: string[];
  /** 末档放宽：通常只排除上一轮命中章句 */
  lastCorpusId?: string | null;
  usedCorpusIds?: string[];
  userScenes?: SceneDomain[];
  preferEmpathy?: boolean;
  /** C 轮父母亲疾未死：先试 theme「孝」 */
  preferParentIllnessXiao?: boolean;
  /** 主动提问锁 theme：禁止换次要 lens */
  lockToPrimary?: boolean;
  limit?: number;
}): Promise<{
  entry: CorpusEntry | null;
  bridge: string;
  fit: CorpusFitResult;
  lens: UserLens;
}> {
  const limit = params.limit ?? CORPUS_POOL_LIMIT;
  const excludeFull = params.excludeCorpusIds ?? [];
  const base = {
    userInput: params.userInput,
    condensed: params.condensed,
    usedCorpusIds: params.usedCorpusIds,
    userScenes: params.userScenes,
    preferEmpathy: params.preferEmpathy,
    limit,
  };

  const tryLens = async (
    lens: UserLens,
    excludeCorpusIds: string[],
    maxRepicks: number
  ) =>
    retrieveEntryWithAdjudication({
      ...base,
      lens,
      excludeCorpusIds,
      maxRepicks,
    });

  // C + 父母住院未死：在原 lens 之前先试“孝”，避免川上/殡葬类误收活人。
  if (
    params.preferParentIllnessXiao &&
    isParentIllnessAliveContext(`${params.userInput || ''}${params.condensed || ''}`) &&
    !(params.primaryLens.kind === 'theme' && params.primaryLens.key === '孝')
  ) {
    const xiaoLens: UserLens = {
      kind: 'theme',
      key: '孝',
      reinterpretation: '父母亲疾未殁，以忧亲应情；禁作逝者或殡葬之叹',
      mentionReason: 'c_parent_illness_pretry',
    };
    const xiao = await tryLens(xiaoLens, excludeFull, 2);
    if (xiao.entry) {
      return {
        entry: xiao.entry,
        bridge: xiao.bridge,
        fit: xiao.fit,
        lens: xiaoLens,
      };
    }
  }

  // —— primary：exclude 放宽阶梯 ——
  let result = await tryLens(params.primaryLens, excludeFull, 2);
  if (!result.entry && excludeFull.length > 2) {
    result = await tryLens(params.primaryLens, excludeFull.slice(-3), 2);
  }
  if (!result.entry && excludeFull.length > 0) {
    result = await tryLens(
      params.primaryLens,
      params.lastCorpusId ? [params.lastCorpusId] : [],
      1
    );
  }
  if (result.entry) {
    return {
      entry: result.entry,
      bridge: result.bridge,
      fit: result.fit,
      lens: params.primaryLens,
    };
  }

  // —— 次要 lens（各 12 池；用完整 exclude，避免刚换镜又撞近期章句）——
  const queue = buildLensFallbackQueue(params.primaryLens, params.lenses, {
    lockToPrimary: params.lockToPrimary,
  });
  for (const lens of queue.slice(1)) {
    const secondary = await tryLens(lens, excludeFull, 2);
    if (secondary.entry) {
      return {
        entry: secondary.entry,
        bridge: secondary.bridge,
        fit: secondary.fit,
        lens,
      };
    }
  }

  return {
    entry: null,
    bridge: result.bridge || '',
    fit: result.fit,
    lens: params.primaryLens,
  };
}
