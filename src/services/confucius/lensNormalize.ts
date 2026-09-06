import type { InputPath, LensExtractResult, LensKind, UserLens } from './types';

import categoriesVocab from '../../data/confucius/categories_vocabulary.json';
import themesVocab from '../../data/confucius/themes_vocabulary.json';
import { categoryKeyHasCorpus, categoryKeyToFamily, themeKeyHasCorpus, themeKeyToFamily } from './corpus';
import {
  ensurePolarityTag,
  extractPolarityTag,
  isPolarityGatedKey,
  polarityAllowedTags,
} from './polarityTag';

const CATEGORY_KEYS = new Set((categoriesVocab as { flatList: string[] }).flatList);
const THEME_KEYS = new Set((themesVocab as { coreThemes: string[] }).coreThemes);

/** 模型常写「名与实」等，归一到词表 key */
const CATEGORY_KEY_ALIASES: Record<string, string> = {
  名与实: '名/实',
  名实: '名/实',
  '自然与人为': '自然/人为',
  必然偶然: '必/偶',
  '必然/偶然': '必/偶',
  必偶: '必/偶',
  '本质与现象': '本质/现象',
  本质现象: '本质/现象',
  '量变与质变': '量变/质变',
  '器与内容': '工具与手段',
  '器/内容': '工具与手段',
  自我膨胀: '自恃',
  人与己: '人/己',
  人己: '人/己',
  '过度不及适度': '过度/不及/适度',
  '过度/不及': '过度/不及/适度',
};

export function canonicalizeLensKey(key: string): string {
  const t = (key || '').trim();
  if (!t) return t;
  if (CATEGORY_KEYS.has(t) || THEME_KEYS.has(t)) return t;
  return CATEGORY_KEY_ALIASES[t] || t;
}

export function inferLensKind(key: string, path: InputPath): LensKind {
  const k = canonicalizeLensKey(key);
  if (CATEGORY_KEYS.has(k) && !THEME_KEYS.has(k)) return 'category';
  if (THEME_KEYS.has(k) && !CATEGORY_KEYS.has(k)) return 'theme';
  if (CATEGORY_KEYS.has(k)) return 'category';
  if (THEME_KEYS.has(k)) return 'theme';
  return path === 'path2' ? 'category' : 'theme';
}

/** 模型未写尾标时，从再解释正文/mentionReason 粗推封闭标签 */
function inferPolarityTagFromProse(key: string, prose: string): string | null {
  const t = prose || '';
  const allowed = new Set(polarityAllowedTags(key));
  const pick = (tag: string) => (allowed.has(tag) ? tag : null);

  if (key === '名/实') {
    if (/名恶|实善|以为谄|遭诬|反被|实至名/.test(t)) return pick('名恶实善');
    if (/名善|实亏|名过|不副|外好内|有名无实/.test(t)) return pick('名善实亏');
    if (/相副|名实一|循名责实|名正/.test(t)) return pick('名实相副');
  }
  if (key === '本质/现象' || key === '隐/显' || key === '内/外') {
    if (/表负|里正|外愚|如愚|内明|内充|外困|似不足/.test(t)) return pick('表负里正');
    if (/表正|里负|里惑|里幽|外笃|迷茫|外荣|动于内|外好内不足/.test(t))
      return pick('表正里负');
    if (/表里如一|内外一贯/.test(t)) return pick('表里如一');
  }
  if (key === '文/质') {
    if (/文胜|质亏|华而无质|巧言/.test(t)) return pick('文胜质亏');
    if (/质立|先质|后文|绘事后素|以素为/.test(t)) return pick('质立文随');
    if (/文质相称|文质彬彬/.test(t)) return pick('文质相称');
  }
  if (key === '过度/不及/适度') {
    if (/过度|过中|失度|淫|太过/.test(t)) return pick('过度');
    if (/不及|不足|未及/.test(t)) return pick('不及');
    if (/适度|得中|中道|合度/.test(t)) return pick('适度');
  }
  if (key === '必/偶') {
    if (/偶发|偶然|或然|侥幸|非必然/.test(t)) return pick('偶');
    if (/必然|定数|必有|天命/.test(t)) return pick('必');
  }
  return null;
}

