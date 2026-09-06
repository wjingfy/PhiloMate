import type { CorpusEntry, LensKind, UserLens, SceneDomain } from './types';
import { shouldPenalizeXiaoTiCorpus } from './dialogueLensGuard';
import { penalizeUsedCorpusScore } from './corpusDiversity';
import { boostWorkplaceCorpusScore, shouldPenalizeCorpusEntry } from './corpusContextGuard';
import { isMusicYueFrame, pickLeJoyFrame, userDiscussesMusic } from './leYueSemantics';
import { CROSS_DOMAIN_SCENES, getUserSituationScenes } from './sceneDetect';
import {
  FORM_SUBSTANCE_FAMILY,
  formSubstanceCategoryMatch,
  inFormSubstanceFamily,
} from './categoryFamily';

import categoriesVocab from '../../data/confucius/categories_vocabulary.json';
import themesVocab from '../../data/confucius/themes_vocabulary.json';

let ENTRIES: CorpusEntry[] = [];

type FamilyMembersMap = Record<string, string[]>;
type FamilyBoundary = { covers?: string; not?: string };
type FamilyBoundariesMap = Record<string, FamilyBoundary>;

export type CoveredFamilyNode = {
  family: string;
  members: string[];
  covers?: string;
  not?: string;
};

function buildKeyToFamily(map: FamilyMembersMap): Map<string, string> {
  const out = new Map<string, string>();
  for (const [family, members] of Object.entries(map || {})) {
    for (const m of members || []) {
      if (m) out.set(m, family);
    }
  }
  return out;
}

const CATEGORY_FAMILIES = (categoriesVocab as { metaphysicalOnly?: FamilyMembersMap })
  .metaphysicalOnly ?? {};
const CATEGORY_BOUNDARIES = (categoriesVocab as { categoryFamilyBoundaries?: FamilyBoundariesMap })
  .categoryFamilyBoundaries ?? {};
const THEME_FAMILIES = (themesVocab as { themeFamilies?: FamilyMembersMap }).themeFamilies ?? {};
const THEME_BOUNDARIES = (themesVocab as { themeFamilyBoundaries?: FamilyBoundariesMap })
  .themeFamilyBoundaries ?? {};

const CATEGORY_KEY_TO_FAMILY = buildKeyToFamily(CATEGORY_FAMILIES);
const THEME_KEY_TO_FAMILY = buildKeyToFamily(THEME_FAMILIES);

/** 语料 categories 实际出现过的 key（至少 1 条） */
let coveredCategoryKeysCache: Set<string> | null = null;
/** 语料 themes 实际出现过的 key（至少 1 条） */
let coveredThemeKeysCache: Set<string> | null = null;

/** Inject the server-selected corpus window so the browser never downloads the full corpus bundle. */
export function configureCorpusEntries(entries: CorpusEntry[]): void {
  ENTRIES = entries;
  coveredCategoryKeysCache = null;
  coveredThemeKeysCache = null;
}

export function getCoveredCategoryKeys(): Set<string> {
  if (!coveredCategoryKeysCache) {
    const set = new Set<string>();
    for (const e of ENTRIES) {
      for (const c of e.categories || []) {
        if (c) set.add(c);
      }
    }
    coveredCategoryKeysCache = set;
  }
  return coveredCategoryKeysCache;
}

export function getCoveredThemeKeys(): Set<string> {
  if (!coveredThemeKeysCache) {
    const set = new Set<string>();
    for (const e of ENTRIES) {
      for (const t of e.themes || []) {
        if (t) set.add(t);
      }
    }
    coveredThemeKeysCache = set;
  }
  return coveredThemeKeysCache;
}

export function categoryKeyToFamily(key: string): string | null {
  const k = (key || '').trim();
  return k ? CATEGORY_KEY_TO_FAMILY.get(k) ?? null : null;
}

export function themeKeyToFamily(key: string): string | null {
  const k = (key || '').trim();
  return k ? THEME_KEY_TO_FAMILY.get(k) ?? null : null;
}

function filterCoveredFamilies(
  families: FamilyMembersMap,
  boundaries: FamilyBoundariesMap,
  hasCorpus: (key: string) => boolean
): CoveredFamilyNode[] {
  const nodes: CoveredFamilyNode[] = [];
  for (const [family, members] of Object.entries(families || {})) {
    const covered = (members || []).filter((m) => m && hasCorpus(m));
    if (covered.length === 0) continue;
    const b = boundaries[family];
    nodes.push({
      family,
      members: covered,
      covers: b?.covers,
      not: b?.not,
    });
  }
  return nodes;
}

