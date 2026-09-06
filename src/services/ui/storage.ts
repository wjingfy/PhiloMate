export type StorageStatus = 'saving' | 'saved' | 'failed';

export interface StorageStatusDetail {
  status: StorageStatus;
  key?: string;
  message?: string;
}

const EVENT_NAME = 'philomate-storage-status';
const DATABASE = 'philomate-state';
const STORE = 'records';
const DATABASE_VERSION = 1;
const DATA_SCHEMA_VERSION = 2;
const memory = new Map<string, string>();
let initialized = false;
let databasePromise: Promise<IDBDatabase> | null = null;

function announce(detail: StorageStatusDetail): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<StorageStatusDetail>(EVENT_NAME, { detail }));
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本机数据存储'));
  });
  return databasePromise;
}

function idbEntries(database: IDBDatabase): Promise<Array<[string, string]>> {
  return new Promise((resolve, reject) => {
    const output: Array<[string, string]> = [];
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(output);
      if (typeof cursor.value === 'string') output.push([String(cursor.key), cursor.value]);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('本机数据读取失败'));
  });
}

function commitEntries(database: IDBDatabase, entries: Array<[string, string]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const [key, value] of entries) store.put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('本机数据写入失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('本机数据事务已取消'));
  });
}

function migrateRecord(key: string, raw: string): string {
  try {
    const value = JSON.parse(raw) as unknown;
    if (key === 'philomate_storage_meta') {
      return JSON.stringify({ schemaVersion: DATA_SCHEMA_VERSION, migratedAt: new Date().toISOString() });
    }
    return JSON.stringify(value);
  } catch {
    return raw;
  }
}

/** Hydrate the synchronous in-memory facade, then atomically migrate legacy localStorage records. */
export async function initializeStorage(): Promise<void> {
  if (initialized) return;
  if (typeof indexedDB === 'undefined') {
    announce({ status: 'failed', message: 'IndexedDB 不可用，已降级到浏览器兼容存储，请尽快导出备份。' });
    return;
  }
  try {
    const database = await openDatabase();
    for (const [key, value] of await idbEntries(database)) memory.set(key, migrateRecord(key, value));
    const legacy: Array<[string, string]> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const value = key ? localStorage.getItem(key) : null;
      if (key?.startsWith('philomate_') && value !== null && !memory.has(key)) legacy.push([key, migrateRecord(key, value)]);
    }
    if (legacy.length) {
      await commitEntries(database, legacy);
      for (const [key, value] of legacy) {
        memory.set(key, value);
        localStorage.removeItem(key);
      }
    }
    const metadata = JSON.stringify({ schemaVersion: DATA_SCHEMA_VERSION, migratedAt: new Date().toISOString() });
    await commitEntries(database, [['philomate_storage_meta', metadata]]);
    memory.set('philomate_storage_meta', metadata);
    initialized = true;
  } catch {
    databasePromise = null;
    initialized = false;
    announce({ status: 'failed', message: 'IndexedDB 不可用，已降级到浏览器兼容存储，请尽快导出备份。' });
  }
}

function fallbackRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  if (!initialized && typeof localStorage !== 'undefined') return localStorage.getItem(key);
  return null;
}

export function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = fallbackRaw(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function hasLocalRecord(key: string): boolean {
  return fallbackRaw(key) !== null;
}

export function writeLocalJson(key: string, value: unknown): boolean {
  announce({ status: 'saving', key });
  let raw: string;
  try {
    raw = JSON.stringify(value);
  } catch {
    announce({ status: 'failed', key, message: '数据无法序列化，现有记录未被覆盖。' });
    return false;
  }
  if (!initialized || typeof indexedDB === 'undefined') {
    try {
      localStorage.setItem(key, raw);
      announce({ status: 'saved', key });
      return true;
    } catch {
      announce({ status: 'failed', key, message: '浏览器存储空间不足，现有记录未被覆盖。' });
      return false;
    }
  }
  memory.set(key, raw);
  void openDatabase().then((database) => commitEntries(database, [[key, raw]])).then(
    () => announce({ status: 'saved', key }),
    () => announce({ status: 'failed', key, message: '本机保存失败，数据仍保留在当前页面，请立即导出备份。' }),
  );
  return true;
}

export function removeLocalItem(key: string): boolean {
  memory.delete(key);
  if (!initialized || typeof indexedDB === 'undefined') {
    try { localStorage.removeItem(key); return true; } catch { return false; }
  }
  void openDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  })).then(
    () => announce({ status: 'saved', key }),
    () => announce({ status: 'failed', key, message: '无法清理本机记录。' }),
  );
  return true;
}

export function onStorageStatus(listener: (detail: StorageStatusDetail) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<StorageStatusDetail>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

export interface LocalBackup {
  product: 'PhiloMate';
  schemaVersion: 2;
  exportedAt: string;
  origin: string;
  records: Record<string, string>;
  bookCovers?: Record<string, string>;
}

export function createLocalBackup(): LocalBackup {
  const records = Object.fromEntries([...memory.entries()].filter(([key]) => key.startsWith('philomate_')));
  if (!initialized && typeof localStorage !== 'undefined') {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const value = key ? localStorage.getItem(key) : null;
      if (key?.startsWith('philomate_') && value !== null && !(key in records)) records[key] = value;
    }
  }
  return { product: 'PhiloMate', schemaVersion: 2, exportedAt: new Date().toISOString(), origin: window.location.origin, records };
}

export async function restoreLocalBackup(input: unknown): Promise<number> {
  if (!input || typeof input !== 'object') throw new Error('备份文件格式不正确');
  const backup = input as Partial<LocalBackup> & { schemaVersion?: number };
  if (backup.product !== 'PhiloMate' || ![1, 2].includes(backup.schemaVersion ?? 0) || !backup.records) {
    throw new Error('不是可识别的 PhiloMate 备份');
  }
  const entries = Object.entries(backup.records)
    .filter(([key, value]) => key.startsWith('philomate_') && typeof value === 'string')
    .map(([key, value]) => [key, migrateRecord(key, value)] as [string, string]);
  for (const [, value] of entries) JSON.parse(value);
  if (!initialized || typeof indexedDB === 'undefined') {
    const previous = entries.map(([key]) => [key, localStorage.getItem(key)] as const);
    try {
      for (const [key, value] of entries) localStorage.setItem(key, value);
      for (const [key, value] of entries) memory.set(key, value);
      announce({ status: 'saved', message: `已恢复 ${entries.length} 项本机数据。` });
      return entries.length;
    } catch {
      for (const [key, value] of previous) {
        try {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch { /* The browser denied fallback storage entirely. */ }
      }
      throw new Error('兼容存储空间不足，备份未完整恢复');
    }
  }
  const database = await openDatabase();
  await commitEntries(database, entries);
  for (const [key, value] of entries) memory.set(key, value);
  announce({ status: 'saved', message: `已恢复 ${entries.length} 项本机数据。` });
  return entries.length;
}
