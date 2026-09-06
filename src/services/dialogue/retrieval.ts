import type { CorpusEntryRecord, RoleData } from '../../types';

export interface RetrievalResult {
  path: 'path1' | 'path2';
  condensed: string;
  primaryLens: { kind: 'theme' | 'category'; key: string; reinterpretation: string } | null;
  entry: CorpusEntryRecord | null;
  frame: Record<string, unknown> | null;
  corpusTemperament: string;
  speechAct: string;
  corpusBridge?: string;
  lenses?: Array<{ kind: 'theme' | 'category'; key: string; reinterpretation: string; [key: string]: unknown }>;
  lensSource?: string;
  selectionSource?: string;
  hasTension?: boolean;
  candidateCount?: number;
  selectionReason?: string;
  dialogueMove?: string;
  targetClaim?: string;
  questionFocus?: string;
  newContribution?: string;
}

const WANG_SURFACE_THEME_MAP: Array<[string, string]> = [
  ['良知', '良知'],
  ['知行', '知行合一'],
  ['格物', '格物'],
  ['立志', '立志'],
  ['仙佛', '仙佛'],
  ['佛老', '仙佛'],
  ['佛教', '仙佛'],
  ['圣人', '圣人'],
];

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function ngrams(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[\s，。！？；：、“”‘’（）()【】\[\],.!?;:'"-]+/g, '');
  const chars = [...normalized];
  const grams: string[] = [];
  for (let index = 0; index < chars.length - 1; index += 1) grams.push(chars[index]! + chars[index + 1]!);
  const words = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  return unique([...grams, ...words]).slice(0, 80);
}

function exactLens(input: string, values: string[]): string | null {
  return values
    .filter((value) => value.length >= 1 && input.includes(value))
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

function entryScore(entry: CorpusEntryRecord, grams: string[], directKey: string | null): number {
  const themes = entry.themes ?? [];
  const categories = entry.categories ?? [];
  let score = directKey && [...themes, ...categories].includes(directKey) ? 30 : 0;
  const blob = `${entry.condensed} ${themes.join(' ')} ${categories.join(' ')}`.toLowerCase();
  for (const gram of grams) if (blob.includes(gram)) score += gram.length > 2 ? 3 : 1;
  return score;
}

function stableIndex(text: string, length: number): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return length ? Math.abs(hash) % length : 0;
}

function selectFrame(entry: CorpusEntryRecord, kind: 'theme' | 'category', key: string): Record<string, unknown> | null {
  const frames = entry.attitudeFrames ?? [];
  return (frames.find((frame) => frame.lensKind === kind && frame.lensKey === key) ?? frames[0] ?? null) as Record<string, unknown> | null;
}

function temperamentFor(entry: CorpusEntryRecord, kind: 'theme' | 'category', key: string): string {
  const temperatures = entry.temperaments ?? [];
  const keys = kind === 'category' ? entry.categories ?? [] : entry.themes ?? [];
  const index = keys.indexOf(key);
  return temperatures[index] ?? temperatures[0] ?? entry.condensed;
}

export function retrieveCorpus(input: string, data: RoleData, usedIds: string[]): RetrievalResult {
  const coveredThemes = data.coveredThemes.length ? data.coveredThemes : data.themes;
  const coveredCategories = data.coveredCategories.length ? data.coveredCategories : data.categories;
  const exactThemeKey = exactLens(input, coveredThemes);
  const wangSurfaceTheme = data.philosopherId === 'wangyangming'
    ? WANG_SURFACE_THEME_MAP.find(([word, theme]) => input.includes(word) && coveredThemes.includes(theme))?.[1] ?? null
    : null;
  const themeKey = exactThemeKey ?? wangSurfaceTheme;
  const categoryKey = exactLens(input, coveredCategories);
  const path: 'path1' | 'path2' = themeKey ? 'path1' : 'path2';
  const directKind: 'theme' | 'category' = themeKey ? 'theme' : 'category';
  const directKey = themeKey ?? categoryKey;
  const unused = data.corpus.filter((entry) => !usedIds.includes(entry.id));
  const pool = unused.length ? unused : data.corpus;
  const grams = ngrams(input);
  const ranked = pool
    .map((entry) => ({ entry, score: entryScore(entry, grams, directKey) }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  let entry = ranked[0]?.entry ?? null;
  if (ranked[0]?.score === 0 && pool.length) entry = pool[stableIndex(input, pool.length)] ?? entry;

  let key = directKey;
  let kind = directKind;
  if (!key && entry) {
    if (path === 'path1' && entry.themes?.length) {
      kind = 'theme';
      key = entry.themes[0] ?? null;
    } else if (entry.categories?.length) {
      kind = 'category';
      key = entry.categories[0] ?? null;
    } else if (entry.themes?.length) {
      kind = 'theme';
      key = entry.themes[0] ?? null;
    }
  }

  const primaryLens = key ? { kind, key, reinterpretation: `由“${key}”观察本轮处境` } : null;
  const speechAct = /[?？]|为何|怎么|如何|何为|是否|吗/.test(input) ? 'question' : 'statement';
  return {
    path,
    condensed: input.trim().slice(0, 120),
    primaryLens,
    entry,
    frame: entry && key ? selectFrame(entry, kind, key) : null,
    corpusTemperament: entry && key ? temperamentFor(entry, kind, key) : entry?.condensed ?? '',
    speechAct,
  };
}
