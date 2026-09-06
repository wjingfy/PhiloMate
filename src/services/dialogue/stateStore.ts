import { createInitialLongTermState } from '../../utils/confuciusLongTermAttitude';
import type { ChatMessage, ConversationState, PhilosopherId } from '../../types';
import { readLocalJson, removeLocalItem, writeLocalJson } from '../ui/storage';

const STATE_PREFIX = 'philomate_conversation_state_';
const MESSAGE_PREFIX = 'philomate_messages_';

export function createConversationState(): ConversationState {
  return {
    longTerm: createInitialLongTermState(),
    recentMessages: [],
    usedCorpusIds: [],
    cStickyRemaining: 0,
    sensitiveCounts: {},
  };
}

export function loadConversationState(philosopherId: PhilosopherId): ConversationState {
  try {
    const parsed = readLocalJson<Partial<ConversationState> | null>(`${STATE_PREFIX}${philosopherId}`, null);
    if (!parsed) return createConversationState();
    return {
      ...createConversationState(),
      ...parsed,
      longTerm: { ...createInitialLongTermState(), ...parsed.longTerm },
      recentMessages: Array.isArray(parsed.recentMessages) ? parsed.recentMessages.slice(-10) : [],
      usedCorpusIds: Array.isArray(parsed.usedCorpusIds) ? parsed.usedCorpusIds.slice(-80) : [],
      sensitiveCounts: parsed.sensitiveCounts ?? {},
    };
  } catch {
    return createConversationState();
  }
}

export function saveConversationState(philosopherId: PhilosopherId, state: ConversationState): void {
  writeLocalJson(`${STATE_PREFIX}${philosopherId}`, state);
}

export function loadMessages(philosopherId: PhilosopherId): ChatMessage[] {
  try {
    const parsed = readLocalJson<ChatMessage[]>(`${MESSAGE_PREFIX}${philosopherId}`, []);
    return Array.isArray(parsed) ? parsed.slice(-100) : [];
  } catch {
    return [];
  }
}

export function saveMessages(philosopherId: PhilosopherId, messages: ChatMessage[]): void {
  writeLocalJson(`${MESSAGE_PREFIX}${philosopherId}`, messages.slice(-100));
}

export function clearConversation(philosopherId: PhilosopherId): void {
  removeLocalItem(`${STATE_PREFIX}${philosopherId}`);
  removeLocalItem(`${MESSAGE_PREFIX}${philosopherId}`);
}
