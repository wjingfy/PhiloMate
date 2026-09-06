import './styles.css';
import {
  PHILOSOPHER_IDS,
  type ChatMessage,
  type ConversationState,
  type PhilosopherId,
  type PipelineDebugView,
  type RoleData,
} from './types';
import { clearRoleDataCache, hydrateRoleCorpus, loadRoleData } from './services/dialogue/dataLoader';
import { runDialoguePipeline } from './services/dialogue/pipeline';
import { createConversationState } from './services/dialogue/stateStore';
import { getFavorabilityState } from './services/snacks/favorability';
import { listCollected, loadWastepaperState, type DropResult } from './services/wastepaper/logic';
import { claimWastepaper, giveSnack, loadSnackCatalog, type SnackCatalogItem } from './services/dialogue/peripherals';
import {
  acceptSnackReturn,
  activeSession,
  addBook,
  addSession,
  chooseSession,
  consumeSnack,
  ensureDailySnack,
  loadLibrary,
  loadPhilosophyRecords,
  loadSessionBundle,
  loadSnackState,
  markExperienceSeen,
  newExperienceIds,
  pendingSnackReturns,
  placeBookPlant,
  removeBook,
  removeSession,
  restoreSnack,
  rollAndQueueSnackReturn,
  rollProactiveEvent,
  savePhilosophyRecord,
  unlockedExperienceIds,
  updateActiveSession,
  updateBook,
  updateBookProgress,
  type BookRecord,
  type ProactiveEvent,
  type SessionBundle,
} from './services/ui/productState';
import {
  createLocalBackup,
  initializeStorage,
  onStorageStatus,
  readLocalJson,
  restoreLocalBackup,
  writeLocalJson,
  type StorageStatus,
} from './services/ui/storage';
import {
  exportBookCovers,
  importBookCovers,
  loadBookCover,
  removeBookCover,
  saveBookCover,
} from './services/ui/coverStore';
import { downloadEncryptedBackup, uploadEncryptedBackup } from './services/ui/cloudSync';
import classroomBackground from './ui/assets/backgrounds/classroom-optimized.webm';
import classroomPoster from './ui/assets/backgrounds/classroom-poster.webp';
import confuciusPortrait from './ui/assets/dialogue/optimized/confucius-800.webp';
import socratesPortrait from './ui/assets/dialogue/optimized/socrates-800.webp';
import wangyangmingPortrait from './ui/assets/dialogue/optimized/wangyangming-800.webp';
import foucaultPortrait from './ui/assets/dialogue/optimized/foucault-800.webp';
import confuciusPortraitSmall from './ui/assets/dialogue/optimized/confucius-480.webp';
import socratesPortraitSmall from './ui/assets/dialogue/optimized/socrates-480.webp';
import wangyangmingPortraitSmall from './ui/assets/dialogue/optimized/wangyangming-480.webp';
import foucaultPortraitSmall from './ui/assets/dialogue/optimized/foucault-480.webp';
import {
  BRAND_ART,
  FEATURE_ART,
  ICON_ART,
  PLANT_ART,
  SNACK_ART,
  SNACK_ATLAS_ART,
  SNACK_GIFT_ART,
  SNACK_LOCKED_ART,
  avatarFor,
  dialogueActionFor,
  plantVisualForProgress,
  type ArtIconName,
} from './ui/art';

type Feature = 'notes' | 'career' | 'thoughts' | 'window';
type WindowPanel = 'none' | 'records' | 'arrange' | 'add' | 'sync';
type AutoEventFrequency = 'off' | 'low' | 'normal';

interface BookCandidate {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  translators?: string[];
  publisher?: string;
  publishedDate?: string;
  edition?: string;
  isbn13?: string;
  pageCount?: number | null;
  description?: string;
  coverUrl?: string;
  sources: string[];
  fetchedAt: string;
  fieldProvenance: Record<string, string>;
  conflicts: Record<string, Array<{ value: string | number; source: string }>>;
  confidence: number;
}

interface BookDraft extends BookCandidate {
  query?: string;
}

const ROLE_META: Record<PhilosopherId, { name: string; tone: string; lifespan: string }> = {
  confucius: { name: '孔子', tone: '仁与礼', lifespan: '公元前551—前479' },
  socrates: { name: '苏格拉底', tone: '诘问与澄清', lifespan: '公元前470—前399' },
  wangyangming: { name: '王阳明', tone: '良知与工夫', lifespan: '1472—1529' },
  foucault: { name: '福柯', tone: '权力与话语', lifespan: '1926—1984' },
};

const ROLE_PORTRAIT: Record<PhilosopherId, string> = {
  confucius: confuciusPortrait,
  socrates: socratesPortrait,
  wangyangming: wangyangmingPortrait,
  foucault: foucaultPortrait,
};

const ROLE_PORTRAIT_SMALL: Record<PhilosopherId, string> = {
  confucius: confuciusPortraitSmall,
  socrates: socratesPortraitSmall,
  wangyangming: wangyangmingPortraitSmall,
  foucault: foucaultPortraitSmall,
};

const LIFE_STAGE_LABELS: Record<string, string> = {
  youth: '早年',
  zhao: '昭公时期',
  ding: '定公时期',
  travel: '周游列国',
  return: '归鲁之后',
  late: '晚年',
};

type EntryEvent =
  | { kind: 'paper'; drop: DropResult }
  | { kind: 'return'; snackId: string }
  | ProactiveEvent;

interface ViewState {
  screen: 'selection' | 'room';
  philosopherId: PhilosopherId;
  data: RoleData | null;
  bundle: SessionBundle | null;
  conversation: ConversationState;
  messages: ChatMessage[];
  freshConversation: boolean;
  debug: PipelineDebugView | null;
  busy: boolean;
  error: string | null;
  panel: { kind: 'help' | 'ban'; lines: string[] } | null;
  modelConfigured: boolean;
  snackCatalog: SnackCatalogItem[];
  toast: string | null;
  feature: Feature | null;
  moreOpen: boolean;
  historyOpen: boolean;
  profileOpen: boolean;
  snackOpen: boolean;
  snackAtlasOpen: boolean;
  selectedSnackId: string | null;
  atlasSnackId: string | null;
  snackReply: string | null;
  entryQueue: EntryEvent[];
  entryStage: number;
  activeQuestion: Extract<ProactiveEvent, { kind: 'question' }> | null;
  notesPage: number;
  thoughtsTheme: string | null;
  careerExperienceId: string | null;
  windowPanel: WindowPanel;
  books: BookRecord[];
  actionPlaying: boolean;
  bookCoverData: string | null;
  bookDraft: BookDraft | null;
  bookSearchBusy: boolean;
  bookSearchError: string | null;
  bookCandidates: BookCandidate[];
  storageStatus: StorageStatus;
  storageMessage: string;
  autoEventsDisabled: boolean;
  autoEventFrequency: AutoEventFrequency;
  bookCoverUrls: Record<string, string>;
  syncConfigured: boolean;
  syncBusy: boolean;
}

const view: ViewState = {
  screen: 'selection',
  philosopherId: 'confucius',
  data: null,
  bundle: null,
  conversation: createConversationState(),
  messages: [],
  freshConversation: true,
  debug: null,
  busy: false,
  error: null,
  panel: null,
  modelConfigured: false,
  snackCatalog: [],
  toast: null,
  feature: null,
  moreOpen: false,
  historyOpen: false,
  profileOpen: false,
  snackOpen: false,
  snackAtlasOpen: false,
  selectedSnackId: null,
  atlasSnackId: null,
  snackReply: null,
  entryQueue: [],
  entryStage: 0,
  activeQuestion: null,
  notesPage: 0,
  thoughtsTheme: null,
  careerExperienceId: null,
  windowPanel: 'none',
  books: [],
  actionPlaying: false,
  bookCoverData: null,
  bookDraft: null,
  bookSearchBusy: false,
  bookSearchError: null,
  bookCandidates: [],
  storageStatus: 'saved',
  storageMessage: '仅保存在本机',
  autoEventsDisabled: false,
  autoEventFrequency: 'normal',
  bookCoverUrls: {},
  syncConfigured: false,
  syncBusy: false,
};

const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) throw new Error('Missing #app');
const app = appElement;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

type NoteHighlightColor = 'blue' | 'green' | 'orange';
interface NoteHighlight { start: number; end: number; color: NoteHighlightColor }

function noteHighlightStorageKey(): string {
  return `philomate_note_highlights_${view.philosopherId}`;
}

function loadNoteHighlights(): Record<string, NoteHighlight[]> {
  try {
    return readLocalJson<Record<string, NoteHighlight[]>>(noteHighlightStorageKey(), {});
  } catch {
    return {};
  }
}

