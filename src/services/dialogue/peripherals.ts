import type { PhilosopherId, RoleData, WastepaperRecord } from '../../types';
import { applySnackGiftFavorability } from '../snacks/favorability';
import { tryClaimWastepaperDrop, type WastepaperEntry } from '../wastepaper/logic';

export interface SnackCatalogItem {
  id: string;
  name?: string;
  displayName?: string;
  [key: string]: unknown;
}

let snackCache: Promise<SnackCatalogItem[]> | null = null;

export function loadSnackCatalog(): Promise<SnackCatalogItem[]> {
  if (!snackCache) {
    snackCache = fetch('/snacks/catalog.json')
      .then((response) => {
        if (!response.ok) throw new Error('snack_catalog_failed');
        return response.json();
      })
      .then((payload: unknown) => {
        if (Array.isArray(payload)) return payload as SnackCatalogItem[];
        const record = payload as { items?: SnackCatalogItem[] };
        return Array.isArray(record.items) ? record.items : [];
      });
  }
  return snackCache;
}

function normalizeWastepaper(entry: WastepaperRecord): WastepaperEntry | null {
  const quote = entry.quote ?? entry.text;
  if (!entry.id || !quote) return null;
  const rawType = entry.wastepaperType ?? entry.type;
  return {
    id: entry.id,
    sourceId: entry.sourceId ?? entry.id.split('#')[0] ?? entry.id,
    quoteIndex: entry.quoteIndex ?? 0,
    quote,
    wastepaperType: rawType === 2 || rawType === '2' ? 2 : 1,
  };
}

export function claimWastepaper(philosopherId: PhilosopherId, data: RoleData) {
  const entries = (data.wastepaper.entries ?? []).map(normalizeWastepaper).filter((item): item is WastepaperEntry => item !== null);
  return tryClaimWastepaperDrop(philosopherId, entries);
}

function evaluationText(data: RoleData, snackId: string): string {
  const evaluation = (data.snackEvaluations.evaluations ?? []).find((item) => item.id === snackId || item.snackId === snackId);
  if (!evaluation) return `${data.nameplate.displayName}收下了。`;
  for (const key of ['text', 'evaluation', 'comment', 'reply']) {
    const value = evaluation[key];
    if (typeof value === 'string' && value) return value;
  }
  return `${data.nameplate.displayName}收下了。`;
}

export function giveSnack(philosopherId: PhilosopherId, data: RoleData, snackId: string): { text: string; score: number; applied: boolean } {
  const result = applySnackGiftFavorability(philosopherId, 1);
  return { text: evaluationText(data, snackId), score: result.score, applied: result.applied };
}
