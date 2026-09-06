/**
 * 数据层：加载福柯合规语料（philomate-dialogue-v1，310 条）
 *   规训与惩罚 145 + 权力的眼睛 17 + 对活人的治理 148（旧交件包已合并为单一文件）
 * 根含 schemaVersion / philosopherId，entries 含 text / temperaments（B 类与 categories 等长）/ attitudeFrames（foucaultStance）。
 *
 * covered = 合并后语料实际挂过的 key（运行时重算）；透镜抽 key 只许从 covered 取（02 §0.1）。
 */
/* 补交修改：原工程读三个分包 JSON（dp/eop/hs），交件包改为读旧交件包已合并的
 * corpus_annotated.json（310 条，philomate-dialogue-v1），放置于 foucault/ 根目录。
 * 其余逻辑（covered 重算、索引、专名直挂）一字未动。 */
import corpusRaw from '../../../data/foucault/corpus_annotated.json';
import type { AnnotatedCorpus, CorpusEntry, AttitudeFrame } from './types';
import { STANCE_FIELD } from './types';

export const corpus = corpusRaw as unknown as AnnotatedCorpus;
export const entries: CorpusEntry[] = [...corpus.entries];

/* ---------------- covered 列表（运行时权威：合并后重算） ---------------- */

/** 有语料覆盖、允许进 lenses 的 theme key */
export const coveredThemes: string[] = [...new Set(entries.flatMap((e) => e.themes || []))];

/** 有语料覆盖、允许进 lenses 的 category key */
export const coveredCategories: string[] = [...new Set(entries.flatMap((e) => e.categories || []))];

export const coveredThemeSet = new Set(coveredThemes);
export const coveredCategorySet = new Set(coveredCategories);

/* ---------------- 同 key 索引（02 §7.1 入围池） ---------------- */

const byTheme = new Map<string, CorpusEntry[]>();
const byCategory = new Map<string, CorpusEntry[]>();

for (const e of entries) {
  for (const t of e.themes || []) {
    if (!byTheme.has(t)) byTheme.set(t, []);
    byTheme.get(t)!.push(e);
  }
  for (const c of e.categories || []) {
    if (!byCategory.has(c)) byCategory.set(c, []);
    byCategory.get(c)!.push(e);
  }
}

export function poolByLens(kind: 'theme' | 'category', key: string): CorpusEntry[] {
  const pool = kind === 'theme' ? byTheme.get(key) : byCategory.get(key);
  return pool ? [...pool] : [];
}

export function getEntryById(id: string): CorpusEntry | null {
  return entries.find((e) => e.id === id) || null;
}

/* ---------------- 专名直挂索引（书名号专名 + 人物专名 → 条目） ----------------
 * 透镜只从主题/范畴词表抽 key，书名与人物专名不在词表内，永抽不出；
 * 而标注时已在 attitudeFrames.keywords 与 exemplar.label 埋了专名锚点。
 * 两条窄通道防误命中（keywords 库含大量概念短语，不可全量做子串匹配）：
 *   ① 书名通道：用户输入带《》标记的书名 vs 索引专名（双向包含）
 *   ② 人物通道：exemplar.kind='person' 的专名做子串匹配（人名误命中面窄）
 */

const nameIndex: { name: string; ids: Set<string> }[] = [];

function addNameIndex(name: string, id: string): void {
  const n = name.replace(/[《》〈〉「」\s]/g, '');
  if (n.length < 2) return;
  if (coveredThemeSet.has(n) || coveredCategorySet.has(n)) return; // 词表 key 走透镜，不重复直挂
  const slot = nameIndex.find((x) => x.name === n);
  if (slot) slot.ids.add(id);
  else nameIndex.push({ name: n, ids: new Set([id]) });
}

for (const e of entries) {
  for (const f of e.attitudeFrames || []) {
    for (const k of f.keywords || []) addNameIndex(k, e.id);
  }
  if (e.exemplar?.label) addNameIndex(e.exemplar.label, e.id);
}

/** 人名直挂白名单：仅 exemplar.kind='person' 的专名参与子串匹配 */
const personNames: { name: string; ids: Set<string> }[] = (() => {
  const m = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.exemplar?.kind !== 'person') continue;
    const n = e.exemplar.label.replace(/[《》〈〉「」\s]/g, '');
    if (n.length < 2) continue;
    if (!m.has(n)) m.set(n, new Set());
    m.get(n)!.add(e.id);
  }
  return [...m.entries()].map(([name, ids]) => ({ name, ids }));
})();

export interface ProperNameHit {
  name: string;
  entryIds: string[];
}

/** 专名直挂匹配：命中返回专名与对应条目 id；未命中返回 null */
export function matchProperName(semanticInput: string): ProperNameHit | null {
  // ① 书名通道：《X》去标记后与索引专名双向包含（「我的隐秘生活」命中同名 keyword）
  const titles = [...semanticInput.matchAll(/《([^《》]{2,30})》/g)].map((m) => m[1].trim());
  for (const t of titles) {
    const ids = new Set<string>();
    for (const { name, ids: set } of nameIndex) {
      if (name === t || name.includes(t) || t.includes(name)) set.forEach((id) => ids.add(id));
    }
    if (ids.size > 0) return { name: t, entryIds: [...ids] };
  }
  // ② 人物通道：人名子串匹配
  for (const { name, ids } of personNames) {
    if (semanticInput.includes(name)) return { name, entryIds: [...ids] };
  }
  return null;
}

/* ---------------- 态度帧辅助（立场字段按算法动态读） ---------------- */

/** 读取帧立场：frame[philosopherId + "Stance"]，禁止写死人名 */
export function readStance(frame: AttitudeFrame): string {
  const v = frame[STANCE_FIELD];
  return typeof v === 'string' ? v : 'neutral_explain';
}

export function readAttitudeLevel(frame: AttitudeFrame): number {
  const v = frame.attitudeLevel;
  return typeof v === 'number' ? v : 1;
}

/**
 * 取与 lens 同格的态度帧（03 §7.1 getAlignedFrame 的对应实现）
 * 优先 lensKind+lensKey 全同；其次 lensKey 相同。
 */
export function getAlignedFrame(entry: CorpusEntry, kind: 'theme' | 'category', key: string): AttitudeFrame | null {
  const frames = entry.attitudeFrames || [];
  return (
    frames.find((f) => f.lensKind === kind && f.lensKey === key) ||
    frames.find((f) => f.lensKey === key) ||
    null
  );
}

/**
 * 可比再解释（02 §7.2）：
 * category → temperaments[i]（i 使 categories[i]===key）；无则 condensed
 * theme → condensed
 */
export function getReinterpretationSource(entry: CorpusEntry, kind: 'theme' | 'category', key: string): string {
  if (kind === 'category') {
    const i = (entry.categories || []).indexOf(key);
    const temps = entry.temperaments || [];
    if (i >= 0 && temps[i]) return temps[i];
  }
  return entry.condensed;
}
