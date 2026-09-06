/**
 * 会话状态管理（02 §8 + 03 §3 粘滞窗 + §7.3 stack 恢复）
 * 以 conversationId 为键存于内存；页面切换自然重置，不影响控制流正确性。
 */
import type { DialogueState, MoodTier, MoodBucket } from './types';

const states = new Map<string, DialogueState>();

export function createInitialDialogueState(): DialogueState {
  return {
    usedCorpusIds: [],
    lastCorpusId: null,
    cModeStickyRemaining: 0,
    awaitingTailAnswer: false,
    moodTierHistory: [],
    bucketHistory: [],
    attitudeHistory: [],
    longTermStack: 0,
    calmStreak: 0,
    lastCalmAt: 0,
    stickyLensKey: null,
  };
}

/** 将整合工程持久化的角色状态恢复到 3.0 管线。 */
export function setDialogueState(convId: string, value?: Partial<DialogueState>): DialogueState {
  const initial = createInitialDialogueState();
  const state: DialogueState = {
    ...initial,
    ...value,
    usedCorpusIds: Array.isArray(value?.usedCorpusIds) ? value.usedCorpusIds.slice(-30) : [],
    moodTierHistory: Array.isArray(value?.moodTierHistory) ? value.moodTierHistory.slice(-10) : [],
    bucketHistory: Array.isArray(value?.bucketHistory) ? value.bucketHistory.slice(-10) : [],
    attitudeHistory: Array.isArray(value?.attitudeHistory) ? value.attitudeHistory.slice(-10) : [],
  };
  states.set(convId, state);
  return state;
}

export function getDialogueState(convId: string): DialogueState {
  let s = states.get(convId);
  if (!s) {
    s = createInitialDialogueState();
    states.set(convId, s);
  }
  return s;
}

export function resetDialogueState(convId: string) {
  states.delete(convId);
}

/** 记录本轮 mood（历史窗口 10） */
export function pushMoodHistory(s: DialogueState, tier: MoodTier, bucket: MoodBucket) {
  s.moodTierHistory.push(tier);
  if (s.moodTierHistory.length > 10) s.moodTierHistory.shift();
  s.bucketHistory.push(bucket);
  if (s.bucketHistory.length > 10) s.bucketHistory.shift();
}

/** 近 10 句中某类 bucket 出现次数（B1/B2 算一类） */
export function countRecentBucket(s: DialogueState, bucket: MoodBucket): number {
  if (bucket === 'B1' || bucket === 'B2') {
    return s.bucketHistory.filter((b) => b === 'B1' || b === 'B2').length;
  }
  return s.bucketHistory.filter((b) => b === bucket).length;
}

/** 记录本轮当期态度（窗口 10） */
export function pushAttitudeHistory(s: DialogueState, attitude: number) {
  s.attitudeHistory.push(attitude);
  if (s.attitudeHistory.length > 10) s.attitudeHistory.shift();
}

/** 记录本轮选中语料（排除重复） */
export function markCorpusUsed(s: DialogueState, id: string) {
  s.lastCorpusId = id;
  if (!s.usedCorpusIds.includes(id)) {
    s.usedCorpusIds.push(id);
    if (s.usedCorpusIds.length > 30) s.usedCorpusIds.shift();
  }
}

/* ---------------- 03 §3 粘滞窗 ---------------- */

/** C 策略是否激活：moodTier==C 或（sticky>0 且未 earlyExit 且本句为 D） */
export function isCStrategyActive(s: DialogueState, tier: MoodTier, earlyExitSticky: boolean): boolean {
  if (tier === 'C') return true;
  if (tier === 'D' && s.cModeStickyRemaining > 0 && !earlyExitSticky) return true;
  return false;
}

/** 触发/消耗粘滞（A8/B1/B2/C 触发置 3；D+earlyExit 清零；粘滞中 D 消耗） */
export function updateSticky(s: DialogueState, tier: MoodTier, earlyExitSticky: boolean) {
  if (tier === 'A8' || tier === 'B1' || tier === 'B2' || tier === 'C') {
    s.cModeStickyRemaining = 3;
    return;
  }
  if (tier === 'D') {
    if (earlyExitSticky) {
      s.cModeStickyRemaining = 0;
    } else if (s.cModeStickyRemaining > 0) {
      s.cModeStickyRemaining -= 1;
    }
  }
}

/* ---------------- 03 §7.3 stack 恢复 ---------------- */

/** 每轮开始：连续 3 次当期 ≤1 → −1；满 30 分钟 → −1 */
export function applyStackRecovery(s: DialogueState, now: number) {
  if (s.longTermStack <= 0) return;
  if (s.calmStreak >= 3) {
    s.longTermStack -= 1;
    s.calmStreak = 0;
  } else if (s.lastCalmAt > 0 && now - s.lastCalmAt >= 30 * 60 * 1000) {
    s.longTermStack -= 1;
    s.lastCalmAt = now;
  }
}

/** 本轮态度 ≤1 记 calm；否则清零 */
export function recordCalm(s: DialogueState, currentAttitude: number, now: number) {
  if (currentAttitude <= 1) {
    s.calmStreak += 1;
    if (s.lastCalmAt === 0) s.lastCalmAt = now;
  } else {
    s.calmStreak = 0;
    s.lastCalmAt = 0;
  }
}
