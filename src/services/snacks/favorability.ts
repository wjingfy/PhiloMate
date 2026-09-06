/** 好感增减（共用每日上限） */

import { formatDateKey } from '../wastepaper/logic';
import { readLocalJson, writeLocalJson } from '../ui/storage';

const FAVORABILITY_PREFIX = 'philomate_favorability_';
export const FAVORABILITY_DAILY_CAP = 20;
export const FAVORABILITY_SCORE_MAX = 110;
export const FAVORABILITY_CHANGED_EVENT = 'philomate:favorability-changed';

export interface FavorabilityState {
  score: number;
  dailyGained: number;
  dailyGainedDate: string;
}

export interface FavorabilityChangedDetail {
  philosopherId: string;
  score: number;
  dailyGained: number;
}

/** 档位：0=档外(<20)，1–5 对应 20/40/60/80/100 */
export function getFavorabilityTier(score: number): number {
  if (score < 20) return 0;
  if (score < 40) return 1;
  if (score < 60) return 2;
  if (score < 80) return 3;
  if (score < 100) return 4;
  return 5;
}

function load(philosopherId: string): FavorabilityState {
  const today = formatDateKey(new Date());
  try {
    const parsed = readLocalJson<Partial<FavorabilityState> | number | null>(`${FAVORABILITY_PREFIX}${philosopherId}`, null);
    if (parsed === null) {
      return { score: 0, dailyGained: 0, dailyGainedDate: today };
    }
    if (typeof parsed === 'number') {
      return { score: parsed, dailyGained: 0, dailyGainedDate: today };
    }
    const score = typeof parsed.score === 'number' ? parsed.score : 0;
    let dailyGained = typeof parsed.dailyGained === 'number' ? parsed.dailyGained : 0;
    let dailyGainedDate = parsed.dailyGainedDate ?? today;
    if (dailyGainedDate !== today) {
      dailyGained = 0;
      dailyGainedDate = today;
    }
    return { score, dailyGained, dailyGainedDate };
  } catch {
    return { score: 0, dailyGained: 0, dailyGainedDate: today };
  }
}

function notifyChanged(philosopherId: string, state: FavorabilityState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<FavorabilityChangedDetail>(FAVORABILITY_CHANGED_EVENT, {
      detail: {
        philosopherId,
        score: state.score,
        dailyGained: state.dailyGained,
      },
    }),
  );
}

function save(philosopherId: string, state: FavorabilityState): void {
  writeLocalJson(`${FAVORABILITY_PREFIX}${philosopherId}`, state);
  notifyChanged(philosopherId, state);
}

export function getFavorabilityState(philosopherId: string): FavorabilityState {
  return load(philosopherId);
}

/** 在每日上限内增加好感；超出则尽量加到上限为止 */
export function applyFavorabilityGain(
  philosopherId: string,
  delta: number,
): { applied: number; score: number; capped: boolean } {
  if (delta <= 0) {
    const s = load(philosopherId);
    return { applied: 0, score: s.score, capped: false };
  }
  const state = load(philosopherId);
  const room = Math.max(0, FAVORABILITY_DAILY_CAP - state.dailyGained);
  const apply = Math.min(delta, room, FAVORABILITY_SCORE_MAX - state.score);
  if (apply <= 0) {
    return { applied: 0, score: state.score, capped: true };
  }
  state.score = Math.min(FAVORABILITY_SCORE_MAX, state.score + apply);
  state.dailyGained += apply;
  save(philosopherId, state);
  return {
    applied: apply,
    score: state.score,
    capped: apply < delta,
  };
}

/** 扣分（不受每日上限约束；无下限） */
export function applyFavorabilityLoss(
  philosopherId: string,
  delta: number,
): { applied: number; score: number } {
  if (delta <= 0) {
    const s = load(philosopherId);
    return { applied: 0, score: s.score };
  }
  const state = load(philosopherId);
  state.score -= delta;
  save(philosopherId, state);
  return { applied: delta, score: state.score };
}

/**
 * 调试用：直接改分，绕过每日上限；仍遵守硬顶 110，无下限。
 * 不计入 dailyGained。
 */
export function adjustFavorabilityForDebug(
  philosopherId: string,
  delta: number,
): FavorabilityState {
  const state = load(philosopherId);
  state.score = Math.min(FAVORABILITY_SCORE_MAX, state.score + delta);
  save(philosopherId, state);
  return state;
}

export function applySnackGiftFavorability(
  philosopherId: string,
  delta: number,
): { applied: boolean; reason?: string; score: number } {
  const result = applyFavorabilityGain(philosopherId, delta);
  if (result.applied <= 0) {
    return {
      applied: false,
      reason: `今日对该哲学家好感已达上限（${FAVORABILITY_DAILY_CAP}）`,
      score: result.score,
    };
  }
  return { applied: true, score: result.score };
}