/** path2 lens：有语料覆盖的范畴族树（含 covers/not） */
export function getCoveredCategoryFamilies(): CoveredFamilyNode[] {
  return filterCoveredFamilies(CATEGORY_FAMILIES, CATEGORY_BOUNDARIES, categoryKeyHasCorpus);
}

/** path1 lens：有语料覆盖的主题族树（含 covers/not） */
export function getCoveredThemeFamilies(): CoveredFamilyNode[] {
  return filterCoveredFamilies(THEME_FAMILIES, THEME_BOUNDARIES, themeKeyHasCorpus);
}

/**
 * 该 category 能否检索到语料。
 * 形质族（本/末·文/质·体/用）互通：族内任一有语料即算有覆盖。
 */
export function categoryKeyHasCorpus(key: string): boolean {
  const k = (key || '').trim();
  if (!k) return false;
  const covered = getCoveredCategoryKeys();
  if (covered.has(k)) return true;
  if (inFormSubstanceFamily(k)) {
    for (const famKey of FORM_SUBSTANCE_FAMILY) {
      if (covered.has(famKey)) return true;
    }
  }
  return false;
}

/** 该 theme 能否检索到语料（至少一条 themes 含此 key） */
export function themeKeyHasCorpus(key: string): boolean {
  const k = (key || '').trim();
  if (!k) return false;
  return getCoveredThemeKeys().has(k);
}

/** 词表中有、语料中尚无标注的 category keys（输入端禁止匹配） */
export function listUncoveredCategoryKeys(vocabFlatList?: string[]): string[] {
  const list =
    vocabFlatList ?? (categoriesVocab as { flatList: string[] }).flatList ?? [];
  return list.filter((k) => k && !categoryKeyHasCorpus(k));
}

/** 词表中有、语料中尚无标注的 theme keys（输入端禁止匹配） */
export function listUncoveredThemeKeys(vocabCoreThemes?: string[]): string[] {
  const list =
    vocabCoreThemes ?? (themesVocab as { coreThemes: string[] }).coreThemes ?? [];
  return list.filter((k) => k && !themeKeyHasCorpus(k));
}

/** lens 是否有语料可检索（theme / category 分流） */
export function lensKeyHasCorpus(lens: { kind: string; key: string }): boolean {
  if (lens.kind === 'theme') return themeKeyHasCorpus(lens.key);
  if (lens.kind === 'category') return categoryKeyHasCorpus(lens.key);
  return false;
}

export function getCorpusEntries(): CorpusEntry[] {
  return ENTRIES;
}

/**
 * frame.keywords 命中（义项辨析，非扩词表堆砌）。
 * - 素：素底/本质 ≠ 荤素、蔬菜
 * - 信：守信/信用 ≠ 「虽信/相信」之相信
 */
export function keywordMatchesContext(kw: string, ctx: string): boolean {
  const k = (kw || '').trim();
  if (!k || !ctx) return false;
  if (k === '素') {
    if (/荤素|素菜|素食|吃素|茹素|蔬菜/.test(ctx)) return false;
    return /绘事|素以为|文饰|质地|本质|礼后于质/.test(ctx);
  }
  if (k === '信') {
    // 「虽信实践…」=相信，非信用之信
    const epistemic =
      /虽信|相信|深信|坚信|确信|不信|可信(?!用)|信实践|信.*能改善|信.*会/.test(ctx);
    const promissory = /守信|信用|言可复|近于义|人而无信|无信|失信|诺言|答应|履约|言而有信/.test(
      ctx
    );
    if (epistemic && !promissory) return false;
    if (!ctx.includes('信')) return false;
    return promissory || (!epistemic && ctx.includes('信'));
  }
  return ctx.includes(k);
}

/** 应用领域匹配分：已标 sceneDomains 的条目严格执行，未标者中性 */
export function scoreSceneMatch(entry: CorpusEntry, userScenes: SceneDomain[] = []): number {
  const domains = entry.sceneDomains;
  if (!domains?.length) return 0;

  if (entry.sceneExclude?.some((s) => userScenes.includes(s))) return -120;

  const intersection = domains.filter((s) => userScenes.includes(s));
  if (intersection.length > 0) {
    const hasSituationMatch = intersection.some((s) => !CROSS_DOMAIN_SCENES.includes(s));
    return hasSituationMatch ? 22 : 10;
  }

  const entrySituations = domains.filter((s) => !CROSS_DOMAIN_SCENES.includes(s));
  const userSituations = getUserSituationScenes(userScenes);

  if (entrySituations.length > 0 && userSituations.length > 0) return -40;

  if (domains.every((s) => CROSS_DOMAIN_SCENES.includes(s))) return 6;

  if (userScenes.length === 0) return -8;

  return -18;
}

