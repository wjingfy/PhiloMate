import catalogJson from '../../data/snacks/catalog.json';

export interface SnackCatalogItem {
  id: string;
  name: string;
  displayName?: string;
  obtain?: 'daily_claim' | 'philosopher_return';
  fromPhilosopher?: string;
  context?: string;
  note?: string;
  source?: string;
}

const items = (catalogJson as { items: SnackCatalogItem[] }).items;

export function getSnackCatalog(): SnackCatalogItem[] {
  return items;
}

export function getSnackById(id: string): SnackCatalogItem | undefined {
  return items.find((s) => s.id === id);
}

/** 日领池：仅 daily_claim */
export function pickRandomSnackId(): string {
  const pool = items.filter((s) => s.obtain !== 'philosopher_return');
  const use = pool.length ? pool : items;
  const i = Math.floor(Math.random() * use.length);
  return use[i]?.id ?? 'spicy_stick';
}
