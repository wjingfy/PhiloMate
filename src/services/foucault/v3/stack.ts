/**
 * 长期关系 stack 与 outputMode 决议（03-corpus-to-output-logic.md §7.3/§7.4）
 *
 * 触发（v7.3）：窗口 10 条用户消息；负面 = currentAttitude ≥ 2；
 * 窗口内任意负面 ≥ 4 → longTermStack += 1（无同题聚类）。
 * 计量与 mode 结构全队统一；最高冷形态（…… / 仅动画）统一。
 */
import type { DialogueState, OutputMode } from './types';

/** 窗口内任意负面（≥2）次数 ≥4 → +1；持续达标每轮可再 +1 */
export function maybeTriggerStack(s: DialogueState, currentAttitude: number) {
  const negatives = s.attitudeHistory.filter((a) => a >= 2).length;
  if (negatives >= 4) {
    s.longTermStack += 1;
  }
}

export interface OutputModeDecision {
  outputMode: OutputMode;
  maxChars: number;
}

/**
 * §7.4 outputMode 决议（cumulative ≈ currentAttitude + longTermStack）
 */
export function resolveOutputMode(
  currentAttitude: number,
  longTermStack: number,
): OutputModeDecision {
  const cumulative = currentAttitude + longTermStack;

  if (cumulative >= 7) return { outputMode: 'animation_only', maxChars: 0 };
  if (longTermStack > 0 && (currentAttitude === 4 || cumulative >= 5)) {
    return { outputMode: 'ellipsis', maxChars: 3 };
  }
  if (longTermStack === 0 && currentAttitude === 4) {
    return { outputMode: 'distant_cautious', maxChars: 20 };
  }
  if (longTermStack > 0 && currentAttitude <= 1) return { outputMode: 'shortened', maxChars: 10 };
  if (longTermStack > 0 && cumulative === 4) return { outputMode: 'stack_stern', maxChars: 10 };
  // 盲评整改二（2026-09-05，用户拍板）：福柯非寡言人设，以「把事情谈清楚」优先，
  // normal 160→300，先跑 300 再按效果调；防回潮裸模长文的红线靠成句条款（单概念贯穿、不堆术语、无总结段）。
  return { outputMode: 'normal', maxChars: 300 };
}