function renderHighlightedQuote(noteId: string, quote: string): string {
  const ranges = (loadNoteHighlights()[noteId] ?? [])
    .filter((item) => Number.isInteger(item.start) && Number.isInteger(item.end) && item.start >= 0 && item.end > item.start && item.end <= quote.length)
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = '';
  for (const range of ranges) {
    if (range.start < cursor) continue;
    html += escapeHtml(quote.slice(cursor, range.start));
    html += `<mark class="note-highlight ${range.color}">${escapeHtml(quote.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  return html + escapeHtml(quote.slice(cursor));
}

function formatCollectedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function saveNoteHighlight(noteId: string, start: number, end: number, color: NoteHighlightColor | null): void {
  const all = loadNoteHighlights();
  const remaining = (all[noteId] ?? []).filter((item) => item.end <= start || item.start >= end);
  if (color) remaining.push({ start, end, color });
  all[noteId] = remaining.sort((a, b) => a.start - b.start);
  writeLocalJson(noteHighlightStorageKey(), all);
}

function openNoteHighlightPalette(paragraph: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!paragraph.contains(range.startContainer) || !paragraph.contains(range.endContainer)) return;
  const prefix = document.createRange();
  prefix.selectNodeContents(paragraph);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  const end = start + range.toString().length;
  if (end <= start) return;

  document.querySelector('.note-highlight-palette')?.remove();
  const rect = range.getBoundingClientRect();
  const palette = document.createElement('div');
  palette.className = 'note-highlight-palette';
  palette.setAttribute('role', 'toolbar');
  palette.setAttribute('aria-label', '荧光笔颜色');
  palette.innerHTML = `<button data-highlight-color="blue" aria-label="蓝色荧光笔" title="蓝色荧光笔"></button><button data-highlight-color="green" aria-label="绿色荧光笔" title="绿色荧光笔"></button><button data-highlight-color="orange" aria-label="橙色荧光笔" title="橙色荧光笔"></button><button data-highlight-color="clear" class="clear-highlight" aria-label="清除荧光笔" title="清除荧光笔">×</button>`;
  document.body.appendChild(palette);
  palette.style.left = `${Math.max(8, Math.min(window.innerWidth - palette.offsetWidth - 8, rect.left + rect.width / 2 - palette.offsetWidth / 2))}px`;
  palette.style.top = `${Math.max(8, rect.top - palette.offsetHeight - 8)}px`;

  const dismiss = (event: PointerEvent) => {
    if (!palette.contains(event.target as Node)) {
      palette.remove();
      document.removeEventListener('pointerdown', dismiss, true);
    }
  };
  document.addEventListener('pointerdown', dismiss, true);
  palette.querySelectorAll<HTMLButtonElement>('[data-highlight-color]').forEach((button) => button.addEventListener('click', () => {
    const value = button.dataset.highlightColor;
    const color = value === 'clear' ? null : value as NoteHighlightColor;
    saveNoteHighlight(paragraph.dataset.noteId ?? '', start, end, color);
    document.removeEventListener('pointerdown', dismiss, true);
    selection.removeAllRanges();
    palette.remove();
    render();
  }));
}

function messageId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function isValidIsbn13(value: string): boolean {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === Number(value[12]);
}

function textFromRecord(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

let toastTimer: number | null = null;
let actionTimer: number | null = null;
let entryAnimationTimer: number | null = null;
let entryDismissTimer: number | null = null;
let snackReplyTimer: number | null = null;
let storageStatusTimer: number | null = null;

onStorageStatus((detail) => {
  view.storageStatus = detail.status;
  view.storageMessage = detail.message ?? (detail.status === 'saving' ? '正在保存…' : '已保存 · 仅在本机');
  if (storageStatusTimer !== null) window.clearTimeout(storageStatusTimer);
  if (detail.status === 'failed') {
    showToast(view.storageMessage);
    return;
  }
  if (view.feature === 'window' && view.windowPanel === 'records') render();
  if (detail.status === 'saved') {
    storageStatusTimer = window.setTimeout(() => {
      view.storageStatus = 'saved';
      view.storageMessage = '仅保存在本机';
      storageStatusTimer = null;
      if (view.feature === 'window' && view.windowPanel === 'records') render();
    }, 1600);
  }
});

function showToast(message: string): void {
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  view.toast = message;
  render();
  toastTimer = window.setTimeout(() => {
    if (view.toast === message) {
      view.toast = null;
      render();
    }
    toastTimer = null;
  }, 2400);
}

function playCharacterActionOnce(): void {
  if (!dialogueActionFor(view.philosopherId, view.debug?.currentAttitude)) return;
  if (actionTimer !== null) window.clearTimeout(actionTimer);
  view.actionPlaying = true;
  actionTimer = window.setTimeout(() => {
    view.actionPlaying = false;
    actionTimer = null;
    render();
  }, 3000);
}

function icon(name: ArtIconName): string {
  return `<img class="art-icon" src="${ICON_ART[name]}" alt="" aria-hidden="true">`;
}

function selectionHtml(): string {
  const buttons = PHILOSOPHER_IDS.map((id) => `<button class="selection-hotspot selection-${id}" data-select-role="${id}">
    <span>${ROLE_META[id].name}</span>
  </button>`).join('');
  return `<main class="selection-screen">
    <div class="selection-art-frame">
      <img src="${BRAND_ART.selectionScreen}" alt="PhiloMate 哲学家同桌选择页">
      <div class="selection-hit-layer">${buttons}</div>
    </div>
    <div class="selection-mobile-cards">
      ${PHILOSOPHER_IDS.map((id) => `<button data-select-role="${id}"><img loading="lazy" decoding="async" src="${BRAND_ART.selectionCharacters[id]}" alt=""><strong>${ROLE_META[id].name}</strong><small>${ROLE_META[id].tone}</small></button>`).join('')}
    </div>
    <p class="selection-value">四位有立场、有依据、会记得相处方式的哲学同桌</p>
  </main>`;
}

function messagesHtml(): string {
  const active = view.activeQuestion;
  const proactive = active ? `<article class="message assistant proactive-question"><div><small>想听听你的看法</small>${escapeHtml(active.text)}</div></article>` : '';
  if (!view.messages.length && !active) return '';
  return `${proactive}${view.messages.map((message) => `<article class="message ${message.role}">
    <span class="message-label">${message.role === 'user' ? '我' : escapeHtml(view.data?.nameplate.displayName ?? ROLE_META[view.philosopherId].name)}</span>
    <div>${escapeHtml(message.content)}${message.role === 'assistant' && message.evidenceText ? `<details class="thought-basis"><summary>思想依据</summary><p>${escapeHtml(message.evidenceText)}</p><small>${escapeHtml([message.evidenceSource, message.evidenceChapter, message.evidenceId ? `语料 ${message.evidenceId}` : ''].filter(Boolean).join(' · '))}</small><small>${message.generated ? '本回复由模型结合材料生成，不等同于哲学家原话。' : '相关材料仅用于说明回应依据。'}</small><a href="https://www.baidu.com/s?wd=${encodeURIComponent(message.evidenceText.slice(0, 80))}" target="_blank" rel="noopener noreferrer">核验出处</a></details>` : ''}</div>
  </article>`).join('')}`;
}

function sceneToolsHtml(): string {
  return `<nav class="scene-tools" aria-label="场景功能">
    <button data-open-feature="window" title="窗台" aria-label="窗台">${icon('window')}<span class="icon-label">窗台</span></button>
    <button id="open-snacks" title="书包与零食" aria-label="书包与零食">${icon('bag')}<span class="icon-label">书包</span></button>
    <div class="folded-tools ${view.moreOpen ? 'open' : ''}">
      <button data-open-feature="notes" title="摘抄本" aria-label="摘抄本">${icon('notebook')}<span class="icon-label">摘抄本</span></button>
      <button data-open-feature="career" title="生涯图鉴" aria-label="生涯图鉴">${icon('career')}<span class="icon-label">生涯图鉴</span></button>
      <button data-open-feature="thoughts" title="哲思角" aria-label="哲思角">${icon('thought')}<span class="icon-label">哲思角</span></button>
    </div>
    <button id="toggle-more" class="more-toggle ${view.moreOpen ? 'open' : ''}" title="${view.moreOpen ? '收起' : '展开'}更多功能" aria-label="${view.moreOpen ? '收起' : '展开'}更多功能"><i></i></button>
  </nav>`;
}

function modelStatusHtml(): string {
  let kind = view.modelConfigured ? 'ready' : 'offline';
  let label = view.modelConfigured ? '模型已连接' : '离线模式';
  let detail = view.modelConfigured ? '已配置模型，等待本轮对话' : '当前没有可用的模型配置';
  if (view.busy) {
    kind = 'pending';
    label = view.modelConfigured ? '模型响应中' : '离线处理中';
    detail = view.modelConfigured ? '正在请求模型并组织回复' : '正在使用本地规则组织回复';
  } else if (view.debug) {
    if (view.debug.replySource === 'model') {
      kind = 'model';
      label = '本轮：模型回复';
      detail = '本轮最终回复由模型生成';
    } else if (view.debug.replySource === 'offline') {
      kind = 'offline';
      label = '本轮：离线兜底';
      detail = '本轮模型生成不可用，已切换到离线成句';
    } else {
      kind = 'local';
      label = '本轮：本地规则';
      detail = '本轮按安全分流或固定输出规则处理，无需模型成句';
    }
  }
  return `<div class="model-status ${kind}" role="status" aria-live="polite" title="${escapeHtml(detail)}"><i></i><span>${escapeHtml(label)}</span></div>`;
}

function dialogueHtml(): string {
  const action = view.actionPlaying ? dialogueActionFor(view.philosopherId, view.debug?.currentAttitude) : null;
  const art = action ?? ROLE_PORTRAIT[view.philosopherId];
  const meta = ROLE_META[view.philosopherId];
  return `<section class="dialogue-scene" aria-label="与${meta.name}对话">
    <video class="classroom-background" src="${classroomBackground}" poster="${classroomPoster}" preload="none" autoplay loop muted playsinline></video>
    <div class="scene-wash"></div>
    <button class="scene-back icon-button" id="back-to-selection" aria-label="返回选择页">${icon('back')}</button>
    ${sceneToolsHtml()}
    <img class="dialogue-portrait ${action ? 'animated' : ''}" src="${art}" ${action ? '' : `srcset="${ROLE_PORTRAIT_SMALL[view.philosopherId]} 480w, ${ROLE_PORTRAIT[view.philosopherId]} 800w" sizes="(max-width:560px) 74vw, 66vw"`} decoding="async" alt="${meta.name}立绘">
    <button class="nameplate-hotspot" id="open-profile" aria-label="查看${meta.name}简介" title="查看人物简介"></button>
    <div class="messages" id="messages">${messagesHtml()}${view.busy ? '<div class="thinking" aria-label="正在思考"><i></i><i></i><i></i></div>' : ''}</div>
    <form class="composer" id="composer">
      ${modelStatusHtml()}
      <textarea id="message-input" maxlength="600" rows="2" placeholder="想和${meta.name}聊些什么？" ${view.busy ? 'disabled' : ''}></textarea>
      <button class="send-button" type="submit" aria-label="发送" ${view.busy ? 'disabled' : ''}>${icon('send')}</button>
      <button class="history-button" id="open-history" type="button" aria-label="历史对话">${icon('history')}</button>
    </form>
    ${view.error ? `<div class="error-banner"><span>${escapeHtml(view.error)}</span><button id="retry-role" type="button">重试</button></div>` : ''}
  </section>`;
}

function profileHtml(): string {
  if (!view.profileOpen || !view.data) return '';
  const score = getFavorabilityState(view.philosopherId).score;
  return `<div class="modal-backdrop" id="profile-dismiss"><section class="art-modal profile-modal" role="dialog" aria-modal="true">
    <button class="modal-close" id="profile-close" aria-label="关闭">${icon('close')}</button>
    <img src="${avatarFor(view.philosopherId, 0)}" alt="${escapeHtml(view.data.nameplate.displayName)}头像">
    <small>${ROLE_META[view.philosopherId].tone}</small>
    <h2>${escapeHtml(view.data.nameplate.displayName)}</h2>
    <p>${escapeHtml(view.data.nameplate.intro)}</p>
    <div class="profile-score"><span>亲近程度</span><strong>${score}</strong></div>
    <label class="auto-event-setting"><span>进入教室时的主动消息</span><select id="auto-event-frequency"><option value="normal" ${view.autoEventFrequency === 'normal' ? 'selected' : ''}>标准</option><option value="low" ${view.autoEventFrequency === 'low' ? 'selected' : ''}>精简（每天最多一次）</option><option value="off" ${view.autoEventFrequency === 'off' ? 'selected' : ''}>关闭</option></select></label><small class="auto-event-help">纸团按时段、回赠按关系、主动提问按亲近度触发；都可随时关闭。</small>
  </section></div>`;
}

function historyHtml(): string {
  if (!view.historyOpen || !view.bundle) return '';
  const sessions = view.bundle.sessions.filter((session) => session.messages.length > 0).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return `<div class="modal-backdrop" id="history-dismiss"><section class="art-modal history-modal" role="dialog" aria-modal="true">
    <header><div><small>${ROLE_META[view.philosopherId].name}</small><h2>历史对话</h2></div><button class="modal-close" id="history-close" aria-label="关闭">${icon('close')}</button></header>
    <div class="session-list">${sessions.map((session) => `<article class="session-row ${!view.freshConversation && session.id === view.bundle!.activeId ? 'active' : ''}">
      <button data-session="${escapeHtml(session.id)}"><strong>${escapeHtml(session.title)}</strong><small>${new Date(session.updatedAt).toLocaleString('zh-CN')}</small></button>
      <button class="session-delete" data-delete-session="${escapeHtml(session.id)}" aria-label="删除对话">×</button>
    </article>`).join('') || '<p class="empty-history">还没有历史对话。</p>'}</div>
    <button class="add-session-button" id="add-session">${icon('add')}<span>添加新对话</span></button>
  </section></div>`;
}

function snackAtlasHtml(): string {
  if (!view.snackAtlasOpen) return '';
  const snackState = loadSnackState();
  const selected = view.snackCatalog.find((item) => item.id === view.atlasSnackId) ?? view.snackCatalog[0];
  const discovered = selected ? snackState.discovered.includes(selected.id) : false;
  const selectedName = selected ? selected.displayName ?? selected.name ?? selected.id : '';
  const from = selected && typeof selected.fromPhilosopher === 'string' ? selected.fromPhilosopher as PhilosopherId : null;
  const source = selected && typeof selected.source === 'string' ? selected.source : '';
  return `<section class="snack-atlas art-modal">
    <header><h3>零食图鉴</h3><button id="close-atlas" aria-label="关闭">${icon('close')}</button></header>
    <div class="snack-atlas-body"><div class="atlas-grid">${view.snackCatalog.map((item) => {
      const unlocked = snackState.discovered.includes(item.id);
      const giver = typeof item.fromPhilosopher === 'string' ? item.fromPhilosopher as PhilosopherId : null;
      const lockedRoleImage = giver ? SNACK_LOCKED_ART[giver] : null;
      const image = unlocked
        ? SNACK_ATLAS_ART[item.id] ?? SNACK_ART[item.id]
        : lockedRoleImage ?? SNACK_ATLAS_ART[item.id] ?? SNACK_ART[item.id];
      const lockClass = unlocked ? '' : lockedRoleImage ? 'locked locked-role' : 'locked locked-generic';
      return `<button class="atlas-item ${lockClass} ${item.id === selected?.id ? 'active' : ''}" data-atlas-snack="${escapeHtml(item.id)}">${image ? `<img src="${image}" alt="">` : '<span>?</span>'}</button>`;
    }).join('')}</div>
    <aside>${selected ? `<h4>${discovered ? escapeHtml(selectedName) : '???'}</h4><small>${discovered ? (typeof selected.obtain === 'string' && selected.obtain === 'daily_claim' ? '来自系统每日发放' : `来自${from ? ROLE_META[from].name : '哲学家'}的回赠`) : ''}</small><p>${discovered ? escapeHtml(source || (from ? '一份带着角色记忆的回赠。' : '常见的校园零食。')) : ''}</p>` : ''}</aside></div>
  </section>`;
}

function snackShareHtml(): string {
  if (!view.snackOpen) return '';
  const snackState = loadSnackState();
  const owned = view.snackCatalog.filter((item) => (snackState.inventory[item.id] ?? 0) > 0);
  const meta = ROLE_META[view.philosopherId];
  return `<section class="snack-scene" aria-label="给${meta.name}赠送零食">
    <video class="classroom-background" src="${classroomBackground}" poster="${classroomPoster}" preload="none" autoplay loop muted playsinline></video>
    <div class="scene-wash"></div>
    <img class="dialogue-portrait snack-portrait" src="${ROLE_PORTRAIT[view.philosopherId]}" srcset="${ROLE_PORTRAIT_SMALL[view.philosopherId]} 480w, ${ROLE_PORTRAIT[view.philosopherId]} 800w" sizes="(max-width:560px) 74vw, 66vw" decoding="async" alt="${meta.name}立绘">
    ${view.snackReply ? `<article class="snack-scene-reply"><div>${escapeHtml(view.snackReply)}</div></article>` : ''}
    <section class="snack-share-panel">
    <header><h3>零食分享</h3><button id="close-snacks" aria-label="关闭">${icon('close')}</button></header>
    <div class="owned-snacks">${owned.length ? owned.map((item) => `<button class="owned-snack ${item.id === view.selectedSnackId ? 'active' : ''}" data-select-snack="${escapeHtml(item.id)}" aria-label="选择零食"><img src="${SNACK_GIFT_ART[item.id] ?? SNACK_ART[item.id] ?? ''}" alt=""><b>${snackState.inventory[item.id] ?? 0}</b></button>`).join('') : '<p>书包里暂时没有零食。每天 4:00 后首次进入会随机获得一份。</p>'}</div>
    <div class="snack-actions"><button id="confirm-snack" title="送出" aria-label="送出" ${view.selectedSnackId ? '' : 'disabled'}>${icon('confirm')}<span class="icon-label">送出</span></button><button id="open-atlas" title="零食图鉴" aria-label="零食图鉴">${icon('snackbook')}<span class="icon-label">零食图鉴</span></button></div>
    </section>${snackAtlasHtml()}
  </section>`;
}

function entryEventHtml(): string {
  const event = view.entryQueue[0];
  if (!event) return '';
  const name = ROLE_META[view.philosopherId].name;
  let body = '';
  if (event.kind === 'paper') {
    if (view.entryStage === 0) body = `<p class="event-intro">捡到了${name}扔的废纸团！</p>`;
    else if (view.entryStage === 1) body = `<img class="paper-opening" src="${FEATURE_ART.wastepaperOpen}" alt="废纸团展开">`;
    else body = `<article class="paper-reveal" style="background-image:url('${FEATURE_ART.wastepaperNote}')"><p class="${event.drop.entry.wastepaperType === 2 ? 'private-paper' : ''}">${escapeHtml(event.drop.entry.quote)}</p></article>`;
  } else if (event.kind === 'return') {
    const item = view.snackCatalog.find((snack) => snack.id === event.snackId);
    const itemName = item?.displayName ?? item?.name ?? event.snackId;
    if (view.entryStage === 0) body = `<p class="event-intro">课桌下伸来了${name}的手！</p>`;
    else body = `<div class="return-reveal"><span class="sparkles">✦　✧　✦</span><img src="${SNACK_GIFT_ART[event.snackId] ?? SNACK_ART[event.snackId] ?? ''}" alt="${escapeHtml(itemName)}"><strong>${escapeHtml(itemName)}</strong>${view.entryStage >= 2 ? '<small>点击收进书包</small>' : ''}</div>`;
  } else if (event.kind === 'experience') {
    body = `<article class="proactive-reveal"><small>${escapeHtml(event.title)}</small><p>${escapeHtml(event.text)}</p><span>点击任意处收进生涯图鉴</span></article>`;
  } else {
    body = `<article class="proactive-reveal question"><small>${escapeHtml(event.theme)}</small><p>${escapeHtml(event.text)}</p><span>点击后在输入框回答</span></article>`;
  }
  const compact = (event.kind === 'paper' || event.kind === 'return') && view.entryStage === 0;
  const paperScene = event.kind === 'paper' && view.entryStage >= 1;
  return `<div class="entry-event-layer ${compact ? 'compact' : ''} ${paperScene ? 'paper-scene' : ''}"><section id="advance-entry">${body}<div class="entry-event-actions"><button id="dismiss-entry" type="button">稍后再看</button><button id="disable-auto-events" type="button">不再自动弹出</button></div></section></div>`;
}

function featureShell(title: string, className: string, content: string): string {
  return `<section class="feature-screen ${className}">
    <button class="feature-back" id="close-feature" aria-label="返回对话">${icon('back')}</button>
    <header class="feature-title"><small>${ROLE_META[view.philosopherId].name}</small><h1>${title}</h1></header>
    ${content}
  </section>`;
}

function notesFeature(): string {
  const collected = listCollected(loadWastepaperState(view.philosopherId));
  const pageSize = 8;
  const maxPage = Math.max(0, Math.ceil(collected.length / pageSize) - 1);
  view.notesPage = Math.max(0, Math.min(maxPage, view.notesPage));
  const pageItems = collected.slice(view.notesPage * pageSize, view.notesPage * pageSize + pageSize);
  const left = pageItems.slice(0, 4);
  const right = pageItems.slice(4, 8);
  const page = (items: typeof pageItems) => `<div class="notebook-page">${items.map((item) => {
    const lengthClass = item.quote.length > 110 ? ' note-copy--very-long' : item.quote.length > 70 ? ' note-copy--long' : '';
    const privateClass = item.wastepaperType === 2 ? ' private-paper' : '';
    return `<article class="note-entry"><small>${escapeHtml(formatCollectedDate(item.collectedAt))}</small><p data-note-id="${escapeHtml(item.id)}" class="note-copy${lengthClass}${privateClass}">${renderHighlightedQuote(item.id, item.quote)}</p></article>`;
  }).join('')}</div>`;
  return featureShell('摘抄本', 'notes-screen', `<div class="notebook"><div class="collection-count">收集进度 ${collected.length}/${view.data?.wastepaper.entries?.length ?? 0}</div>${page(left)}${page(right)}<button id="notes-prev" class="page-tab prev" ${view.notesPage <= 0 ? 'disabled' : ''}>上一页</button><button id="notes-next" class="page-tab next" ${view.notesPage >= maxPage ? 'disabled' : ''}>下一页</button></div>`);
}

function careerFeature(): string {
  const all = view.data?.experiences.experiences ?? [];
  const unlocked = new Set(unlockedExperienceIds(view.philosopherId));
  const fresh = new Set(newExperienceIds(view.philosopherId));
  const items = all.filter((item) => typeof item.id === 'string' && unlocked.has(item.id));
  const selected = items.find((item) => item.id === view.careerExperienceId) ?? items[0];
  const selectedText = selected ? textFromRecord(selected, ['monologue', 'text', 'sourceText', 'description']) : '';
  return featureShell('生涯图鉴', 'career-screen', `<img class="feature-bg" src="${FEATURE_ART.careerBackground}" alt=""><div class="career-content">
    <img class="career-seagull" src="${FEATURE_ART.careerSeagull}" alt="整理羽毛的海鸥">
    <article class="experience-box">${selected ? `<small>${escapeHtml(textFromRecord(selected, ['title', 'shortTitle', 'id']))}</small><p>${escapeHtml(selectedText)}</p>` : '<p>哲学家主动分享经历后，时间轴会在这里逐渐展开。</p>'}</article>
    <div class="timeline" style="--timeline-count:${all.length}"><span class="life-start">${ROLE_META[view.philosopherId].lifespan.split('—')[0]}</span><i></i>${all.map((item, index) => {
      const id = String(item.id ?? '');
      const isUnlocked = unlocked.has(id);
      const stage = typeof item.lifeStage === 'string' ? item.lifeStage : '';
      const showStage = stage && (index === 0 || all[index - 1]?.lifeStage !== stage);
      return `<button ${isUnlocked ? `data-experience="${escapeHtml(id)}"` : 'disabled aria-label="尚未解锁"'} class="${item.id === selected?.id ? 'active' : ''} ${isUnlocked ? 'unlocked' : 'locked'}" style="--timeline-index:${index}">${fresh.has(id) ? '<b>新！</b>' : ''}<span>${escapeHtml(textFromRecord(item, ['title', 'shortTitle', 'id']))}</span>${showStage ? `<em>${escapeHtml(LIFE_STAGE_LABELS[stage] ?? stage)}</em>` : ''}</button>`;
    }).join('')}<span class="life-end">${ROLE_META[view.philosopherId].lifespan.split('—')[1] ?? ''}</span></div>
  </div>`);
}

function thoughtsFeature(): string {
  const records = loadPhilosophyRecords(view.philosopherId);
  const themes = [...new Set(records.map((record) => record.theme))];
  const selectedTheme = view.thoughtsTheme && themes.includes(view.thoughtsTheme) ? view.thoughtsTheme : themes[0] ?? null;
  const selectedRecords = selectedTheme ? records.filter((record) => record.theme === selectedTheme) : [];
  return featureShell('哲思角', 'thoughts-screen', `<img class="feature-bg" src="${FEATURE_ART.thoughtCorner}" alt=""><div class="thoughts-layout">
    <nav>${themes.map((theme) => `<button data-thought-theme="${escapeHtml(theme)}" class="${theme === selectedTheme ? 'active' : ''}">${escapeHtml(theme)}</button>`).join('') || '<p>尚未回答主动提问。</p>'}</nav>
    <main>${selectedRecords.map((record) => `<article class="thought-record"><h2>${escapeHtml(record.question)}</h2><time>${new Date(record.answeredAt).toLocaleString('zh-CN')}</time><p>${escapeHtml(record.answer)}</p><details><summary>${ROLE_META[view.philosopherId].name}的评价</summary><p>${escapeHtml(record.evaluation)}</p></details></article>`).join('') || '<div class="empty-thought">完成一次主动提问后，这里会保存问题、回答和评价。</div>'}</main>
  </div>`);
}

function bookCover(book: BookRecord): string {
  const cover = view.bookCoverUrls[book.id] ?? book.coverUrl;
  return cover ? `<img src="${escapeHtml(cover)}" alt="">` : `<span class="book-cover-placeholder">${escapeHtml([...book.title][0] ?? '书')}</span>`;
}

function bookProvenanceHtml(draft: BookDraft | null): string {
  if (!draft) return '';
  const labels: Record<string, string> = { title: '书名', authors: '作者', publisher: '出版社', publishedDate: '出版日期', isbn13: 'ISBN', pageCount: '页数', description: '简介', coverUrl: '封面' };
  const provenance = Object.entries(draft.fieldProvenance ?? {}).filter(([field]) => labels[field]);
  const conflicts = Object.entries(draft.conflicts ?? {}).filter(([, values]) => values.length > 1);
  return `<details class="book-provenance"><summary>字段来源与置信度 ${Math.round((draft.confidence ?? 0) * 100)}%</summary><dl>${provenance.map(([field, source]) => `<div><dt>${labels[field]}</dt><dd>${escapeHtml(source)}</dd></div>`).join('')}</dl>${conflicts.length ? `<section><strong>数据源存在差异，请确认</strong>${conflicts.map(([field, values]) => `<div><span>${labels[field] ?? field}</span>${values.map((item, index) => `<button type="button" data-book-conflict-field="${escapeHtml(field)}" data-book-conflict-index="${index}">${escapeHtml(item.value)}<small>${escapeHtml(item.source)}</small></button>`).join('')}</div>`).join('')}</section>` : ''}</details>`;
}

function windowPanelHtml(): string {
  if (view.windowPanel === 'none') return '';
  if (view.windowPanel === 'sync') {
    return `<aside class="window-drawer sync-drawer"><header><h2>端到端加密备份</h2><button data-window-panel="records">${icon('close')}</button></header>
      <form id="cloud-sync-form">
        <p>恢复密钥只在本机用于 AES-GCM 加解密，服务器仅保存密文。换设备时输入同一密钥即可恢复。</p>
        <label>恢复密钥<input id="sync-recovery-key" type="password" minlength="12" autocomplete="off" required placeholder="至少 12 个字符，请妥善保管"></label>
        <small>密钥丢失后无法找回备份；PhiloMate 不会记住或上传它。</small>
        <div><button id="sync-upload" type="button" ${view.syncBusy ? 'disabled' : ''}>加密上传</button><button id="sync-download" type="button" ${view.syncBusy ? 'disabled' : ''}>下载并恢复</button></div>
      </form>
    </aside>`;
  }
  if (view.windowPanel === 'add') {
    const draft = view.bookDraft;
    const sourceLabel = draft?.sources?.join(' + ') ?? '';
    return `<aside class="window-drawer add-book-drawer"><header><h2>添加读书记录</h2><button data-window-panel="records">${icon('close')}</button></header>
      <form id="add-book-form">
        <div class="book-lookup"><label>ISBN 或书名<input id="book-query" name="query" maxlength="160" value="${escapeHtml(draft?.query ?? draft?.isbn13 ?? draft?.title ?? '')}" placeholder="输入 ISBN 最准确"></label><button id="search-books" type="button" ${view.bookSearchBusy ? 'disabled' : ''}>${view.bookSearchBusy ? '搜索中…' : '搜索补全'}</button></div>
        ${view.bookSearchError ? `<p class="book-search-error">${escapeHtml(view.bookSearchError)}</p>` : ''}
        ${view.bookCandidates.length ? `<div class="book-candidates" aria-label="书籍候选版本">${view.bookCandidates.map((item, index) => `<button type="button" data-book-candidate="${index}">${item.coverUrl ? `<img src="${escapeHtml(item.coverUrl)}" alt="" loading="lazy">` : ''}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml([item.authors.join('、'), item.publisher, item.publishedDate, item.isbn13].filter(Boolean).join(' · '))}</small><em>${escapeHtml(item.sources.join(' + '))}</em></span></button>`).join('')}</div>` : ''}
        ${sourceLabel ? `<p class="book-source">已由 ${escapeHtml(sourceLabel)} 补全，保存前可修改。数据获取于 ${new Date(draft!.fetchedAt).toLocaleString('zh-CN')}。</p>` : ''}
        ${bookProvenanceHtml(draft)}
        <label>书名<input name="title" required maxlength="80" value="${escapeHtml(draft?.title ?? '')}"></label>
        <label>作者<input name="author" maxlength="120" value="${escapeHtml(draft?.authors?.join('、') ?? '')}"></label>
        <div><label>出版社<input name="publisher" maxlength="80" value="${escapeHtml(draft?.publisher ?? '')}"></label><label>完整出版日期<input name="publishedDate" maxlength="20" value="${escapeHtml(draft?.publishedDate ?? '')}" placeholder="如 2025-06-01"></label></div>
        <div><label>ISBN-13<input name="isbn13" inputmode="numeric" maxlength="17" value="${escapeHtml(draft?.isbn13 ?? '')}"></label><label>版本/版次<input name="edition" maxlength="40" value="${escapeHtml(draft?.edition ?? '')}"></label></div>
        <div><label>译者<input name="translators" maxlength="120" value="${escapeHtml(draft?.translators?.join('、') ?? '')}"></label><label>总页数<input name="totalPages" required type="number" min="1" max="20000" value="${draft?.pageCount ?? 300}"></label></div>
        <label>简介<textarea name="description" maxlength="1200" rows="3">${escapeHtml(draft?.description ?? '')}</textarea></label>
        <label class="book-cover-picker">本地封面图片<input id="book-cover-file" name="coverFile" type="file" accept="image/png,image/jpeg,image/webp"><span>${view.bookCoverData || draft?.coverUrl ? `<img src="${escapeHtml(view.bookCoverData || draft?.coverUrl || '')}" alt="封面预览"><b>重新选择</b>` : '<b>选择本地图片</b><small>图片会压缩后保存在当前浏览器；请定期导出备份</small>'}</span></label>
        <fieldset><legend>选择代表这本书的植物（保存后仍可修改）</legend>${PLANT_ART.map((plant) => `<label><input type="radio" name="plantId" value="${plant.id}" ${plant === PLANT_ART[0] ? 'checked' : ''}><img src="${plant.stages[2]}" alt=""><span>${plant.name}</span></label>`).join('')}</fieldset>
        <button class="primary-art-button" type="submit">${icon('confirm')}<span>确认添加</span></button>
      </form>
    </aside>`;
  }
  if (view.windowPanel === 'arrange') {
    return `<aside class="window-drawer arrange-drawer" id="plant-tray"><header><h2>布置窗台</h2><button data-window-panel="none">${icon('close')}</button></header><p>把植物拖到窗台；拖回此框即可收起。后放置的植物显示在上层。</p><div class="plant-tray">${view.books.map((book) => {
      const plant = PLANT_ART.find((item) => item.id === book.plantId) ?? PLANT_ART[0];
      const visual = plantVisualForProgress(plant, book.currentPage / Math.max(1, book.totalPages));
      return `<button draggable="true" data-drag-book="${book.id}"><img src="${visual.src}" alt=""><strong>${plant.name}</strong><small>${escapeHtml(book.title)} · ${visual.stage}</small></button>`;
    }).join('') || '<p>先添加一本书，才能布置对应植物。</p>'}</div></aside>`;
  }
  return `<aside class="window-drawer records-drawer"><header><h2>读书记录</h2><button data-window-panel="none">${icon('close')}</button></header><div class="library-toolbar"><button class="add-book-button" data-window-panel="add">${icon('add')}<span>添加书籍</span></button><span class="storage-state ${view.storageStatus}">${escapeHtml(view.storageStatus === 'saving' ? '正在保存…' : view.storageStatus === 'failed' ? view.storageMessage : '已保存 · 仅在本机')}</span><button id="export-data" type="button">导出备份</button><label class="import-data">恢复备份<input id="import-data-file" type="file" accept="application/json"></label>${view.syncConfigured ? '<button data-window-panel="sync" type="button">加密同步</button>' : ''}</div><div class="book-list">${view.books.map((book) => {
    const percentage = Math.round(book.currentPage / Math.max(1, book.totalPages) * 100);
    return `<article class="book-row">${bookCover(book)}<div><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author || '作者未录入')} · ${percentage}%${book.isbn13 ? ` · ISBN ${escapeHtml(book.isbn13)}` : ''}</small><form data-book-progress="${book.id}"><input name="currentPage" type="number" min="0" max="${book.totalPages}" value="${book.currentPage}"><span>/ ${book.totalPages} 页</span><button type="submit">保存</button></form><label class="book-plant-edit">植物<select data-book-plant="${book.id}">${PLANT_ART.map((plant) => `<option value="${plant.id}" ${book.plantId === plant.id ? 'selected' : ''}>${plant.name}</option>`).join('')}</select></label></div><button class="remove-book" data-remove-book="${book.id}" aria-label="删除书籍">×</button></article>`;
  }).join('') || '<p class="empty-records">还没有读书记录。添加书籍时需要为它选择一株植物。</p>'}</div></aside>`;
}

function windowFeature(): string {
  const placed = view.books.filter((book) => book.placement);
  return featureShell('', 'window-screen', `<video class="feature-bg" src="${FEATURE_ART.balcony}" poster="${FEATURE_ART.balconyPoster}" preload="none" autoplay loop muted playsinline></video>
    <div class="window-tools"><button data-window-panel="arrange" title="布置窗台" aria-label="布置窗台">${icon('arrange')}<span class="icon-label">布置</span></button><button data-window-panel="records" title="读书记录" aria-label="读书记录">${icon('record')}<span class="icon-label">读书记录</span></button></div>
    <div class="balcony-drop" id="balcony-drop">${placed.map((book) => {
      const plant = PLANT_ART.find((item) => item.id === book.plantId) ?? PLANT_ART[0];
      const visual = plantVisualForProgress(plant, book.currentPage / Math.max(1, book.totalPages));
      return `<button class="placed-plant" draggable="true" data-drag-book="${book.id}" title="${escapeHtml(book.title)} · ${visual.stage}" style="left:${book.placement!.x}%;top:${book.placement!.y}%;z-index:${book.placement!.z}"><img src="${visual.src}" alt="${plant.name}"><span>${escapeHtml(book.title)}</span></button>`;
    }).join('')}</div>${windowPanelHtml()}`);
}

function featureHtml(): string {
  if (!view.feature || !view.data) return '';
  if (view.feature === 'notes') return notesFeature();
  if (view.feature === 'career') return careerFeature();
  if (view.feature === 'thoughts') return thoughtsFeature();
  return windowFeature();
}

function sensitivePanelHtml(): string {
  if (!view.panel) return '';
  return `<div class="modal-backdrop" id="panel-dismiss"><section class="art-modal safety-modal" role="dialog" aria-modal="true"><span>${view.panel.kind === 'help' ? '援' : '止'}</span>${view.panel.lines.map((line) => line ? `<p>${escapeHtml(line)}</p>` : '<br>').join('')}<button id="panel-close">知道了</button></section></div>`;
}

function roomHtml(): string {
  const toast = view.toast && !view.feature ? `<div class="toast">${escapeHtml(view.toast)}</div>` : '';
  const scene = view.snackOpen ? snackShareHtml() : dialogueHtml();
  return `<main class="room-screen">${scene}${featureHtml()}${profileHtml()}${historyHtml()}${sensitivePanelHtml()}${view.snackOpen ? '' : entryEventHtml()}${toast}</main>`;
}

function render(): void {
  app.innerHTML = view.screen === 'selection' ? selectionHtml() : roomHtml();
  bindEvents();
  requestAnimationFrame(() => {
    const messages = document.querySelector('#messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  });
}

function syncFromBundle(): void {
  if (!view.bundle) return;
  const session = activeSession(view.bundle);
  view.messages = [...session.messages];
  view.conversation = session.conversation;
  view.freshConversation = false;
  view.debug = null;
}

function prepareEntryQueue(): void {
  if (!view.data || view.autoEventsDisabled) {
    view.entryQueue = [];
    return;
  }
  const queue: EntryEvent[] = [];
  const paper = claimWastepaper(view.philosopherId, view.data);
  if (paper) queue.push({ kind: 'paper', drop: paper });
  for (const snackId of pendingSnackReturns(view.philosopherId)) queue.push({ kind: 'return', snackId });
  const proactive = rollProactiveEvent(
    view.philosopherId,
    view.data,
    getFavorabilityState(view.philosopherId).score,
  );
  if (proactive) queue.push(proactive);
  if (view.autoEventFrequency === 'low') {
    const today = new Date().toLocaleDateString('zh-CN');
    if (readLocalJson<string>('philomate_auto_event_last_day', '') === today) {
      view.entryQueue = [];
      return;
    }
    view.entryQueue = queue.slice(0, 1);
    if (view.entryQueue.length) writeLocalJson('philomate_auto_event_last_day', today);
  } else {
    view.entryQueue = queue;
  }
  view.entryStage = 0;
  scheduleEntryDismiss();
}

function scheduleEntryDismiss(): void {
  if (entryDismissTimer !== null) window.clearTimeout(entryDismissTimer);
  entryDismissTimer = null;
  if (!view.entryQueue.length) return;
  entryDismissTimer = window.setTimeout(() => {
    view.entryQueue.shift();
    view.entryStage = 0;
    entryDismissTimer = null;
    render();
    scheduleEntryDismiss();
  }, 10_000);
}

function dismissEntry(disableFuture = false): void {
  if (entryAnimationTimer !== null) window.clearTimeout(entryAnimationTimer);
  if (entryDismissTimer !== null) window.clearTimeout(entryDismissTimer);
  entryAnimationTimer = null;
  entryDismissTimer = null;
  if (disableFuture) {
    view.autoEventsDisabled = true;
    view.autoEventFrequency = 'off';
    writeLocalJson('philomate_auto_events_disabled', 1);
    writeLocalJson('philomate_auto_event_frequency', 'off');
    view.entryQueue = [];
    showToast('已关闭进入教室时的自动消息，可在人物名片中重新开启。');
    return;
  }
  view.entryQueue.shift();
  view.entryStage = 0;
  render();
  scheduleEntryDismiss();
}

async function switchRole(philosopherId: PhilosopherId, withEntryEvents = true): Promise<void> {
  if (actionTimer !== null) {
    window.clearTimeout(actionTimer);
    actionTimer = null;
  }
  if (snackReplyTimer !== null) {
    window.clearTimeout(snackReplyTimer);
    snackReplyTimer = null;
  }
  view.philosopherId = philosopherId;
  view.data = null;
  view.bundle = loadSessionBundle(philosopherId);
  view.messages = [];
  view.conversation = createConversationState();
  view.freshConversation = true;
  view.debug = null;
  view.feature = null;
  view.historyOpen = false;
  view.profileOpen = false;
  view.snackOpen = false;
  view.snackReply = null;
  view.moreOpen = false;
  view.activeQuestion = null;
  view.actionPlaying = false;
  view.error = null;
  render();
  try {
    view.data = await loadRoleData(philosopherId);
    view.books = loadLibrary(philosopherId);
    if (withEntryEvents) prepareEntryQueue();
  } catch (error) {
    view.error = error instanceof Error ? error.message : '角色数据加载失败';
  }
  render();
}

async function sendMessage(raw: string): Promise<void> {
  const input = raw.trim();
  if (!input || view.busy || !view.data || !view.bundle) return;
  if (view.freshConversation) {
    view.bundle = addSession(view.philosopherId, view.bundle);
    view.freshConversation = false;
  }
  const proactiveQuestion = view.activeQuestion;
  const userMessage: ChatMessage = { id: messageId(), role: 'user', content: input, at: new Date().toISOString() };
  view.messages.push(userMessage);
  if (actionTimer !== null) {
    window.clearTimeout(actionTimer);
    actionTimer = null;
  }
  view.actionPlaying = false;
  view.debug = null;
  view.busy = true;
  view.error = null;
  render();
  try {
    try {
      view.data = await hydrateRoleCorpus(view.philosopherId, input, view.data);
    } catch {
      if (!view.data.corpus.length) view.error = '哲学语料暂时不可用，将使用安全降级回复。';
    }
    const result = await runDialoguePipeline({
      philosopherId: view.philosopherId,
      userInput: input,
      data: view.data,
      state: view.conversation,
      dialogueTurns: view.messages.slice(0, -1).map(({ role, content }) => ({ role, content })),
      preferCompleteConfucius: view.modelConfigured,
      preferCompleteFoucault: view.modelConfigured,
      pendingFoucaultQuestion: view.philosopherId === 'foucault' && proactiveQuestion
        ? {
            id: proactiveQuestion.id,
            group: proactiveQuestion.group,
            text: proactiveQuestion.text,
            evalPoints: proactiveQuestion.evalPoints,
            attempts: proactiveQuestion.attempts ?? 0,
          }
        : undefined,
    });
    view.conversation = result.state;
    view.debug = result.debug;
    if (result.panel) {
      view.messages = view.messages.filter((message) => message.id !== userMessage.id);
      view.panel = result.panel;
    } else if (result.text) {
      view.messages.push({
        id: messageId(),
        role: 'assistant',
        content: result.text,
        at: new Date().toISOString(),
        outputMode: result.debug.outputMode,
        evidenceId: result.debug.corpusId ?? undefined,
        evidenceText: result.debug.corpusText || undefined,
        evidenceSource: result.debug.evidenceSource,
        evidenceChapter: result.debug.evidenceChapter,
        generated: result.debug.replySource === 'model',
      });
      if (proactiveQuestion) {
        savePhilosophyRecord(view.philosopherId, {
          questionId: proactiveQuestion.id,
          theme: proactiveQuestion.theme,
          question: proactiveQuestion.text,
          answer: input,
          evaluation: result.text,
        });
        if (result.debug.questionPending) {
          view.activeQuestion = { ...proactiveQuestion, attempts: (proactiveQuestion.attempts ?? 0) + 1 };
        } else {
          view.activeQuestion = null;
        }
      }
    }
    view.bundle = updateActiveSession(view.philosopherId, view.bundle, view.messages, view.conversation);
  } catch (error) {
    view.error = error instanceof Error ? error.message : '对话管线失败';
  } finally {
    view.busy = false;
    playCharacterActionOnce();
    render();
  }
}

function cancelProactive(): void {
  if (!view.activeQuestion) return;
  view.activeQuestion = null;
  showToast('已打断本次主动提问，不会录入哲思角。');
}

function advanceEntryEvent(): void {
  const event = view.entryQueue[0];
  if (!event) return;
  if (event.kind === 'paper' || event.kind === 'return') {
    if (view.entryStage < 2) {
      view.entryStage += 1;
      render();
      if (event.kind === 'paper' && view.entryStage === 1) {
        if (entryAnimationTimer !== null) window.clearTimeout(entryAnimationTimer);
        entryAnimationTimer = window.setTimeout(() => {
          if (view.entryQueue[0] === event && view.entryStage === 1) {
            view.entryStage = 2;
            render();
          }
          entryAnimationTimer = null;
        }, 1800);
      }
      return;
    }
    if (event.kind === 'return') acceptSnackReturn(view.philosopherId, event.snackId);
  } else if (event.kind === 'question') {
    view.activeQuestion = event;
  }
  view.entryQueue.shift();
  view.entryStage = 0;
  render();
  scheduleEntryDismiss();
}

function giftSelectedSnack(): void {
  if (!view.selectedSnackId || !view.data) return;
  const snackId = view.selectedSnackId;
  if (!consumeSnack(snackId)) {
    showToast('这份零食已经不在书包里了。');
    return;
  }
  try {
    const result = giveSnack(view.philosopherId, view.data, snackId);
    rollAndQueueSnackReturn(
      view.philosopherId,
      result.score,
      (view.data.snackReturns.items ?? []).map((item) => typeof item.id === 'string' ? item.id : '').filter(Boolean),
    );
    view.snackAtlasOpen = false;
    view.selectedSnackId = null;
    view.snackReply = result.text;
    render();
    if (snackReplyTimer !== null) window.clearTimeout(snackReplyTimer);
    snackReplyTimer = window.setTimeout(() => {
      if (view.snackReply === result.text) {
        view.snackReply = null;
        render();
      }
      snackReplyTimer = null;
    }, 4200);
  } catch (error) {
    restoreSnack(snackId);
    showToast(error instanceof Error ? error.message : '赠送失败');
  }
}

function openFeature(feature: Feature): void {
  cancelProactive();
  if (view.entryQueue.length) {
    if (entryDismissTimer !== null) window.clearTimeout(entryDismissTimer);
    view.entryQueue = [];
    view.entryStage = 0;
  }
  view.feature = feature;
  view.moreOpen = false;
  view.snackOpen = false;
  if (feature === 'window') {
    view.books = loadLibrary(view.philosopherId);
    view.windowPanel = 'none';
    view.bookCoverData = null;
    void refreshBookCovers();
  }
  render();
}

async function compressBookCover(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
  if (file.size > 12 * 1024 * 1024) throw new Error('封面图片不能超过 12MB');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 480 / bitmap.width, 640 / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法处理这张图片');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', .82);
}

async function searchBooks(query: string): Promise<void> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    view.bookSearchError = '请输入 ISBN 或至少两个字的书名。';
    render();
    return;
  }
  view.bookSearchBusy = true;
  view.bookSearchError = null;
  view.bookCandidates = [];
  render();
  try {
    const response = await fetch(`/api/books/search?q=${encodeURIComponent(normalized)}`);
    const payload = await response.json() as { candidates?: BookCandidate[]; partial?: boolean; error?: string };
    if (!response.ok) {
      if (payload.error === 'invalid_isbn') throw new Error('ISBN 校验位不正确，请检查后重试。');
      throw new Error('书目信息暂时不可用，请稍后重试或手动填写。');
    }
    view.bookCandidates = payload.candidates ?? [];
    if (!view.bookCandidates.length) view.bookSearchError = '没有找到匹配版本，你仍可手动填写。';
    else if (payload.partial) view.bookSearchError = '部分数据源暂时不可用，以下结果仍可选择。';
    view.bookDraft = view.bookDraft ? { ...view.bookDraft, query: normalized } : null;
  } catch (error) {
    view.bookSearchError = error instanceof Error ? error.message : '搜索失败，请稍后重试。';
  } finally {
    view.bookSearchBusy = false;
    render();
  }
}

async function refreshBookCovers(): Promise<void> {
  for (const url of Object.values(view.bookCoverUrls)) URL.revokeObjectURL(url);
  view.bookCoverUrls = {};
  for (const original of [...view.books]) {
    let book = original;
    if (!book.coverId && book.coverUrl?.startsWith('data:')) {
      const coverId = `cover-${book.id}`;
      try {
        await saveBookCover(coverId, book.coverUrl);
        view.books = updateBook(view.philosopherId, book.id, { coverId, coverUrl: undefined });
        book = { ...book, coverId, coverUrl: undefined };
      } catch {
        continue;
      }
    }
    if (!book.coverId) continue;
    try {
      const url = await loadBookCover(book.coverId);
      if (url) view.bookCoverUrls[book.id] = url;
    } catch {
      // Missing optional media does not hide the remaining reading records.
    }
  }
  if (view.feature === 'window') render();
}

async function backupWithCovers(): Promise<ReturnType<typeof createLocalBackup>> {
  const backup = createLocalBackup();
  backup.bookCovers = await exportBookCovers();
  return backup;
}

async function downloadBackup(): Promise<void> {
  const backup = await backupWithCovers();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `philomate-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast('备份已导出，请妥善保存。');
}

