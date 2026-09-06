/** 废纸团 · 时段掉落 + 收集图鉴（试做） */

export type WastepaperType = 1 | 2;
import { readLocalJson, writeLocalJson } from '../ui/storage';

export interface WastepaperEntry {
  id: string;
  sourceId: string;
  quoteIndex: number;
  quote: string;
  wastepaperType: WastepaperType;
}

export type WastepaperSlot = 's4' | 's12' | 's20';

export interface CollectedItem {
  id: string;
  sourceId: string;
  quote: string;
  wastepaperType: WastepaperType;
  collectedAt: string;
}

export interface WastepaperState {
  /** e.g. "2026-07-13_s12" */
  claimedSlots: Record<string, true>;
  /** unique by corpus id */
  collected: Record<string, CollectedItem>;
}

const STORAGE_PREFIX = 'philomate_wastepaper_';
const FAVORABILITY_PREFIX = 'philomate_favorability_';

export function getFavorabilityScore(philosopherId: string): number {
  try {
    const parsed = readLocalJson<{ score?: number } | number | null>(`${FAVORABILITY_PREFIX}${philosopherId}`, null);
    if (parsed === null) return 0;
    if (typeof parsed === 'number') return parsed;
    if (typeof parsed?.score === 'number') return parsed.score;
  } catch {
    /* ignore */
  }
  return 0;
}

/** 好感档 → 类型二概率 */
export function type2Probability(score: number): number {
  if (score < 20) return 0;
  if (score < 40) return 0.02;
  if (score < 60) return 0.04;
  if (score < 80) return 0.06;
  if (score < 100) return 0.08;
  return 0.1;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 4:00–12:00 → s4；12:00–20:00 → s12；20:00–次日4:00 → s20
 * 跨日的 s20 用「开始日」作为 dateKey（20:00 当天）
 */
export function getCurrentSlot(now = new Date()): { slot: WastepaperSlot; dateKey: string } {
  const h = now.getHours();
  if (h >= 4 && h < 12) {
    return { slot: 's4', dateKey: formatDateKey(now) };
  }
  if (h >= 12 && h < 20) {
    return { slot: 's12', dateKey: formatDateKey(now) };
  }
  if (h >= 20) {
    return { slot: 's20', dateKey: formatDateKey(now) };
  }
  // 0:00–4:00 → 前一日 20:00 场
  const prev = new Date(now);
  prev.setDate(prev.getDate() - 1);
  return { slot: 's20', dateKey: formatDateKey(prev) };
}

export function slotClaimKey(dateKey: string, slot: WastepaperSlot): string {
  return `${dateKey}_${slot}`;
}

function emptyState(): WastepaperState {
  return { claimedSlots: {}, collected: {} };
}

export function loadWastepaperState(philosopherId: string): WastepaperState {
  try {
    const parsed = readLocalJson<WastepaperState | null>(`${STORAGE_PREFIX}${philosopherId}`, null);
    if (!parsed) return emptyState();
    return {
      claimedSlots: parsed.claimedSlots || {},
      collected: parsed.collected || {},
    };
  } catch {
    return emptyState();
  }
}

export function saveWastepaperState(philosopherId: string, state: WastepaperState): void {
  writeLocalJson(`${STORAGE_PREFIX}${philosopherId}`, state);
}

export function sortCorpusIds(a: string, b: string): number {
  const [am, af] = a.split('#');
  const [bm, bf] = b.split('#');
  const [ac, an] = am.split('.').map(Number);
  const [bc, bn] = bm.split('.').map(Number);
  if (ac !== bc) return ac - bc;
  if (an !== bn) return an - bn;
  const ai = af != null ? Number(af) : -1;
  const bi = bf != null ? Number(bf) : -1;
  return ai - bi;
}

export function listCollected(state: WastepaperState): CollectedItem[] {
  return Object.values(state.collected).sort((x, y) => sortCorpusIds(x.id, y.id));
}

export function rollWastepaperEntry(
  corpus: WastepaperEntry[],
  score: number
): WastepaperEntry | null {
  if (!corpus.length) return null;
  const p2 = type2Probability(score);
  const wantType: WastepaperType = Math.random() < p2 ? 2 : 1;
  const pool = corpus.filter((e) => e.wastepaperType === wantType);
  const use = pool.length ? pool : corpus.filter((e) => e.wastepaperType === 1);
  if (!use.length) return null;
  return use[Math.floor(Math.random() * use.length)]!;
}

export interface DropResult {
  entry: WastepaperEntry;
  slotKey: string;
  isNewCollect: boolean;
}

/**
 * 若本时段尚未领取，则掷骰、记领取、写入图鉴，返回本次条目；否则 null。
 */
export function tryClaimWastepaperDrop(
  philosopherId: string,
  corpus: WastepaperEntry[],
  now = new Date()
): DropResult | null {
  const { slot, dateKey } = getCurrentSlot(now);
  const slotKey = slotClaimKey(dateKey, slot);
  const state = loadWastepaperState(philosopherId);
  if (state.claimedSlots[slotKey]) return null;

  const score = getFavorabilityScore(philosopherId);
  const entry = rollWastepaperEntry(corpus, score);
  if (!entry) return null;

  state.claimedSlots[slotKey] = true;
  const isNewCollect = !state.collected[entry.id];
  state.collected[entry.id] = {
    id: entry.id,
    sourceId: entry.sourceId,
    quote: entry.quote,
    wastepaperType: entry.wastepaperType,
    collectedAt: now.toISOString(),
  };
  saveWastepaperState(philosopherId, state);
  return { entry, slotKey, isNewCollect };
}