function normalizePolarityReinterpretation(key: string, reinterpretation: string, mentionReason?: string): string {
  const raw = (reinterpretation || '').trim() || '待察其度';
  if (!isPolarityGatedKey(key)) return raw;
  const existing = extractPolarityTag(raw, key);
  if (existing) return ensurePolarityTag(raw, existing);
  const inferred = inferPolarityTagFromProse(key, `${raw}${mentionReason || ''}`);
  if (inferred) return ensurePolarityTag(raw, inferred);
  return raw;
}

export function normalizeUserLens(raw: Partial<UserLens> | null | undefined, path: InputPath): UserLens {
  const key = canonicalizeLensKey((raw?.key || '').trim());
  // kind 须与词表归属一致（模型偶写 kind=theme 却给 category key）
  const rawKind =
    raw?.kind === 'theme' || raw?.kind === 'category' ? raw.kind : undefined;
  const kind =
    rawKind === 'theme' && THEME_KEYS.has(key)
      ? 'theme'
      : rawKind === 'category' && CATEGORY_KEYS.has(key)
        ? 'category'
        : inferLensKind(key, path);
  // 一级以 key 挂载为准（模型写错族名时纠偏，不丢键）
  const family =
    kind === 'theme'
      ? themeKeyToFamily(key) ?? undefined
      : categoryKeyToFamily(key) ?? undefined;
  const reinterpretation = normalizePolarityReinterpretation(
    key,
    raw?.reinterpretation?.trim() || '待察其度',
    raw?.mentionReason
  );
  return {
    kind,
    key,
    reinterpretation,
    mentionReason: raw?.mentionReason,
    family,
  };
}

/** theme → 问旨线索（用于在多个 theme 里选最贴的，非「数组第一个」） */
const THEME_CUES: Record<string, RegExp> = {
  政: /公器|报警|报官|有司|听讼|无讼|刑政|为政|诉公|官门|裁私|私怨.*公|公.*私/,
  战刑: /战|兵|杀|盗|刑戮|用兵/,
  怨: /怨|谤|坏话|毁谤|嫌隙/,
  德: /报德|以德|恩德/,
  礼: /礼|宽严|部属|居上|驭下/,
  仁: /仁|仁德/,
  义: /义|直躬|正直/,
  信: /信|交友|朋友|守约|失信/,
  省察: /自省|省察|夸|说得好|内自省|诚|无愧于|不愧对|良心|对得起自己|立诚|坦诚/,
  友: /友|交游|朋友/,
  学: /学|课业|作业/,
  孝: /孝|父母/,
  恕: /恕|推己/,
  怪力乱神: /星座|占卜|鬼神|怪力/,
  君子: /君子/,
  小人: /小人/,
  过: /过|改过/,
  改: /改过|勿惮改/,
};

function scoreThemeAgainstContext(lens: UserLens, context: string): number {
  const ctx = context || '';
  let score = 0;
  if (ctx.includes(lens.key)) score += 20;
  const cue = THEME_CUES[lens.key];
  if (cue?.test(ctx)) score += 18;
  for (const m of (lens.reinterpretation || '').matchAll(/[\u4e00-\u9fff]{2,}/g)) {
    if (ctx.includes(m[0])) score += 4;
  }
  for (const m of (lens.mentionReason || '').matchAll(/[\u4e00-\u9fff]{2,}/g)) {
    if (ctx.includes(m[0])) score += 2;
  }
  return score;
}

/**
 * path1：若 lenses 中有 theme，primary 必须是 theme。
 * - 模型已把 primary 指到 theme → 尊重
 * - primary 落在 category → 改到与问旨最贴的 theme（非数组下标 0）
 * - 仅有 category、无 theme → 保持（纯形上范畴合法）
 */