export function scoreEntry(
  entry: CorpusEntry,
  lens: UserLens | null | undefined,
  context?: {
    userInput?: string;
    condensed?: string;
    /** 联想语境（stretch）：等同一般对话的 condensed，在同 category 内打分 */
    associationQuery?: string;
    /** stretch：必须精确含该 category */
    requireCategoryExact?: boolean;
    usedCorpusIds?: string[];
    userScenes?: SceneDomain[];
  }
): number {
  if (!lens?.kind || !lens.key) return 0;
  let score = 0;
  const usedIds = new Set(context?.usedCorpusIds ?? []);

  if (context?.requireCategoryExact) {
    if (lens.kind !== 'category' || !entry.categories?.includes(lens.key)) return 0;
    score += 12;
  } else if (lens.kind === 'theme' && entry.themes?.includes(lens.key)) {
    score += 12;
  } else if (lens.kind === 'category') {
    const fam = formSubstanceCategoryMatch(lens.key, entry);
    if (fam === 'exact' || entry.categories?.includes(lens.key)) score += 12;
    else if (fam === 'family') score += 10;
    else {
      // 无同范畴/同族 → 不可靠弱分冒充命中（如无语料范畴靠 scene 命中 4.17）
      return 0;
    }
  } else if (
    lens.kind === 'theme' &&
    lens.key === '文/质' &&
    formSubstanceCategoryMatch(lens.key, entry) === 'family'
  ) {
    // themes 文/质 ↔ 语料本/末·体/用 同族
    score += 10;
  } else if (lens.kind === 'theme') {
    // theme 未命中 themes 列表则本条不计（与 category 对称）
    return 0;
  }
  // 一般：condensed=问旨；stretch：associationQuery 充当问旨
  const focusCtx = (context?.associationQuery || context?.condensed || '').trim();
  const ctx = `${context?.userInput || ''}${focusCtx}${lens.reinterpretation || ''}`;
  const frame =
    lens.kind === 'theme' && lens.key === '乐'
      ? pickLeJoyFrame(entry, lens, ctx)
      : findAttitudeFrameForScoring(entry, lens);

  if (frame) {
    if (lens.key === '乐' && isMusicYueFrame(frame) && !userDiscussesMusic(ctx)) {
      score -= 10;
    } else {
      score += 8;
    }
    // 极性对齐：用户在肯定德行时，勿锚到「斥伪/斥不及」且用户未谈该斥对象的条目
    score += scorePolarityAlignment(frame, lens, ctx, entry);
  }

  if (entry.annotationType === 'B' && lens.kind === 'category') score += 2;

  if (ctx.length > 0) {
    // 一般：condensed+原文+气质；stretch：与一般对话一样，语境比照以语料 condensed 为主
    const blob = context?.associationQuery
      ? entry.condensed || ''
      : `${entry.condensed}${entry.text}${(entry.temperaments || []).join('')}`;
    for (const kw of frame?.keywords || []) {
      if (keywordMatchesContext(kw, ctx)) score += 6;
    }
    for (const tok of ctx.matchAll(/[\u4e00-\u9fff]{2,}/g)) {
      const w = tok[0];
      if (w.length >= 2 && blob.includes(w)) score += 2;
    }
    if (lens.key === '乐' && /哈哈|呵呵|开心|高兴|喜悦|欢/.test(ctx)) {
      // 客套句首笑不给 乐 加分
      if (!/^[哈呵嘻]{2,}[,，!！。.\s~～]*.{6,}/.test(ctx.trim()) || /开心|高兴|喜悦/.test(ctx)) {
        if (blob.includes('说') || blob.includes('悦') || blob.includes('乐之')) score += 5;
      }
    }
    // 诚：近省察/内自省/不患人知；降权对人守约之信（輗軏）
    if (lens.key === '诚') {
      if (entry.themes?.includes('省察') || entry.themes?.includes('忠')) score += 8;
      if (/内自省|不患人|患其不能|见贤思齐|见不贤/.test(blob)) score += 10;
      if (/輗軏|人而无信|无友不如己|主忠信/.test(blob) && !/内自省|不患人/.test(blob)) {
        score -= 12;
      }
    }
    // 器用类 lens：优先 target=concept/behavior 而非评人条目
    if (lens.key === '工具与手段') {
      if (frame?.target === 'person' && !ctx.includes(frame.element?.slice(0, 2) || '')) {
        score -= 4;
      }
      if (blob.includes('器')) score += 3;
    }
    if (shouldPenalizeXiaoTiCorpus(ctx, entry.id, context?.userScenes)) {
      score -= 15;
    }
    if (shouldPenalizeCorpusEntry(ctx, entry.id, entry)) {
      score -= 28;
    }
  }

  score = boostWorkplaceCorpusScore(score, entry.id, ctx);
  score = penalizeUsedCorpusScore(score, entry.id, usedIds);
  score += scoreSceneMatch(entry, context?.userScenes);
  return score;
}

