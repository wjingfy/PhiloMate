import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { RoleData } from '../src/types';
import { runDialoguePipeline } from '../src/services/dialogue/pipeline';
import { createConversationState } from '../src/services/dialogue/stateStore';

const projectRoot = resolve(import.meta.dirname, '..');
const dataRoot = resolve(projectRoot, 'src', 'data', 'socrates');
const apiOrigin = process.env.PHILOMATE_API_ORIGIN || 'http://121.40.225.165';

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataRoot, name), 'utf8')) as T;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const candidate = record.key ?? record.name ?? record.id ?? record.label;
      return typeof candidate === 'string' ? candidate : '';
    }
    return '';
  }).filter(Boolean);
}

const nameplate = readJson<Record<string, unknown>>('nameplate.json');
const themesVocabulary = readJson<Record<string, unknown>>('themes_vocabulary.json');
const categoriesVocabulary = readJson<Record<string, unknown>>('categories_vocabulary.json');
const covered = readJson<Record<string, unknown>>('covered.json');
const corpusPackage = readJson<{ entries?: unknown[] }>('corpus_annotated.json');

const data: RoleData = {
  philosopherId: 'socrates',
  nameplate: {
    displayName: typeof nameplate.displayName === 'string' ? nameplate.displayName : '苏格拉底',
    intro: typeof nameplate.intro === 'string' ? nameplate.intro : '',
  },
  attitudes: readJson<RoleData['attitudes']>('attitudes.json'),
  themes: stringList(themesVocabulary.coreThemes),
  categories: stringList(categoriesVocabulary.flatList),
  coveredThemes: stringList(covered.coveredThemes),
  coveredCategories: stringList(covered.coveredCategories),
  corpus: (Array.isArray(corpusPackage.entries) ? corpusPackage.entries : []) as RoleData['corpus'],
  distantCautious: readJson<RoleData['distantCautious']>('distant_cautious.json'),
  sensitive: readJson<RoleData['sensitive']>('sensitive_topics.json'),
  sentenceOrganization: readFileSync(resolve(dataRoot, 'sentence_organization.md'), 'utf8'),
  wastepaper: readJson<RoleData['wastepaper']>('wastepaper_corpus.json'),
  questions: readJson<RoleData['questions']>('proactive_questions.json'),
  experiences: readJson<RoleData['experiences']>('proactive_experiences.json'),
  snackEvaluations: readJson<RoleData['snackEvaluations']>('snack_evaluations.json'),
  snackReturns: readJson<RoleData['snackReturns']>('snack_return_pool.json'),
};

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() { return memory.size; },
  },
});

const nativeFetch = globalThis.fetch;
let requestPayloads: Array<Record<string, unknown>> = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = rawUrl.startsWith('/') ? `${apiOrigin}${rawUrl}` : rawUrl;
  if (url.endsWith('/api/chat') && typeof init?.body === 'string') {
    try {
      requestPayloads.push(JSON.parse(init.body) as Record<string, unknown>);
    } catch {
      // Keep the run going; the response status will still reveal a malformed request.
    }
  }
  return nativeFetch(url, init);
}) as typeof fetch;

const cases = [
  { id: 'S-D1', type: '日常', input: '刷短视频一刷就是两小时，停不下来' },
  { id: 'S-T1', type: '思想', input: '正义是不是强者的利益？' },
  { id: 'S-L1', type: '低落', input: '考研连着三次都没过，真的很挫败' },
  { id: 'S-R1', type: '轻闲聊', input: '今天好累' },
] as const;

const results = [];
for (const testCase of cases) {
  memory.clear();
  requestPayloads = [];
  const result = await runDialoguePipeline({
    philosopherId: 'socrates',
    userInput: testCase.input,
    data,
    state: createConversationState(),
    dialogueTurns: [],
  });
  const runtime = result.state.roleRuntime?.socratesDialogueState as Record<string, unknown> | undefined;
  const text = result.text ?? '';
  const modelRequests = requestPayloads.filter((payload) => payload.model === 'qwen3.8-max');
  const auxiliaryRequests = requestPayloads.filter((payload) => payload.model !== 'qwen3.8-max');
  results.push({
    ...testCase,
    output: text,
    chars: [...text].length,
    questions: (text.match(/[？?]/g) ?? []).length,
    oocHits: ['接住了', '接住你', '苏格拉底认为', '作为AI', '作为 AI', '作为人工智能']
      .filter((phrase) => text.includes(phrase)),
    mode: runtime?.lastMode ?? null,
    questionCooldown: runtime?.questionCooldown ?? null,
    path: result.debug.path,
    primaryLens: result.debug.primaryLens,
    corpusId: result.debug.corpusId,
    currentAttitude: result.debug.currentAttitude,
    finalAttitude: result.debug.finalAttitude,
    outputMode: result.debug.outputMode,
    sensitiveBucket: result.debug.sensitiveBucket,
    modelUsed: result.debug.modelUsed,
    replySource: result.debug.replySource,
    qwen38Requests: modelRequests.length,
    auxiliaryRequestModels: auxiliaryRequests.map((payload) => payload.model ?? null),
    qwen38RequestConfig: modelRequests.map((payload) => ({
      model: payload.model,
      enableThinking: payload.enableThinking,
      temperature: payload.temperature,
      topP: payload.topP,
      frequencyPenalty: payload.frequencyPenalty,
      presencePenalty: payload.presencePenalty,
      maxTokens: payload.maxTokens,
    })),
  });
}

process.stdout.write(`${JSON.stringify({
  generatedAt: new Date().toISOString(),
  apiOrigin,
  isolation: 'fresh conversation state and empty dialogue history for every case',
  results,
}, null, 2)}\n`);
