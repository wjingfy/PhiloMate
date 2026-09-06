const DATABASE = 'philomate-media';
const STORE = 'book-covers';
const VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开图片存储'));
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(',', 2);
  const type = header?.match(/^data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const binary = atob(body ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('封面读取失败'));
    reader.readAsDataURL(blob);
  });
}

export async function saveBookCover(id: string, source: string | Blob): Promise<void> {
  const database = await openDatabase();
  const blob = typeof source === 'string' ? dataUrlToBlob(source) : source;
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('封面保存失败'));
  });
  database.close();
}

export async function loadBookCover(id: string): Promise<string | null> {
  const database = await openDatabase();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error('封面读取失败'));
  });
  database.close();
  return blob ? URL.createObjectURL(blob) : null;
}

export async function removeBookCover(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('封面删除失败'));
  });
  database.close();
}

export async function exportBookCovers(): Promise<Record<string, string>> {
  const database = await openDatabase();
  const records = await new Promise<Array<[string, Blob]>>((resolve, reject) => {
    const output: Array<[string, Blob]> = [];
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(output);
      output.push([String(cursor.key), cursor.value as Blob]);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('封面导出失败'));
  });
  database.close();
  return Object.fromEntries(await Promise.all(records.map(async ([id, blob]) => [id, await blobToDataUrl(blob)])));
}

export async function importBookCovers(records: Record<string, string> | undefined): Promise<void> {
  if (!records) return;
  await Promise.all(Object.entries(records).map(([id, dataUrl]) => saveBookCover(id, dataUrl)));
}
