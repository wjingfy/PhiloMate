/**
 * 【极性筛查】语料选取固定层（与【成句bridge】/【联想bridge】无关）。
 * A 档：再解释｜标签 ↔ temperament｜标签 全等，才可入围。
 */
import categoriesVocab from '../../data/confucius/categories_vocabulary.json';
import type { CorpusEntry, UserLens } from './types';

type TagSpec = { group: string; allowed: string[] };

const guide = (
  categoriesVocab as {
    lensPolarityGuide?: {
      tagLexicon?: { byKey?: Record<string, TagSpec> };
    };
  }
).lensPolarityGuide?.tagLexicon;

const BY_KEY: Record<string, TagSpec> = guide?.byKey ?? {};

/** 所有允许标签（长的优先，避免「必」误吃「必有」等） */
const ALL_ALLOWED = Array.from(
  new Set(Object.values(BY_KEY).flatMap((s) => s.allowed))
).sort((a, b) => b.length - a.length);

const TAG_TAIL_RE = /｜([^｜]+)$/;

export function isPolarityGatedKey(key: string): boolean {
  return Boolean(BY_KEY[key]);
}

export function polarityAllowedTags(key: string): string[] {
  return BY_KEY[key]?.allowed ?? [];
}

export function polarityGroup(key: string): string | null {
  return BY_KEY[key]?.group ?? null;
}

/** 从再解释或 temperament 末尾取出封闭标签 */
export function extractPolarityTag(text: string | undefined | null, key?: string): string | null {
  const raw = (text || '').trim();
  if (!raw) return null;
  const m = raw.match(TAG_TAIL_RE);
  if (!m) return null;
  const cand = m[1].trim();
  if (key) {
    const allowed = BY_KEY[key]?.allowed;
    if (allowed?.includes(cand)) return cand;
    return null;
  }
  return ALL_ALLOWED.includes(cand) ? cand : null;
}

/** 去掉末尾极性标签（保留｜原句：…） */
export function stripPolarityTag(text: string): string {
  const tag = extractPolarityTag(text);
  if (!tag) return text;
  return text.replace(new RegExp(`｜${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '').trim();
}

/** 确保正文末尾为指定标签（替换旧标签或追加） */
export function ensurePolarityTag(text: string, tag: string): string {
  const body = stripPolarityTag((text || '').trim());
  if (!body) return `｜${tag}`;
  return `${body}｜${tag}`;
}

export function polarityTagsMatch(
  userTag: string | null,
  corpusTag: string | null,
  _key?: string
): boolean {
  if (!userTag || !corpusTag) return false;
  return userTag === corpusTag;
}

/**
 * 从语料取与 lens 可比对的极性标签。
 * 优先 categories 对齐的 temperament；同 group 的邻键 temperament 可作族内比对。
 */
export function corpusPolarityTagForLens(entry: CorpusEntry, lensKey: string): string | null {
  const spec = BY_KEY[lensKey];
  if (!spec) return null;
  const cats = entry.categories || [];
  const temps = entry.temperaments || [];

  const exactIdx = cats.indexOf(lensKey);
  if (exactIdx >= 0) {
    return extractPolarityTag(temps[exactIdx], lensKey);
  }

  const group = spec.group;
  for (let i = 0; i < cats.length; i++) {
    const ck = cats[i];
    if (polarityGroup(ck) !== group) continue;
    const t = extractPolarityTag(temps[i], ck);
    if (t && spec.allowed.includes(t)) return t;
  }
  return null;
}

/**
 * A 档硬门槛：用户再解释有合法标签时，语料须同向标签；缺标或反极 → 不可入围。
 * 非 A 档 / 用户尚无标签 → 不拦截（由 normalize 保证 A 档再解释带标）。
 */
export function passesPolarityGate(lens: UserLens, entry: CorpusEntry): boolean {
  if (lens.kind !== 'category' || !isPolarityGatedKey(lens.key)) return true;
  const userTag = extractPolarityTag(lens.reinterpretation, lens.key);
  if (!userTag) return false;
  const corpusTag = corpusPolarityTagForLens(entry, lens.key);
  return polarityTagsMatch(userTag, corpusTag, lens.key);
}