export function preferThemeAsPrimaryIndex(
  lenses: UserLens[],
  currentIndex: number,
  path: InputPath,
  context = ''
): number {
  if (path !== 'path1' || lenses.length === 0) return currentIndex;

  const safeIndex = Math.min(Math.max(0, currentIndex), lenses.length - 1);
  const themeIndices = lenses
    .map((l, i) => (l.kind === 'theme' ? i : -1))
    .filter((i) => i >= 0);

  if (themeIndices.length === 0) return safeIndex;
  if (lenses[safeIndex]?.kind === 'theme') return safeIndex;

  let bestIdx = themeIndices[0];
  let bestScore = -1;
  for (const i of themeIndices) {
    const s = scoreThemeAgainstContext(lenses[i], context);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * path2：词表约定「只出 categories」；primary 必须是 category。
 * （themes 如仁/饮食不得作 path2 检索主透镜，否则会误命中 1.3 巧言令色等）
 */
export function preferCategoryAsPrimaryIndex(
  lenses: UserLens[],
  currentIndex: number,
  path: InputPath
): number {
  if (path !== 'path2' || lenses.length === 0) return currentIndex;
  const safeIndex = Math.min(Math.max(0, currentIndex), lenses.length - 1);
  if (lenses[safeIndex]?.kind === 'category') return safeIndex;
  const catIdx = lenses.findIndex((l) => l.kind === 'category');
  return catIdx >= 0 ? catIdx : safeIndex;
}

/** path2：去掉德性 themes，只留 categories（与 themes_vocabulary inputPath2:不使用 一致） */
export function stripPath2Themes(lenses: UserLens[], path: InputPath): UserLens[] {
  if (path !== 'path2') return lenses;
  return lenses.filter((l) => l.kind === 'category');
}

/** key 是否在两份词表内（禁止模型自造 theme/category，如「思」） */
export function isVocabLensKey(key: string): boolean {
  const k = canonicalizeLensKey(key);
  return THEME_KEYS.has(k) || CATEGORY_KEYS.has(k);
}

export function sanitizeLensExtract(
  extract: LensExtractResult,
  path: InputPath,
  context = ''
): LensExtractResult {
  let lenses = (extract.lenses || [])
    .filter((l) => isVocabLensKey(l?.key || ''))
    .map((l) => normalizeUserLens(l, path))
    .filter((l) => l.key && l.reinterpretation && isVocabLensKey(l.key));

  lenses = stripPath2Themes(lenses, path);

  // 无语料覆盖的 theme/category 不得入选（与自然/人为、诚 等空覆盖同处理）
  lenses = lenses.filter((l) =>
    l.kind === 'theme' ? themeKeyHasCorpus(l.key) : categoryKeyHasCorpus(l.key)
  );

  // A 档：再解释必须带合法极性尾标（推断失败则丢该 lens）
  lenses = lenses.filter((l) => {
    if (l.kind !== 'category' || !isPolarityGatedKey(l.key)) return true;
    return Boolean(extractPolarityTag(l.reinterpretation, l.key));
  });

  // 无合法 lens 时保持空数组，禁止硬塞假范畴（人/己、过度/不及、学等）
  const ctx = context || `${extract.input || ''}${extract.condensed || ''}`;
  let primaryLensIndex = 0;
  if (lenses.length > 0) {
    primaryLensIndex = Math.min(
      Math.max(0, extract.primaryLensIndex ?? 0),
      lenses.length - 1
    );
    primaryLensIndex = preferThemeAsPrimaryIndex(lenses, primaryLensIndex, path, ctx);
    primaryLensIndex = preferCategoryAsPrimaryIndex(lenses, primaryLensIndex, path);
  }

  return {
    ...extract,
    path,
    lenses,
    primaryLensIndex,
  };
}

/**
 * path2：无张力 → 清空 lenses → 放宽再抽；有张力 → 保留 category 走一般路线。
 * hasTension 必须显式为 true 才保留；false/缺省一律清空。
 */
export function enforcePath2NoTensionEmpty(extract: LensExtractResult): LensExtractResult {
  if (extract.path !== 'path2') return extract;
  if (extract.hasTension === true) return extract;
  return {
    ...extract,
    hasTension: false,
    lenses: [],
    primaryLensIndex: 0,
  };
}

export function getPrimaryLens(
  extract: LensExtractResult,
  path: InputPath,
  context = ''
): UserLens | null {
  const sanitized = sanitizeLensExtract(extract, path, context);
  extract.lenses = sanitized.lenses;
  extract.primaryLensIndex = sanitized.primaryLensIndex;
  if (sanitized.lenses.length === 0) return null;
  return sanitized.lenses[sanitized.primaryLensIndex] ?? null;
}
