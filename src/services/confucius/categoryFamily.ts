/**
 * 形质范畴族：本/末 · 文/质 · 体/用
 * - 本/末：最本体论（先后、本基）
 * - 文/质：偏静态呈现为人（categories 仅此项，勿再拆文、质）
 * - 体/用：偏动态指导行事
 * 检索时互通，不要求用户/标注 key 完全一致。
 */

export const FORM_SUBSTANCE_FAMILY = new Set([
  '本/末',
  '体/用',
  '文/质',
]);

export function inFormSubstanceFamily(key: string | null | undefined): boolean {
  return !!key && FORM_SUBSTANCE_FAMILY.has(key);
}

/** 语料 categories（及 overlap themes 文/质）是否与 lens 同族 */
export function entryInFormSubstanceFamily(entry: {
  categories?: string[];
  themes?: string[];
}): boolean {
  const cats = entry.categories || [];
  if (cats.some((c) => FORM_SUBSTANCE_FAMILY.has(c))) return true;
  const themes = entry.themes || [];
  return themes.includes('文/质');
}

export function formSubstanceCategoryMatch(
  lensKey: string,
  entry: { categories?: string[]; themes?: string[] }
): 'exact' | 'family' | null {
  if (!inFormSubstanceFamily(lensKey)) return null;
  const cats = entry.categories || [];
  if (cats.includes(lensKey)) return 'exact';
  if (lensKey === '文/质' && (entry.themes || []).includes('文/质')) return 'exact';
  if (entryInFormSubstanceFamily(entry)) return 'family';
  return null;
}
