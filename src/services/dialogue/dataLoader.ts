import type { PhilosopherId, RoleData } from '../../types';

const cache = new Map<PhilosopherId, Promise<RoleData>>();

export const CONFUCIUS_FULL_CORPUS_MIN_ENTRIES = 500;
const CONFUCIUS_CORPUS_VERSION = '20260906-full-512-caution-5-27';

export function shouldLoadCompleteCorpus(philosopherId: PhilosopherId, corpusCount: number): boolean {
  return philosopherId === 'confucius' && corpusCount < CONFUCIUS_FULL_CORPUS_MIN_ENTRIES;
}

async function fetchWithRetry(path: string): Promise<Response> {
  const useCache = typeof caches !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  const cache = useCache ? await caches.open('philomate-role-data-v1') : null;
  const cached = cache ? await cache.match(path) : undefined;
  if (cached) {
    const activeCache = cache!;
    void fetch(path, { cache: 'no-cache' }).then((response) => {
      if (response.ok) return activeCache.put(path, response.clone());
    }).catch(() => undefined);
    return cached;
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(path, { cache: 'default', signal: controller.signal });
      if (response.ok || response.status < 500) {
        if (cache && response.ok) await cache.put(path, response.clone());
        return response;
      }
      lastError = new Error(`data_load_failed:${path}:${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timer);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(`data_load_failed:${path}`);
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetchWithRetry(path);
  if (!response.ok) throw new Error(`data_load_failed:${path}:${response.status}`);
  return response.json() as Promise<T>;
}

async function loadText(path: string): Promise<string> {
  const response = await fetchWithRetry(path);
  if (!response.ok) throw new Error(`data_load_failed:${path}:${response.status}`);
  return response.text();
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const candidate = record.key ?? record.name ?? record.id ?? record.label;
        return typeof candidate === 'string' ? candidate : '';
      }
      return '';
    })
    .filter(Boolean);
}

async function fetchRoleData(philosopherId: PhilosopherId): Promise<RoleData> {
  const base = `/${philosopherId}`;
  const results: PromiseSettledResult<unknown>[] = await Promise.allSettled([
    loadJson<Record<string, unknown>>(`${base}/nameplate.json`),
    loadJson<Record<string, unknown>>(`${base}/attitudes.json`),
    loadJson<Record<string, unknown>>(`${base}/themes_vocabulary.json`),
    loadJson<Record<string, unknown>>(`${base}/categories_vocabulary.json`),
    loadJson<Record<string, unknown>>(`${base}/covered.json`),
    Promise.resolve({ entries: [] }),
    loadJson<unknown>(`${base}/distant_cautious.json`),
    loadJson<RoleData['sensitive']>(`${base}/sensitive_topics.json`),
    loadText(`${base}/sentence_organization.md`),
    loadJson<RoleData['wastepaper']>(`${base}/wastepaper_corpus.json`),
    loadJson<RoleData['questions']>(`${base}/proactive_questions.json`),
    loadJson<RoleData['experiences']>(`${base}/proactive_experiences.json`),
    loadJson<RoleData['snackEvaluations']>(`${base}/snack_evaluations.json`),
    loadJson<RoleData['snackReturns']>(`${base}/snack_return_pool.json`),
  ]);
  if (results[5]?.status !== 'fulfilled') throw results[5]?.reason ?? new Error('role_corpus_unavailable');
  const value = <T>(index: number, fallback: T): T => results[index]?.status === 'fulfilled'
    ? results[index].value as T
    : fallback;
  const nameplate = value<Record<string, unknown>>(0, {});
  const attitudes = value<Record<string, unknown>>(1, {});
  const themesVocabulary = value<Record<string, unknown>>(2, {});
  const categoriesVocabulary = value<Record<string, unknown>>(3, {});
  const covered = value<Record<string, unknown>>(4, {});
  const corpusPackage = value<{ entries?: unknown[] }>(5, {});
  const distantCautious = value<unknown>(6, {});
  const sensitive = value<RoleData['sensitive']>(7, {});
  const sentenceOrganization = value<string>(8, '');
  const wastepaper = value<RoleData['wastepaper']>(9, { entries: [] });
  const questions = value<RoleData['questions']>(10, { entries: [] });
  const experiences = value<RoleData['experiences']>(11, { experiences: [] });
  const snackEvaluations = value<RoleData['snackEvaluations']>(12, { evaluations: [] });
  const snackReturns = value<RoleData['snackReturns']>(13, { items: [] });

  const displayName = typeof nameplate.displayName === 'string' ? nameplate.displayName : philosopherId;
  const intro = typeof nameplate.intro === 'string' ? nameplate.intro : '';
  const corpus = Array.isArray(corpusPackage.entries) ? corpusPackage.entries : [];

  return {
    philosopherId,
    nameplate: { displayName, intro },
    attitudes,
    themes: stringList(themesVocabulary.coreThemes),
    categories: stringList(categoriesVocabulary.flatList),
    coveredThemes: stringList(covered.coveredThemes),
    coveredCategories: stringList(covered.coveredCategories),
    corpus: corpus as RoleData['corpus'],
    distantCautious,
    sensitive,
    sentenceOrganization,
    wastepaper,
    questions,
    experiences,
    snackEvaluations,
    snackReturns,
  };
}

export function loadRoleData(philosopherId: PhilosopherId): Promise<RoleData> {
  const existing = cache.get(philosopherId);
  if (existing) return existing;
  const request = fetchRoleData(philosopherId).catch((error) => {
    cache.delete(philosopherId);
    throw error;
  });
  cache.set(philosopherId, request);
  return request;
}

export function clearRoleDataCache(): void {
  cache.clear();
}

export async function hydrateRoleCorpus(philosopherId: PhilosopherId, query: string, data: RoleData): Promise<RoleData> {
  // 孔子原生管线必须先在完整的 covered/lens 空间中抽取透镜，再按透镜建立候选池。
  // 若先以用户原句做词面 Top-K，会在透镜尚未确定前误删可用语料，导致本地可选而网页无典。
  // 完整语料只在首次发送孔子消息时加载；fetchWithRetry 会写入浏览器 Cache Storage，
  // 后续消息直接复用内存中的 512 条，不重复请求。其他角色仍沿用轻量 Top-K。
  if (philosopherId === 'confucius') {
    if (!shouldLoadCompleteCorpus(philosopherId, data.corpus.length)) return data;
    const payload = await loadJson<{ entries?: RoleData['corpus'] }>(
      `/confucius/corpus_annotated.json?v=${CONFUCIUS_CORPUS_VERSION}`,
    );
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    if (!entries.length) throw new Error('confucius_full_corpus_empty');
    data.corpus = entries;
    return data;
  }
  const response = await fetchWithRetry(`/api/corpus/search?role=${philosopherId}&q=${encodeURIComponent(query)}&limit=28`);
  if (!response.ok) throw new Error('corpus_search_failed');
  const payload = await response.json() as { entries?: RoleData['corpus'] };
  const incoming = Array.isArray(payload.entries) ? payload.entries : [];
  const merged = new Map([...data.corpus, ...incoming].map((entry) => [entry.id, entry]));
  data.corpus = [...merged.values()].slice(-120);
  return data;
}