/** 主题名本身不算「谈到了批判对象」 */
const THEME_ONLY_TOKENS = new Set([
  '仁',
  '勇',
  '义',
  '礼',
  '智',
  '信',
  '忠',
  '恕',
  '孝',
  '悌',
  '德',
  '道',
  '学',
  '乐',
  '和',
  '中',
]);

/** 用户语境是否真正触及帧所斥/所论的具体对象（非仅同主题名） */
function userTouchesFrameObject(
  frame: {
    object?: string;
    element?: string;
    trigger?: string;
    keywords?: string[];
  },
  ctx: string,
): boolean {
  if (!ctx) return false;
  const parts = [frame.object, frame.element, frame.trigger, ...(frame.keywords || [])]
    .map((s) => (s || '').trim())
    .filter((s) => s.length >= 2 && !THEME_ONLY_TOKENS.has(s));
  for (const p of parts) {
    if (ctx.includes(p)) return true;
    if (p.length >= 4) {
      for (let i = 0; i <= p.length - 2; i++) {
        const bi = p.slice(i, i + 2);
        if (!THEME_ONLY_TOKENS.has(bi) && ctx.includes(bi)) return true;
      }
    }
  }
  return false;
}

/**
 * 检索极性对齐：
 * - 用户正向（关爱等）+ 帧为 reject，且未谈所斥对象 → 重罚（避免仁→巧言令色）
 * - 用户正向 + 帧为 praise / 态度0 → 加分
 */
function scorePolarityAlignment(
  frame: {
    confuciusStance?: string;
    attitudeLevel?: number;
    object?: string;
    element?: string;
    trigger?: string;
    keywords?: string[];
  },
  lens: UserLens,
  ctx: string,
  entry: CorpusEntry,
): number {
  const userPol = inferUserPolarity(lens.reinterpretation || '');
  if (userPol !== 'positive') return 0;

  const corpusPol = stancePolarity(frame.confuciusStance || '');
  let delta = 0;

  if (corpusPol === 'negative' && !userTouchesFrameObject(frame, ctx)) {
    delta -= 36;
  }
  if (corpusPol === 'positive' || frame.attitudeLevel === 0) {
    delta += 14;
  }
  // 「爱人 / 立人」类与关爱体贴同向
  const blob = `${entry.condensed || ''}${entry.text || ''}`;
  if (/爱人|立人|达人|节用而爱人/.test(blob) && /关爱|体贴|关心|关怀|在意|记挂|关照|关注/.test(ctx)) {
    delta += 18;
  }
  return delta;
}