async function runCloudSync(direction: 'upload' | 'download'): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('#sync-recovery-key');
  const recoveryKey = input?.value ?? '';
  if (recoveryKey.length < 12) {
    input?.reportValidity();
    return;
  }
  view.syncBusy = true;
  render();
  try {
    if (direction === 'upload') {
      await uploadEncryptedBackup(recoveryKey, await backupWithCovers());
      showToast('已在本机加密并上传备份。');
    } else {
      if (!window.confirm('云端备份将覆盖同名本机记录，继续吗？')) return;
      const backup = await downloadEncryptedBackup(recoveryKey);
      const restored = await restoreLocalBackup(backup);
      await importBookCovers(backup.bookCovers);
      view.books = loadLibrary(view.philosopherId);
      await refreshBookCovers();
      showToast(`已解密并恢复 ${restored} 项数据。`);
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '加密同步失败');
  } finally {
    view.syncBusy = false;
    render();
  }
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-select-role]').forEach((button) => button.addEventListener('click', () => {
    view.screen = 'room';
    void switchRole(button.dataset.selectRole as PhilosopherId);
  }));
  document.querySelector<HTMLButtonElement>('#back-to-selection')?.addEventListener('click', () => {
    cancelProactive();
    view.toast = null;
    view.screen = 'selection';
    render();
  });
  document.querySelector<HTMLButtonElement>('#retry-role')?.addEventListener('click', () => {
    clearRoleDataCache();
    void switchRole(view.philosopherId, false);
  });
  document.querySelector<HTMLButtonElement>('#toggle-more')?.addEventListener('click', () => {
    view.moreOpen = !view.moreOpen;
    render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-open-feature]').forEach((button) => button.addEventListener('click', () => openFeature(button.dataset.openFeature as Feature)));
  document.querySelector<HTMLButtonElement>('#close-feature')?.addEventListener('click', () => {
    view.feature = null;
    view.windowPanel = 'none';
    render();
  });
  document.querySelector<HTMLFormElement>('#composer')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.querySelector<HTMLTextAreaElement>('#message-input');
    if (input) void sendMessage(input.value);
  });
  document.querySelector<HTMLTextAreaElement>('#message-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage((event.currentTarget as HTMLTextAreaElement).value);
    }
  });
  document.querySelector<HTMLButtonElement>('#open-profile')?.addEventListener('click', () => {
    view.profileOpen = true;
    render();
  });
  const closeProfile = (event: Event) => {
    if ((event.target as HTMLElement).id === 'profile-dismiss' || (event.currentTarget as HTMLElement).id === 'profile-close') {
      view.profileOpen = false;
      render();
    }
  };
  document.querySelector('#profile-dismiss')?.addEventListener('click', closeProfile);
  document.querySelector('#profile-close')?.addEventListener('click', closeProfile);
  document.querySelector<HTMLSelectElement>('#auto-event-frequency')?.addEventListener('change', (event) => {
    view.autoEventFrequency = (event.currentTarget as HTMLSelectElement).value as AutoEventFrequency;
    view.autoEventsDisabled = view.autoEventFrequency === 'off';
    writeLocalJson('philomate_auto_events_disabled', view.autoEventsDisabled ? 1 : 0);
    writeLocalJson('philomate_auto_event_frequency', view.autoEventFrequency);
    view.profileOpen = false;
    if (!view.autoEventsDisabled && !view.entryQueue.length) prepareEntryQueue();
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-history')?.addEventListener('click', () => {
    view.historyOpen = true;
    render();
  });
  const closeHistory = (event: Event) => {
    if ((event.target as HTMLElement).id === 'history-dismiss' || (event.currentTarget as HTMLElement).id === 'history-close') {
      view.historyOpen = false;
      render();
    }
  };
  document.querySelector('#history-dismiss')?.addEventListener('click', closeHistory);
  document.querySelector('#history-close')?.addEventListener('click', closeHistory);
  document.querySelectorAll<HTMLButtonElement>('[data-session]').forEach((button) => button.addEventListener('click', () => {
    if (!view.bundle || !button.dataset.session) return;
    view.bundle = chooseSession(view.philosopherId, view.bundle, button.dataset.session);
    syncFromBundle();
    view.historyOpen = false;
    render();
  }));
  document.querySelector<HTMLButtonElement>('#add-session')?.addEventListener('click', () => {
    if (!view.bundle) return;
    view.messages = [];
    view.conversation = createConversationState();
    view.freshConversation = true;
    view.debug = null;
    view.historyOpen = false;
    render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-delete-session]').forEach((button) => button.addEventListener('click', () => {
    if (!view.bundle || !button.dataset.deleteSession) return;
    if (!window.confirm('删除这段历史对话？此操作无法撤销。')) return;
    const deletingActive = !view.freshConversation && view.bundle.activeId === button.dataset.deleteSession;
    view.bundle = removeSession(view.philosopherId, view.bundle, button.dataset.deleteSession);
    if (deletingActive) {
      view.messages = [];
      view.conversation = createConversationState();
      view.freshConversation = true;
      view.debug = null;
    }
    render();
  }));
  document.querySelector<HTMLButtonElement>('#open-snacks')?.addEventListener('click', () => {
    view.snackOpen = true;
    view.selectedSnackId = null;
    view.snackReply = null;
    if (snackReplyTimer !== null) {
      window.clearTimeout(snackReplyTimer);
      snackReplyTimer = null;
    }
    render();
  });
  document.querySelector<HTMLButtonElement>('#close-snacks')?.addEventListener('click', () => {
    view.snackOpen = false;
    view.snackAtlasOpen = false;
    view.snackReply = null;
    if (snackReplyTimer !== null) {
      window.clearTimeout(snackReplyTimer);
      snackReplyTimer = null;
    }
    render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-select-snack]').forEach((button) => button.addEventListener('click', () => {
    view.selectedSnackId = button.dataset.selectSnack ?? null;
    render();
  }));
  document.querySelector<HTMLButtonElement>('#confirm-snack')?.addEventListener('click', giftSelectedSnack);
  document.querySelector<HTMLButtonElement>('#open-atlas')?.addEventListener('click', () => {
    view.snackAtlasOpen = true;
    view.atlasSnackId = view.snackCatalog[0]?.id ?? null;
    render();
  });
  document.querySelector<HTMLButtonElement>('#close-atlas')?.addEventListener('click', () => {
    view.snackAtlasOpen = false;
    render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-atlas-snack]').forEach((button) => button.addEventListener('click', () => {
    view.atlasSnackId = button.dataset.atlasSnack ?? null;
    render();
  }));
  document.querySelector('#advance-entry')?.addEventListener('click', advanceEntryEvent);
  document.querySelector<HTMLButtonElement>('#dismiss-entry')?.addEventListener('click', (event) => {
    event.stopPropagation();
    dismissEntry(false);
  });
  document.querySelector<HTMLButtonElement>('#disable-auto-events')?.addEventListener('click', (event) => {
    event.stopPropagation();
    dismissEntry(true);
  });
  document.querySelector<HTMLButtonElement>('#notes-prev')?.addEventListener('click', () => { view.notesPage -= 1; render(); });
  document.querySelector<HTMLButtonElement>('#notes-next')?.addEventListener('click', () => { view.notesPage += 1; render(); });
  document.querySelectorAll<HTMLElement>('.note-entry p[data-note-id]').forEach((paragraph) => paragraph.addEventListener('mouseup', () => {
    window.setTimeout(() => openNoteHighlightPalette(paragraph), 0);
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-experience]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.experience;
    if (!id) return;
    view.careerExperienceId = id;
    markExperienceSeen(view.philosopherId, id);
    render();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-thought-theme]').forEach((button) => button.addEventListener('click', () => {
    view.thoughtsTheme = button.dataset.thoughtTheme ?? null;
    render();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-window-panel]').forEach((button) => button.addEventListener('click', () => {
    view.windowPanel = button.dataset.windowPanel as WindowPanel;
    if (view.windowPanel === 'add') {
      view.bookCoverData = null;
      view.bookDraft = null;
      view.bookCandidates = [];
      view.bookSearchError = null;
    }
    render();
  }));
  document.querySelector<HTMLButtonElement>('#search-books')?.addEventListener('click', () => {
    const query = document.querySelector<HTMLInputElement>('#book-query')?.value ?? '';
    void searchBooks(query);
  });
  document.querySelector<HTMLInputElement>('#book-query')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void searchBooks((event.currentTarget as HTMLInputElement).value);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-book-candidate]').forEach((button) => button.addEventListener('click', () => {
    const candidate = view.bookCandidates[Number(button.dataset.bookCandidate)];
    if (!candidate) return;
    const query = document.querySelector<HTMLInputElement>('#book-query')?.value ?? '';
    view.bookDraft = { ...candidate, query };
    view.bookCandidates = [];
    view.bookSearchError = null;
    view.bookCoverData = null;
    render();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-book-conflict-field]').forEach((button) => button.addEventListener('click', () => {
    if (!view.bookDraft) return;
    const field = button.dataset.bookConflictField ?? '';
    const alternative = view.bookDraft.conflicts[field]?.[Number(button.dataset.bookConflictIndex)];
    if (!alternative || !['publisher', 'publishedDate', 'isbn13', 'pageCount', 'description', 'coverUrl'].includes(field)) return;
    view.bookDraft = { ...view.bookDraft, [field]: alternative.value };
    view.bookDraft.fieldProvenance = { ...view.bookDraft.fieldProvenance, [field]: alternative.source };
    render();
  }));
  document.querySelector<HTMLInputElement>('#book-cover-file')?.addEventListener('change', async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      view.bookCoverData = await compressBookCover(file);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '封面读取失败');
    }
    render();
  });
  document.querySelector<HTMLFormElement>('#add-book-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const totalPages = Number(data.get('totalPages'));
    const title = String(data.get('title') ?? '').trim();
    const plantId = String(data.get('plantId') ?? PLANT_ART[0].id);
    if (!title || !Number.isFinite(totalPages) || totalPages < 1) return;
    const isbn13 = String(data.get('isbn13') ?? '').replace(/[^0-9X]/gi, '').toUpperCase();
    if (isbn13 && !isValidIsbn13(isbn13)) {
      showToast('ISBN-13 格式或校验位不正确。');
      return;
    }
    let localCoverId: string | undefined;
    try {
      if (view.bookCoverData) {
        localCoverId = `cover-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`;
        await saveBookCover(localCoverId, view.bookCoverData);
      }
      view.books = addBook(view.philosopherId, {
        title,
        author: String(data.get('author') ?? '').trim(),
        publisher: String(data.get('publisher') ?? '').trim(),
        year: String(data.get('publishedDate') ?? '').trim().slice(0, 4),
        publishedDate: String(data.get('publishedDate') ?? '').trim(),
        isbn13: isbn13 || undefined,
        edition: String(data.get('edition') ?? '').trim() || undefined,
        translators: String(data.get('translators') ?? '').trim() || undefined,
        description: String(data.get('description') ?? '').trim() || undefined,
        source: view.bookDraft?.sources.join(' + '),
        fetchedAt: view.bookDraft?.fetchedAt,
        fieldProvenance: view.bookDraft?.fieldProvenance,
        confidence: view.bookDraft?.confidence,
        totalPages,
        coverId: localCoverId,
        coverUrl: localCoverId ? undefined : view.bookDraft?.coverUrl || undefined,
        plantId,
      });
      view.windowPanel = 'records';
      view.bookCoverData = null;
      view.bookDraft = null;
      view.bookCandidates = [];
      showToast('读书记录已保存到本机。');
      void refreshBookCovers();
    } catch (error) {
      if (localCoverId) void removeBookCover(localCoverId);
      showToast(error instanceof Error ? error.message : '书籍保存失败');
    }
    render();
  });
  document.querySelectorAll<HTMLFormElement>('[data-book-progress]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = form.dataset.bookProgress;
    const input = form.elements.namedItem('currentPage') as HTMLInputElement | null;
    if (!id || !input) return;
    view.books = updateBookProgress(view.philosopherId, id, Number(input.value));
    render();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-remove-book]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.removeBook;
    if (!id || !window.confirm('删除这本书及其植物进度？')) return;
    const coverId = view.books.find((book) => book.id === id)?.coverId;
    if (coverId) void removeBookCover(coverId);
    view.books = removeBook(view.philosopherId, id);
    render();
  }));
  document.querySelectorAll<HTMLSelectElement>('[data-book-plant]').forEach((select) => select.addEventListener('change', () => {
    const id = select.dataset.bookPlant;
    if (!id) return;
    view.books = updateBook(view.philosopherId, id, { plantId: select.value });
    showToast('植物已更换。');
    render();
  }));
  document.querySelector<HTMLButtonElement>('#export-data')?.addEventListener('click', () => void downloadBackup());
  document.querySelector<HTMLButtonElement>('#sync-upload')?.addEventListener('click', () => void runCloudSync('upload'));
  document.querySelector<HTMLButtonElement>('#sync-download')?.addEventListener('click', () => void runCloudSync('download'));
  document.querySelector<HTMLInputElement>('#import-data-file')?.addEventListener('change', async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as ReturnType<typeof createLocalBackup>;
      const restored = await restoreLocalBackup(backup);
      await importBookCovers(backup.bookCovers);
      view.books = loadLibrary(view.philosopherId);
      await refreshBookCovers();
      showToast(`已恢复 ${restored} 项数据。刷新页面后全部生效。`);
      render();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '备份恢复失败');
    }
  });
  document.querySelectorAll<HTMLElement>('[data-drag-book]').forEach((element) => element.addEventListener('dragstart', (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', element.dataset.dragBook ?? '');
    if (element.classList.contains('placed-plant')) {
      const rect = element.getBoundingClientRect();
      event.dataTransfer.setData('application/x-philomate-drag-offset', JSON.stringify({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      }));
    }
  }));
  const balcony = document.querySelector<HTMLElement>('#balcony-drop');
  balcony?.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });
  balcony?.addEventListener('drop', (event) => {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain');
    if (!id) return;
    const rect = balcony.getBoundingClientRect();
    let centerX = event.clientX - rect.left;
    let centerY = event.clientY - rect.top;
    const rawOffset = event.dataTransfer?.getData('application/x-philomate-drag-offset');
    if (rawOffset) {
      try {
        const offset = JSON.parse(rawOffset) as { x: number; y: number; width: number; height: number };
        centerX += offset.width / 2 - offset.x;
        centerY += offset.height / 2 - offset.y;
      } catch {
        // Keep the pointer as the center when drag metadata is unavailable.
      }
    }
    const x = Math.max(3, Math.min(97, centerX / rect.width * 100));
    const y = Math.max(5, Math.min(95, centerY / rect.height * 100));
    const z = Math.max(0, ...view.books.map((book) => book.placement?.z ?? 0)) + 1;
    view.books = placeBookPlant(view.philosopherId, id, { x, y, z });
    render();
  });
  const tray = document.querySelector<HTMLElement>('#plant-tray');
  tray?.addEventListener('dragover', (event) => event.preventDefault());
  tray?.addEventListener('drop', (event) => {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain');
    if (!id) return;
    view.books = placeBookPlant(view.philosopherId, id, undefined);
    render();
  });
  const dismissPanel = (event: Event) => {
    if ((event.target as HTMLElement).id === 'panel-dismiss' || (event.currentTarget as HTMLElement).id === 'panel-close') {
      view.panel = null;
      render();
    }
  };
  document.querySelector('#panel-dismiss')?.addEventListener('click', dismissPanel);
  document.querySelector('#panel-close')?.addEventListener('click', dismissPanel);
}

