/**
 * 孔子长期态度合成（attitudes.json longTermRules v7）
 *
 * 最终态度以当期为底；存在 longTermStack 时可叠加。
 * 输出模式按当期档位与累计值分叉。
 */

export type LongTermOutputMode =
  | 'normal' // 无降级，或 2/3 合成后进入对应档位表达
  | 'shortened' // stack>0 且当期 0/1：≤10 字
  | 'ellipsis' // "……"
  | 'animation_only'; // 不愿再谈，仅动画

export interface LongTermState {
  /** 可叠加降级层数，≥0 */
  longTermStack: number;
  /** 连续当期态度 ≤1 的轮数 */
  consecutiveMildCount: number;
  /** 上次 stack 变化时间（ISO），供半小时恢复 */
  lastStackChangeAt: string | null;
}

export interface ResolveLongTermInput {
  currentAttitude: number;
  state: LongTermState;
  /** 本轮结束后是否计入「温和轮」；默认 currentAttitude ≤ 1 */
  now?: Date;
}

export interface ResolveLongTermResult {
  /** 写入生成侧的最终态度档（0–4）；ellipsis/animation 时仍给出累计值供日志 */
  finalAttitude: number;
  cumulative: number;
  longTermStack: number;
  mode: LongTermOutputMode;
  /** 本轮允许的最大字数；ellipsis/animation 时为 0 */
  maxChars: number | null;
  /** 固定文案；仅 ellipsis 为 "……" */
  fixedOutput: string | null;
  /** 恢复后、计入本轮温和后的状态（调用方应持久化） */
  nextState: LongTermState;
}

const MILD_MAX = 1;
const MILD_ROUNDS_TO_RECOVER = 3;
const RECOVERY_MINUTES = 30;
const SHORT_MAX_CHARS = 10;
const ELLIPSIS_AT = 5;
const REFUSE_AT = 7;

export function createInitialLongTermState(): LongTermState {
  return {
    longTermStack: 0,
    consecutiveMildCount: 0,
    lastStackChangeAt: null,
  };
}

/** 距上次 stack 变化是否已满半小时 */
export function canRecoverByTime(state: LongTermState, now = new Date()): boolean {
  if (state.longTermStack <= 0 || !state.lastStackChangeAt) return false;
  const last = Date.parse(state.lastStackChangeAt);
  if (Number.isNaN(last)) return false;
  return now.getTime() - last >= RECOVERY_MINUTES * 60 * 1000;
}

/**
 * 尝试应用恢复（时间优先于本轮温和计数之外的独立检查）。
 * 半小时 → stack-1；连续 3 次 mild → stack-1。
 * 同一轮最多因时间恢复一次；温和计数在 applyMildRound 里推进。
 */
export function applyTimeRecovery(state: LongTermState, now = new Date()): LongTermState {
  if (!canRecoverByTime(state, now)) return state;
  const stack = Math.max(0, state.longTermStack - 1);
  return {
    ...state,
    longTermStack: stack,
    lastStackChangeAt: now.toISOString(),
    // 时间恢复不重置温和计数；若已无降级则清零
    consecutiveMildCount: stack === 0 ? 0 : state.consecutiveMildCount,
  };
}

/** 本轮当期态度计入温和连续；达标则 stack-1 */
export function applyMildRound(
  state: LongTermState,
  currentAttitude: number,
  now = new Date()
): LongTermState {
  if (state.longTermStack <= 0) {
    return { ...state, consecutiveMildCount: 0 };
  }
  if (currentAttitude > MILD_MAX) {
    return { ...state, consecutiveMildCount: 0 };
  }
  const count = state.consecutiveMildCount + 1;
  if (count < MILD_ROUNDS_TO_RECOVER) {
    return { ...state, consecutiveMildCount: count };
  }
  const stack = Math.max(0, state.longTermStack - 1);
  return {
    longTermStack: stack,
    consecutiveMildCount: 0,
    lastStackChangeAt: now.toISOString(),
  };
}

/** 触发降级时 stack+1（可叠加）；触发条件由调用方判定 */
export function applyDowngrade(state: LongTermState, steps = 1, now = new Date()): LongTermState {
  const stack = Math.max(0, state.longTermStack + steps);
  return {
    ...state,
    longTermStack: stack,
    lastStackChangeAt: now.toISOString(),
    consecutiveMildCount: 0,
  };
}

/**
 * 合成最终表达模式。
 * 顺序：先时间恢复 → 再按当期+stack 分叉 → 再计入本轮温和（写入 nextState）。
 */
export function resolveLongTermAttitude(input: ResolveLongTermInput): ResolveLongTermResult {
  const now = input.now ?? new Date();
  const current = clampAttitude(input.currentAttitude);
  let state = applyTimeRecovery(input.state, now);

  const stack = state.longTermStack;
  const cumulative = current + stack;

  if (stack <= 0) {
    const nextState = applyMildRound(state, current, now);
    return {
      finalAttitude: current,
      cumulative: current,
      longTermStack: 0,
      mode: 'normal',
      maxChars: null,
      fixedOutput: null,
      nextState,
    };
  }

  // 有降级：优先拒绝对话 / 省略号（仅对主链 0–4）
  if (cumulative >= REFUSE_AT) {
    const nextState = applyMildRound(state, current, now);
    return {
      finalAttitude: cumulative,
      cumulative,
      longTermStack: stack,
      mode: 'animation_only',
      maxChars: 0,
      fixedOutput: null,
      nextState,
    };
  }

  /** 有 stack 且（当期=4 或 累积≥5）→ 省略号；无 stack 的当期=4 不在此列，走 distant_cautious 成句 */
  if (stack > 0 && (current === 4 || cumulative >= ELLIPSIS_AT)) {
    const nextState = applyMildRound(state, current, now);
    return {
      finalAttitude: Math.min(cumulative, 4),
      cumulative,
      longTermStack: stack,
      mode: 'ellipsis',
      maxChars: 0,
      fixedOutput: '……',
      nextState,
    };
  }

  if (current <= 1) {
    const nextState = applyMildRound(state, current, now);
    return {
      finalAttitude: current,
      cumulative,
      longTermStack: stack,
      mode: 'shortened',
      maxChars: SHORT_MAX_CHARS,
      fixedOutput: null,
      nextState,
    };
  }

  // current ∈ {2,3}：档位叠加
  const finalAttitude = Math.min(cumulative, 4);
  const nextState = applyMildRound(state, current, now);
  return {
    finalAttitude,
    cumulative,
    longTermStack: stack,
    mode: 'normal',
    maxChars: null,
    fixedOutput: null,
    nextState,
  };
}

function clampAttitude(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(4, Math.floor(n)));
}
