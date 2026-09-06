import type { ChatMessage, ConversationState, PhilosopherId, RoleData } from '../../types';
import {
  createConversationState,
  loadConversationState,
  loadMessages,
} from '../dialogue/stateStore';
import { getCurrentSlot, slotClaimKey } from '../wastepaper/logic';
import { hasLocalRecord, readLocalJson, writeLocalJson } from './storage';

function uid(prefix: string): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

const readJson = readLocalJson;
const writeJson = writeLocalJson;

// ---- Conversation sessions -------------------------------------------------

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  conversation: ConversationState;
}

export interface SessionBundle {
  activeId: string;
  sessions: ConversationSession[];
}

const SESSION_PREFIX = 'philomate_session_bundle_';

function sessionTitle(messages: ChatMessage[], fallback = '新的对话'): string {
  const firstUser = messages.find((message) => message.role === 'user')?.content.trim();
  return firstUser ? [...firstUser].slice(0, 18).join('') : fallback;
}

export function createSession(index = 1): ConversationSession {
  const now = new Date().toISOString();
  return {
    id: uid('session'),
    title: index === 1 ? '新的对话' : `新的对话 ${index}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
    conversation: createConversationState(),
  };
}

export function loadSessionBundle(philosopherId: PhilosopherId): SessionBundle {
  const key = `${SESSION_PREFIX}${philosopherId}`;
  const stored = readJson<Partial<SessionBundle> | null>(key, null);
  if (stored?.sessions?.length) {
    const sessions = stored.sessions.map((session) => ({
      ...session,
      messages: Array.isArray(session.messages) ? session.messages.slice(-100) : [],
      conversation: session.conversation ?? createConversationState(),
    }));
    const activeId = sessions.some((session) => session.id === stored.activeId)
      ? stored.activeId!
      : sessions[0]!.id;
    return { activeId, sessions };
  }

  const legacyMessages = loadMessages(philosopherId);
  const migrated = createSession();
  migrated.messages = legacyMessages;
  migrated.conversation = loadConversationState(philosopherId);
  migrated.title = sessionTitle(legacyMessages);
  const bundle = { activeId: migrated.id, sessions: [migrated] };
  writeJson(key, bundle);
  return bundle;
}

export function saveSessionBundle(philosopherId: PhilosopherId, bundle: SessionBundle): void {
  writeJson(`${SESSION_PREFIX}${philosopherId}`, bundle);
}

export function activeSession(bundle: SessionBundle): ConversationSession {
  return bundle.sessions.find((session) => session.id === bundle.activeId) ?? bundle.sessions[0]!;
}

export function updateActiveSession(
  philosopherId: PhilosopherId,
  bundle: SessionBundle,
  messages: ChatMessage[],
  conversation: ConversationState,
): SessionBundle {
  const now = new Date().toISOString();
  const sessions = bundle.sessions.map((session) => session.id === bundle.activeId ? {
    ...session,
    title: sessionTitle(messages, session.title),
    updatedAt: now,
    messages: messages.slice(-100),
    conversation,
  } : session);
  const next = { ...bundle, sessions };
  saveSessionBundle(philosopherId, next);
  return next;
}

export function addSession(philosopherId: PhilosopherId, bundle: SessionBundle): SessionBundle {
  const retained = bundle.sessions.filter((item) => item.messages.length > 0);
  const session = createSession(retained.length + 1);
  const next = { activeId: session.id, sessions: [session, ...retained] };
  saveSessionBundle(philosopherId, next);
  return next;
}

export function chooseSession(philosopherId: PhilosopherId, bundle: SessionBundle, sessionId: string): SessionBundle {
  if (!bundle.sessions.some((session) => session.id === sessionId)) return bundle;
  const next = { ...bundle, activeId: sessionId };
  saveSessionBundle(philosopherId, next);
  return next;
}

export function removeSession(philosopherId: PhilosopherId, bundle: SessionBundle, sessionId: string): SessionBundle {
  let sessions = bundle.sessions.filter((session) => session.id !== sessionId);
  if (!sessions.length) sessions = [createSession(1)];
  const activeId = bundle.activeId === sessionId ? sessions[0]!.id : bundle.activeId;
  const next = { activeId, sessions };
  saveSessionBundle(philosopherId, next);
  return next;
}

// ---- Snack inventory + delayed returns ------------------------------------

export interface SnackState {
  inventory: Record<string, number>;
  discovered: string[];
  lastDailyClaimKey: string;
  pendingReturns: Partial<Record<PhilosopherId, string[]>>;
}

const SNACK_STATE_KEY = 'philomate_snack_state_v3';
const DEFAULT_DISCOVERED_SNACKS = [
  'spicy_stick',
  'rouxsong_xiaobei',
  'beef_jerky',
  'chocolate',
  'boxed_milk',
];

export function loadSnackState(): SnackState {
  const state = readJson<Partial<SnackState>>(SNACK_STATE_KEY, {});
  return {
    inventory: state.inventory ?? {},
    discovered: [...new Set([...DEFAULT_DISCOVERED_SNACKS, ...(state.discovered ?? [])])],
    lastDailyClaimKey: state.lastDailyClaimKey ?? '',
    pendingReturns: state.pendingReturns ?? {},
  };
}

function saveSnackState(state: SnackState): void {
  writeJson(SNACK_STATE_KEY, state);
}

export function snackDayKey(now = new Date()): string {
  const shifted = new Date(now);
  shifted.setHours(shifted.getHours() - 4);
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ensureDailySnack(items: Array<{ id: string; obtain?: string }>, now = new Date()): string | null {
  const state = loadSnackState();
  const key = snackDayKey(now);
  if (state.lastDailyClaimKey === key) return null;
  const pool = items.filter((item) => item.obtain === 'daily_claim');
  const item = pool[Math.floor(Math.random() * pool.length)];
  state.lastDailyClaimKey = key;
  if (!item) {
    saveSnackState(state);
    return null;
  }
  state.inventory[item.id] = (state.inventory[item.id] ?? 0) + 1;
  if (!state.discovered.includes(item.id)) state.discovered.push(item.id);
  saveSnackState(state);
  return item.id;
}

export function consumeSnack(snackId: string): boolean {
  const state = loadSnackState();
  const count = state.inventory[snackId] ?? 0;
  if (count <= 0) return false;
  state.inventory[snackId] = count - 1;
  saveSnackState(state);
  return true;
}

export function restoreSnack(snackId: string): void {
  const state = loadSnackState();
  state.inventory[snackId] = (state.inventory[snackId] ?? 0) + 1;
  saveSnackState(state);
}

export function rollAndQueueSnackReturn(
  philosopherId: PhilosopherId,
  score: number,
  returnIds: string[],
): string | null {
  if (!returnIds.length) return null;
  const tier = score < 20 ? 0 : score < 40 ? 1 : score < 60 ? 2 : score < 80 ? 3 : score < 100 ? 4 : 5;
  const probability = [0, 0.1, 0.2, 0.3, 0.4, 0.5][tier] ?? 0;
  if (Math.random() >= probability) return null;
  const state = loadSnackState();
  const snackId = returnIds[Math.floor(Math.random() * returnIds.length)]!;
  state.pendingReturns[philosopherId] = [...(state.pendingReturns[philosopherId] ?? []), snackId];
  saveSnackState(state);
  return snackId;
}

export function pendingSnackReturns(philosopherId: PhilosopherId): string[] {
  return [...(loadSnackState().pendingReturns[philosopherId] ?? [])];
}

export function acceptSnackReturn(philosopherId: PhilosopherId, snackId: string): void {
  const state = loadSnackState();
  const queue = [...(state.pendingReturns[philosopherId] ?? [])];
  const index = queue.indexOf(snackId);
  if (index >= 0) queue.splice(index, 1);
  state.pendingReturns[philosopherId] = queue;
  state.inventory[snackId] = (state.inventory[snackId] ?? 0) + 1;
  if (!state.discovered.includes(snackId)) state.discovered.push(snackId);
  saveSnackState(state);
}

// ---- Reading shelf + draggable plants -------------------------------------

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  publisher: string;
  year: string;
  isbn13?: string;
  publishedDate?: string;
  edition?: string;
  translators?: string;
  description?: string;
  source?: string;
  fetchedAt?: string;
  fieldProvenance?: Record<string, string>;
  confidence?: number;
  totalPages: number;
  currentPage: number;
  coverUrl?: string;
  coverId?: string;
  plantId: string;
  createdAt: string;
  updatedAt: string;
  placement?: { x: number; y: number; z: number };
}

const LIBRARY_PREFIX = 'philomate_library_';
const SHARED_LIBRARY_KEY = 'philomate_library_shared_v1';

export function loadLibrary(_philosopherId: PhilosopherId): BookRecord[] {
  let books = readJson<BookRecord[]>(SHARED_LIBRARY_KEY, []);
  if (!hasLocalRecord(SHARED_LIBRARY_KEY)) {
    const merged = (['confucius', 'socrates', 'wangyangming', 'foucault'] as PhilosopherId[])
      .flatMap((id) => readJson<BookRecord[]>(`${LIBRARY_PREFIX}${id}`, []));
    books = [...new Map(merged.filter((book) => book?.id).map((book) => [book.id, book])).values()];
    writeJson(SHARED_LIBRARY_KEY, books);
  }
  return books
    .filter((book) => book?.id && book?.title)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function saveLibrary(_philosopherId: PhilosopherId, books: BookRecord[]): void {
  writeJson(SHARED_LIBRARY_KEY, books);
}

export function addBook(
  philosopherId: PhilosopherId,
  input: Omit<BookRecord, 'id' | 'createdAt' | 'updatedAt' | 'currentPage'> & { currentPage?: number },
): BookRecord[] {
  const existing = loadLibrary(philosopherId);
  const normalizedIsbn = input.isbn13?.replace(/[^0-9X]/gi, '');
  const duplicate = existing.find((book) => (
    normalizedIsbn && book.isbn13?.replace(/[^0-9X]/gi, '') === normalizedIsbn
  ) || (
    book.title.trim().toLocaleLowerCase() === input.title.trim().toLocaleLowerCase()
    && book.author.trim().toLocaleLowerCase() === input.author.trim().toLocaleLowerCase()
    && book.publisher.trim().toLocaleLowerCase() === input.publisher.trim().toLocaleLowerCase()
  ));
  if (duplicate) throw new Error(`这本书可能已经录入：${duplicate.title}`);
  const now = new Date().toISOString();
  const record: BookRecord = {
    ...input,
    id: uid('book'),
    currentPage: Math.max(0, Math.min(input.totalPages, input.currentPage ?? 0)),
    createdAt: now,
    updatedAt: now,
  };
  const next = [record, ...existing];
  saveLibrary(philosopherId, next);
  return next;
}

export function updateBook(
  philosopherId: PhilosopherId,
  bookId: string,
  changes: Partial<Pick<BookRecord, 'plantId' | 'title' | 'author' | 'publisher' | 'year' | 'totalPages' | 'coverId' | 'coverUrl'>>,
): BookRecord[] {
  const books = loadLibrary(philosopherId).map((book) => book.id === bookId ? {
    ...book,
    ...changes,
    currentPage: changes.totalPages === undefined ? book.currentPage : Math.min(book.currentPage, changes.totalPages),
    updatedAt: new Date().toISOString(),
  } : book);
  saveLibrary(philosopherId, books);
  return books;
}

export function updateBookProgress(philosopherId: PhilosopherId, bookId: string, currentPage: number): BookRecord[] {
  const books = loadLibrary(philosopherId).map((book) => book.id === bookId ? {
    ...book,
    currentPage: Math.max(0, Math.min(book.totalPages, currentPage)),
    updatedAt: new Date().toISOString(),
  } : book);
  saveLibrary(philosopherId, books);
  return books;
}

export function placeBookPlant(
  philosopherId: PhilosopherId,
  bookId: string,
  placement: BookRecord['placement'],
): BookRecord[] {
  const books = loadLibrary(philosopherId).map((book) => book.id === bookId ? {
    ...book,
    placement,
    updatedAt: new Date().toISOString(),
  } : book);
  saveLibrary(philosopherId, books);
  return books;
}

export function removeBook(philosopherId: PhilosopherId, bookId: string): BookRecord[] {
  const books = loadLibrary(philosopherId).filter((book) => book.id !== bookId);
  saveLibrary(philosopherId, books);
  return books;
}

// ---- Proactive speech archives --------------------------------------------

export interface PhilosophyRecord {
  id: string;
  questionId: string;
  theme: string;
  question: string;
  answer: string;
  evaluation: string;
  answeredAt: string;
}

interface ProactiveState {
  claimedSlots: Record<string, true>;
  usedQuestionIds: string[];
  unlockedExperienceIds: string[];
  seenExperienceIds: string[];
  philosophy: PhilosophyRecord[];
}

const PROACTIVE_PREFIX = 'philomate_proactive_';

function loadProactiveState(philosopherId: PhilosopherId): ProactiveState {
  const state = readJson<Partial<ProactiveState>>(`${PROACTIVE_PREFIX}${philosopherId}`, {});
  return {
    claimedSlots: state.claimedSlots ?? {},
    usedQuestionIds: state.usedQuestionIds ?? [],
    unlockedExperienceIds: state.unlockedExperienceIds ?? [],
    seenExperienceIds: state.seenExperienceIds ?? [],
    philosophy: state.philosophy ?? [],
  };
}

function saveProactiveState(philosopherId: PhilosopherId, state: ProactiveState): void {
  writeJson(`${PROACTIVE_PREFIX}${philosopherId}`, state);
}

export type ProactiveEvent =
  | {
      kind: 'question';
      id: string;
      theme: string;
      text: string;
      group: string;
      evalPoints: string[];
      attempts?: number;
    }
  | { kind: 'experience'; id: string; title: string; text: string };

export function rollProactiveEvent(philosopherId: PhilosopherId, data: RoleData, score: number): ProactiveEvent | null {
  const state = loadProactiveState(philosopherId);
  const { slot, dateKey } = getCurrentSlot();
  const claimKey = slotClaimKey(dateKey, slot);
  if (state.claimedSlots[claimKey]) return null;
  state.claimedSlots[claimKey] = true;
  const tier = score < 20 ? 0 : score < 40 ? 1 : score < 60 ? 2 : score < 80 ? 3 : score < 100 ? 4 : 5;
  const probability = tier * 0.2;
  if (Math.random() >= probability) {
    saveProactiveState(philosopherId, state);
    return null;
  }

  const questions = (data.questions.entries ?? []).filter((item) => {
    const id = typeof item.id === 'string' ? item.id : '';
    return id && !state.usedQuestionIds.includes(id);
  });
  const experiences = (data.experiences.experiences ?? []).filter((item) => {
    const id = typeof item.id === 'string' ? item.id : '';
    return id && !state.unlockedExperienceIds.includes(id);
  });
  const wantQuestion = Math.random() < 0.5;

  if ((wantQuestion && questions.length) || !experiences.length) {
    const item = questions[Math.floor(Math.random() * questions.length)];
    if (!item || typeof item.id !== 'string') {
      saveProactiveState(philosopherId, state);
      return null;
    }
    state.usedQuestionIds.push(item.id);
    saveProactiveState(philosopherId, state);
    return {
      kind: 'question',
      id: item.id,
      theme: typeof item.theme === 'string' ? item.theme : '未分类',
      text: typeof item.question === 'string' ? item.question : '',
      group: typeof item.group === 'string' ? item.group : '',
      evalPoints: Array.isArray(item.evalPoints)
        ? item.evalPoints.filter((point): point is string => typeof point === 'string')
        : [],
      attempts: 0,
    };
  }

  const item = experiences[Math.floor(Math.random() * experiences.length)];
  if (!item || typeof item.id !== 'string') {
    saveProactiveState(philosopherId, state);
    return null;
  }
  state.unlockedExperienceIds.push(item.id);
  saveProactiveState(philosopherId, state);
  return {
    kind: 'experience',
    id: item.id,
    title: typeof item.title === 'string' ? item.title : item.id,
    text: typeof item.monologue === 'string' ? item.monologue : typeof item.text === 'string' ? item.text : '',
  };
}

export function unlockedExperienceIds(philosopherId: PhilosopherId): string[] {
  return [...loadProactiveState(philosopherId).unlockedExperienceIds];
}

export function newExperienceIds(philosopherId: PhilosopherId): string[] {
  const state = loadProactiveState(philosopherId);
  return state.unlockedExperienceIds.filter((id) => !state.seenExperienceIds.includes(id));
}

export function markExperienceSeen(philosopherId: PhilosopherId, experienceId: string): void {
  const state = loadProactiveState(philosopherId);
  if (!state.seenExperienceIds.includes(experienceId)) state.seenExperienceIds.push(experienceId);
  saveProactiveState(philosopherId, state);
}

export function savePhilosophyRecord(
  philosopherId: PhilosopherId,
  record: Omit<PhilosophyRecord, 'id' | 'answeredAt'>,
): void {
  const state = loadProactiveState(philosopherId);
  state.philosophy.unshift({ ...record, id: uid('thought'), answeredAt: new Date().toISOString() });
  saveProactiveState(philosopherId, state);
}

export function loadPhilosophyRecords(philosopherId: PhilosopherId): PhilosophyRecord[] {
  return [...loadProactiveState(philosopherId).philosophy]
    .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
}