function listScoredEntries(
  lens: UserLens,
  context?: {
    userInput?: string;
    condensed?: string;
    associationQuery?: string;
    requireCategoryExact?: boolean;
    excludeCorpusIds?: string[];
    /** 仅在这些 id 中选（stretch 化用裁决后的子集） */
    includeCorpusIds?: string[];
    usedCorpusIds?: string[];
    userScenes?: SceneDomain[];
  }
): { entry: CorpusEntry; score: number }[] {
  const excluded = new Set(context?.excludeCorpusIds ?? []);
  const included =
    context?.includeCorpusIds && context.includeCorpusIds.length > 0
      ? new Set(context.includeCorpusIds)
      : null;
  const scored: { entry: CorpusEntry; score: number }[] = [];
  for (const entry of ENTRIES) {
    if (excluded.has(entry.id)) continue;
    if (included && !included.has(entry.id)) continue;
    const s = scoreEntry(entry, lens, context);
    if (s > 0) scored.push({ entry, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * 在近顶分候选中轮换，避免同分时永远命中语料表靠前的一条（如 天→总中 3.24）。
 * stretch（有 associationQuery）时 margin 略宽。
 */
function pickAmongNearTop(
  scored: { entry: CorpusEntry; score: number }[],
  opts?: { diverse?: boolean; associationQuery?: string }
): CorpusEntry | null {
  if (scored.length === 0) return null;
  const best = scored[0].score;
  const margin = opts?.associationQuery || opts?.diverse ? 10 : 4;
  const poolSize = opts?.associationQuery || opts?.diverse ? 5 : 3;
  const pool = scored.filter((x) => x.score >= best - margin).slice(0, poolSize);
  if (pool.length === 1) return pool[0].entry;
  const i = Math.floor(Math.random() * pool.length);
  return pool[i].entry;
}

export function retrieveBestEntry(
  lens: UserLens,
  context?: {
    userInput?: string;
    condensed?: string;
    associationQuery?: string;
    requireCategoryExact?: boolean;
    excludeCorpusIds?: string[];
    includeCorpusIds?: string[];
    usedCorpusIds?: string[];
    userScenes?: SceneDomain[];
    /** 强制在近顶分中轮换（stretch 默认开） */
    diverse?: boolean;
  }
): CorpusEntry | null {
  const scored = listScoredEntries(lens, context);
  const diverse = context?.diverse ?? !!context?.associationQuery;
  return pickAmongNearTop(scored, {
    diverse,
    associationQuery: context?.associationQuery,
  });
}

/** 调试：返回同 lens 下前 N 条打分 */
export function debugTopScoredEntries(
  lens: UserLens,
  context?: Parameters<typeof listScoredEntries>[1],
  n = 15
): { id: string; score: number; categories: string[] }[] {
  return listScoredEntries(lens, context)
    .slice(0, n)
    .map(({ entry, score }) => ({
      id: entry.id,
      score,
      categories: entry.categories || [],
    }));
}

/** 同范畴内按一般 condensed 语境打分，取前若干条（供 stretch 化用裁决） */
export function listTopEntriesInCategory(
  lens: UserLens,
  context: {
    userInput?: string;
    condensed?: string;
    associationQuery?: string;
    excludeCorpusIds?: string[];
    usedCorpusIds?: string[];
    userScenes?: SceneDomain[];
  },
  limit = 12
): CorpusEntry[] {
  return listScoredEntries(lens, {
    ...context,
    requireCategoryExact: true,
  })
    .slice(0, limit)
    .map((x) => x.entry);
}

export function getAlignedFrame(entry: CorpusEntry, lens: UserLens, context = '') {
  const frames = entry.attitudeFrames || [];
  if (lens.kind === 'theme' && lens.key === '乐') {
    return pickLeJoyFrame(entry, lens, context) ?? frames[0] ?? null;
  }
  return findAttitudeFrame(entry, lens) ?? frames[0] ?? null;
}

/** 检索打分：仅精确 key / 形质族；禁止 theme 恕 误用同条「信」frame 加分 */
function findAttitudeFrameForScoring(entry: CorpusEntry, lens: UserLens) {
  const frames = entry.attitudeFrames || [];
  const exact = frames.find((f) => f.lensKind === lens.kind && f.lensKey === lens.key);
  if (exact) return exact;
  if (inFormSubstanceFamily(lens.key)) {
    return (
      frames.find((f) => f.lensKind === 'category' && FORM_SUBSTANCE_FAMILY.has(f.lensKey)) ||
      null
    );
  }
  return null;
}

/** 成句取态度：精确 → 形质族 → 同 kind 兜底 */
function findAttitudeFrame(entry: CorpusEntry, lens: UserLens) {
  const frames = entry.attitudeFrames || [];
  const scored = findAttitudeFrameForScoring(entry, lens);
  if (scored) return scored;
  return frames.find((f) => f.lensKind === lens.kind) || null;
}

export function getCorpusReinterp(entry: CorpusEntry, lens: UserLens): string {
  if (lens.kind === 'category') {
    const i = entry.categories?.indexOf(lens.key) ?? -1;
    if (i >= 0 && entry.temperaments?.[i]) return entry.temperaments[i];
    // 同族：取语料上第一个形质族 category 对应 temperament
    if (inFormSubstanceFamily(lens.key) && entry.categories?.length) {
      const fi = entry.categories.findIndex((c) => FORM_SUBSTANCE_FAMILY.has(c));
      if (fi >= 0 && entry.temperaments?.[fi]) return entry.temperaments[fi];
    }
  }
  return entry.condensed;
}

export function flattenLenses(lenses: UserLens[]) {
  return {
    themes: lenses.filter((l) => l.kind === 'theme').map((l) => l.key),
    categories: lenses.filter((l) => l.kind === 'category').map((l) => l.key),
  };
}

export type StancePolarity = 'positive' | 'negative' | 'neutral' | 'refuse';

export function stancePolarity(stance: string): StancePolarity {
  if (stance === 'praise') return 'positive';
  if (stance === 'reject' || stance === 'lament') return 'negative';
  if (stance === 'refuse_talk') return 'refuse';
  return 'neutral';
}

/** 屏蔽「不可 / 不能不 / 不得不」等，避免裸「不」误判 */
function maskProtectedNegationCompounds(text: string): string {
  return text
    .replace(/不可/g, '〇〇')
    .replace(/不能不/g, '〇〇〇')
    .replace(/不得不/g, '〇〇〇');
}

/** 轻量推断用户再解释极性（无 API）；正向标记优先于裸否定 */
export function inferUserPolarity(reinterp: string): StancePolarity {
  const t = reinterp || '';
  // 明确否定短语先于正向（避免「不敢为」命中「敢为」）
  const forNegEarly = maskProtectedNegationCompounds(t);
  if (/不敢为|退缩|无勇|可耻|见义不为/.test(forNegEarly)) {
    return 'negative';
  }
  if (
    /赞赏|嘉许|嘉|担当|义勇|可贵|好学|好之|乐之|君子/.test(t) ||
    /关爱|体贴|关心|关怀|在意|记挂|善意|温情|关照|体贴入微|推己及人/.test(t) ||
    /(?<!不)敢为/.test(t) ||
    /赞|好|善|仁|乐|悦|喜|宜|爱|学/.test(t)
  ) {
    return 'positive';
  }
  if (/不|非|无|失|谬|过|溢|伪|欺|盗|恶|小人|拒|远|罕言|不言/.test(forNegEarly)) {
    return 'negative';
  }
  return 'neutral';
}

export function compareAlignment(
  userReinterp: string,
  corpusStance: string
): { alignment: 'match' | 'mismatch'; reason: string } {
  const u = inferUserPolarity(userReinterp);
  const c = stancePolarity(corpusStance);
  if (c === 'refuse') {
    return { alignment: 'mismatch', reason: '语料侧拒言/疏远' };
  }
  if (u === c || u === 'neutral' || c === 'neutral') {
    return { alignment: 'match', reason: `极性同向或中性（user=${u}, corpus=${c}）` };
  }
  return { alignment: 'mismatch', reason: `极性相反（user=${u}, corpus=${c}）` };
}

export interface AttitudeInvertResult {
  attitude: number;
  /** 2/3 → 0：用户肯定所斥行为之反面 */
  inverted: boolean;
  /** 2/3 → 1：辨析/问询/恕以常情，未认同所斥行为 */
  softened: boolean;
  baseAttitude: number;
  reason: string;
}

export interface AttitudeResolveContext {
  userReinterp: string;
  /** 本轮问旨 condensed */
  condensed?: string;
  /** turnFocus.speechAct */
  speechAct?: string;
  /** 全部透镜（含恕等次要透镜） */
  lenses?: Array<{ key: string; reinterpretation?: string }>;
}

/** 辨析 / 恕常情 / 不谴责 —— 用户未站在「无勇」一边 */
function isDiscussOrShuTolerance(ctx: AttitudeResolveContext): boolean {
  const blob = [
    ctx.userReinterp || '',
    ctx.condensed || '',
    ...(ctx.lenses || []).map((l) => `${l.key}:${l.reinterpretation || ''}`),
  ].join('｜');

  if (/之辨|辨析|分辨|相较|对照/.test(blob)) return true;
  if (/常情|人之常情|不谴责|不予谴责|没法.*谴责|难以谴责|体察|宽容|不加苛责|不强责/.test(blob)) {
    return true;
  }
  if (
    (ctx.lenses || []).some((l) => l.key === '恕') &&
    /常情|体察|宽容|不谴责|不予谴责|不加苛责|恕/.test(blob)
  ) {
    return true;
  }
  if (ctx.speechAct === 'question') return true;
  return false;
}

/**
 * 负面帧态度合成：
 * - 2/3 + 用户正向 → 0（肯定所斥之反面）
 * - 2/3 + 同向批判 → 保持 2/3
 * - 2/3 + 辨析/问询/恕常情（未认同所斥）→ 1（温和述思，勿把批判对人）
 * - 0/1/4 不做映射
 */
/**
 * @deprecated 当期态度主路径已改为 `attitudeCompare.resolveAttitudeByReinterpCompare`。
 * 本函数保留供旧自测/对照；勿在 pipeline 中调用。
 */
export function resolveAttitudeWithNegativeInvert(
  frame: { attitudeLevel?: number; confuciusStance?: string } | null | undefined,
  userReinterpOrCtx: string | AttitudeResolveContext,
): AttitudeInvertResult {
  const ctx: AttitudeResolveContext =
    typeof userReinterpOrCtx === 'string'
      ? { userReinterp: userReinterpOrCtx }
      : userReinterpOrCtx;

  const baseAttitude =
    typeof frame?.attitudeLevel === 'number' ? frame.attitudeLevel : 1;
  const stance = frame?.confuciusStance ?? '';
  const corpusPol = stancePolarity(stance);
  const userPol = inferUserPolarity(ctx.userReinterp || '');

  const keep = (reason: string): AttitudeInvertResult => ({
    attitude: baseAttitude,
    inverted: false,
    softened: false,
    baseAttitude,
    reason,
  });

  if (
    !(baseAttitude === 2 || baseAttitude === 3) ||
    corpusPol !== 'negative'
  ) {
    return keep(`沿用语料帧态度（base=${baseAttitude}, user=${userPol}）`);
  }

  // 1) 肯定所斥之反面 → 欣赏
  if (userPol === 'positive') {
    return {
      attitude: 0,
      inverted: true,
      softened: false,
      baseAttitude,
      reason: `负面帧反推（base=${baseAttitude}, stance=${stance}, user=positive）→ 0`,
    };
  }

  // 2) 辨析 / 问询 / 恕以常情 → 温和述思（优先于「退缩」等词带来的负向极性）
  if (isDiscussOrShuTolerance(ctx)) {
    return {
      attitude: 1,
      inverted: false,
      softened: true,
      baseAttitude,
      reason: `负面帧软化（base=${baseAttitude}, 辨析/问询/恕常情）→ 1`,
    };
  }

  // 3) 同向批判所斥行为 → 保持批判/严厉
  if (userPol === 'negative') {
    return keep(`同向批判，保持帧态度（base=${baseAttitude}, user=negative）`);
  }

  return keep(`沿用语料帧态度（base=${baseAttitude}, user=${userPol}）`);
}

/**
 * 短桥物象：跟用户**强调**走（情感/评价所附着的对象），
 * 不硬编码「活动>地点」——地点仅当其本身被评价/强调时才可作主桥。
 */
const EMOTION =
  /开心|高兴|喜悦|喜欢|爱|爽|棒|不错|自责|难受|讨厌|恨|怒|气|激动|兴奋|满足/;
const PLACE_EMPHASIS =
  /终于.*(?:来|到)|人在|到了|来到|旅游|观光|打卡|第一次来|难得来|就爱这|喜欢这里|这里真/;
const ACTIVITY_OR_OBJECT =
  /健身|跑步|游泳|骑车|打球|瑜伽|力量|耐力|有氧|训练|锻炼|课业|作业|蛋黄酥|自行车|外卖|加班|考试|刷题/;
/** 食物/日用品：须保留可辨认全称，勿削成「粉」「片」 */
const FOOD_OR_PRODUCT =
  /豆浆粉|豆浆|麦片|燕麦片|燕麦|红茶|绿茶|花茶|咖啡|奶茶|酸奶|牛奶|泡面|方便面|蛋黄酥|面包|饼干|麦片粥/;
const CITY =
  /西安|北京|上海|广州|深圳|成都|杭州|南京|武汉|重庆|天津|苏州|长沙|郑州|青岛|沈阳|厦门|合肥|福州|济南|昆明|大连|兰州|海口/;

function isPlaceLike(word: string): boolean {
  const w = (word || '').trim();
  if (!w) return true;
  if (/^[东西南北]$/.test(w)) return true;
  if (CITY.test(w)) return true;
  if (/这边|那里|那儿|本地$/.test(w)) return true;
  return false;
}

/** 从原句捞可辨认物名（优先更长；味型词如「红茶」让位于「豆浆粉」等成品） */
export function extractIdentifiableObject(userInput: string): string | undefined {
  const src = userInput || '';
  const found: string[] = [];
  const foodRe = new RegExp(FOOD_OR_PRODUCT.source, 'g');
  for (const m of src.matchAll(foodRe)) found.push(m[0]);
  // 勿跨「的」：否则「味的豆浆粉」会整段吞进
  for (const m of src.matchAll(/[\u4e00-\u9fff]{2,3}(?:粉|片|酥|饼|粥|面)/g)) {
    if (!m[0].includes('的')) found.push(m[0]);
  }
  if (found.length === 0) return undefined;
  const uniq = [...new Set(found)]
    .filter((u) => !u.includes('的') && u.length >= 2)
    .sort((a, b) => b.length - a.length);
  if (uniq.length === 0) return undefined;
  // 「…味的X」：X 才是被评对象
  const afterWei = src.match(/味的([\u4e00-\u9fff]{2,6})/);
  if (afterWei?.[1]) {
    const hit = uniq.find((u) => afterWei[1].startsWith(u) || afterWei[1].includes(u));
    if (hit) return hit;
  }
  const product = uniq.find((u) => /(?:粉|片|酥|饼|粥|面)$/.test(u));
  return product || uniq[0];
}

export function extractConcreteHint(userInput: string, condensed?: string): string | undefined {
  // 以用户原句判强调；condensed 仅作补充，避免概括把地点提前导致偏题
  const primary = (userInput || condensed || '').replace(
    /我(?:妈|爸|家|自己)?(?:寄(?:的|来)?|送(?:的|来)?|给(?:的|来)?)?/g,
    ''
  );

  const city = primary.match(CITY)?.[0];
  const food = extractIdentifiableObject(primary);
  const activity = primary.match(ACTIVITY_OR_OBJECT)?.[0];
  const placeFocused = PLACE_EMPHASIS.test(primary);

  // 食物/日用物名优先（用户在评口味、冲泡、浓稠时）
  if (food && /好喝|味道|味|泡|冲|稠|浓|淡|适合|刚好|混|麦片|豆浆/.test(primary)) {
    return food;
  }

  // 荤素搭配：吃肉/蛋白质是手段，短桥用「荤素」勿落成「肉」
  if (/荤素|蛋白质|吃足肉|食肉|吃肉|蔬菜|吃素/.test(primary)) {
    if (/荤素|相济|搭配|合其度|合度|补.*不足|注意吃肉|看重吃足肉|蛋白质/.test(primary)) {
      if (/蛋白质/.test(primary) && !/荤素|蔬菜|吃素/.test(primary)) return '蛋白质';
      return '荤素';
    }
    if (/蔬菜/.test(primary) && !/肉|蛋白/.test(primary)) return '蔬菜';
    if (/蛋白质|吃足肉|食肉|吃肉|肉/.test(primary) && !/豆浆|麦片/.test(primary)) {
      return /蛋白质/.test(primary) ? '蛋白质' : '肉';
    }
    return '荤素';
  }

  // 进步/变化所系：「耐力好了」「力量提升」且句中有喜/评价
  const progress = primary.match(
    /([\u4e00-\u9fff]{2,4})(?:好了|进步|提升|改善|变强|增强)/
  );
  if (progress && !isPlaceLike(progress[1]) && EMOTION.test(primary)) {
    return progress[1];
  }

  // 「最后一天X」「今天X！」——感叹核
  const lastDay = primary.match(/(?:最后一天|今天)([\u4e00-\u9fff]{2,4})[！!]?/);
  if (lastDay && !isPlaceLike(lastDay[1])) return lastDay[1];

  if (food) return food;

  // 活动与地点并存：默认跟活动；仅当地点被强调时跟地点
  if (activity && city) {
    return placeFocused ? city : activity;
  }
  if (activity) return activity;
  if (city && placeFocused) return city;

  // 情感邻接：……，我很开心 / ……好开心 —— 取邻近实词（非地名状语）
  const joyNear = primary.match(
    /([\u4e00-\u9fff]{2,4})[^。！?]{0,8}(?:我)?(?:很|好)?(?:开心|高兴|喜悦)/
  );
  if (joyNear && !isPlaceLike(joyNear[1]) && !/^最近|今天|这边|那里$/.test(joyNear[1])) {
    return joyNear[1];
  }

  const beforeParticle = primary.match(/[\u4e00-\u9fff]{2,4}(?=快|要|很|太|不|将)/)?.[0];
  if (beforeParticle && !isPlaceLike(beforeParticle)) return beforeParticle;

  // 地点仅作「在X这边」状语且无地点强调 → 勿当 hint
  const m = primary.match(/[\u4e00-\u9fff]{2,4}/);
  if (m && !isPlaceLike(m[0])) return m[0];
  if (city && placeFocused) return city;
  if (activity) return activity;

  // condensed 里再试一次活动词
  const fromCondensed = (condensed || '').match(ACTIVITY_OR_OBJECT)?.[0];
  return fromCondensed || undefined;
}

export function lensKindLabel(kind: LensKind): string {
  return kind === 'theme' ? 'theme' : 'category';
}