async function bootstrap(): Promise<void> {
  await initializeStorage();
  view.autoEventFrequency = readLocalJson<AutoEventFrequency>('philomate_auto_event_frequency', readLocalJson<number>('philomate_auto_events_disabled', 0) === 1 ? 'off' : 'normal');
  view.autoEventsDisabled = view.autoEventFrequency === 'off';
  const query = new URLSearchParams(window.location.search);
  const requestedRole = query.get('role');
  const requestedFeature = query.get('feature');
  const previewMode = query.get('preview') === '1';
  if (requestedRole && PHILOSOPHER_IDS.includes(requestedRole as PhilosopherId)) {
    view.philosopherId = requestedRole as PhilosopherId;
    view.screen = 'room';
  }
  render();
  const [health, snacks] = await Promise.allSettled([
    fetch('/api/health').then((response) => response.json() as Promise<{ modelConfigured?: boolean; syncConfigured?: boolean }>),
    loadSnackCatalog(),
  ]);
  if (health.status === 'fulfilled') {
    view.modelConfigured = Boolean(health.value.modelConfigured);
    view.syncConfigured = Boolean(health.value.syncConfigured);
  }
  if (snacks.status === 'fulfilled') {
    view.snackCatalog = snacks.value;
    const claimed = ensureDailySnack(snacks.value.map((item) => ({
      id: item.id,
      obtain: typeof item.obtain === 'string' ? item.obtain : undefined,
    })));
    if (claimed) {
      const item = snacks.value.find((snack) => snack.id === claimed);
      showToast(`今日零食已放进书包：${item?.displayName ?? item?.name ?? claimed}`);
    }
  }
  if (view.screen === 'room') {
    await switchRole(view.philosopherId, !previewMode);
    if (requestedFeature && ['notes', 'career', 'thoughts', 'window'].includes(requestedFeature)) {
      view.feature = requestedFeature as Feature;
      if (view.feature === 'window') {
        view.books = loadLibrary(view.philosopherId);
        await refreshBookCovers();
      }
      render();
    }
  }
  else render();
}

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (view.profileOpen) view.profileOpen = false;
  else if (view.historyOpen) view.historyOpen = false;
  else if (view.snackAtlasOpen) view.snackAtlasOpen = false;
  else if (view.snackOpen) {
    view.snackOpen = false;
    view.snackReply = null;
    if (snackReplyTimer !== null) {
      window.clearTimeout(snackReplyTimer);
      snackReplyTimer = null;
    }
  }
  else if (view.feature) view.feature = null;
  else if (view.moreOpen) view.moreOpen = false;
  else return;
  render();
});

void bootstrap();
