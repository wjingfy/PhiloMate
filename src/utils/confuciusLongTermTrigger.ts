/**
 * 长期态度 stack+1 触发（attitudes.json longTermRules.trigger v7.3）
 *
 * 负面：当期态度 ≥2
 * 触发：窗口内任意负面条数 ≥4（不再做同题聚类）
 * 每轮用户发话后若达标 → stack+1（可叠加，持续达标可持续 +1）
 */

import type { LongTermState } from './confuciusLongTermAttitude';
import { applyDowngrade } from './confuciusLongTermAttitude';

/** 输入端 path0/1/2 提取结果 + 当期态度 */
export interface WindowUserMessage {
  text: string;
  path: 'path1' | 'path2';
  themes: string[];
  categories: string[];
  condensed?: string;
  temperament?: string;
  /** 当期态度 0–4 */
  currentAttitude: number;
  at: string;
}

export interface LongTermTriggerConfig {
  windowSize: number;
  negativeAttitudeMin: number;
  /** 窗口内任意负面条数阈值（v7.3：默认 4；同题判定已取消） */
  anyNegativeTopicThreshold: number;
  stackIncrement: number;
}

export const DEFAULT_TRIGGER_CONFIG: LongTermTriggerConfig = {
  windowSize: 10,
  negativeAttitudeMin: 2,
  anyNegativeTopicThreshold: 4,
  stackIncrement: 1,
};

export interface TriggerEvaluation {
  shouldIncrement: boolean;
  reasons: string[];
  windowSize: number;
  totalMessagesInWindow: number;
  totalNegativeInWindow: number;
  /** @deprecated v7.2 起不再用于触发；恒为 0 */
  maxSameTopicClusterSize: number;
  /** @deprecated v7.2 起不再用于触发 */
  clusters: never[];
}

/** 当期态度 ≥ negativeAttitudeMin 视为负面话题 */
export function isNegativeTopic(
  msg: WindowUserMessage,
  minAttitude = DEFAULT_TRIGGER_CONFIG.negativeAttitudeMin
): boolean {
  return msg.currentAttitude >= minAttitude;
}

/** 评估最近 window 是否应 stack+1（不修改 state） */
export function evaluateLongTermTrigger(
  recentMessages: WindowUserMessage[],
  config: LongTermTriggerConfig = DEFAULT_TRIGGER_CONFIG
): TriggerEvaluation {
  const window = recentMessages.slice(-config.windowSize);
  const negatives = window.filter((m) => isNegativeTopic(m, config.negativeAttitudeMin));
  const totalNegativeInWindow = negatives.length;

  const reasons: string[] = [];
  let shouldIncrement = false;

  if (totalNegativeInWindow >= config.anyNegativeTopicThreshold) {
    shouldIncrement = true;
    reasons.push(
      `窗口内当期≥${config.negativeAttitudeMin}共${totalNegativeInWindow}条≥${config.anyNegativeTopicThreshold}`
    );
  }

  return {
    shouldIncrement,
    reasons,
    windowSize: config.windowSize,
    totalMessagesInWindow: window.length,
    totalNegativeInWindow,
    maxSameTopicClusterSize: 0,
    clusters: [],
  };
}

/** 用户发话后：若达标则 stack+1；调用方维护 recentMessages（全量，含非负面） */
export function maybeApplyLongTermTrigger(
  state: LongTermState,
  recentMessages: WindowUserMessage[],
  config: LongTermTriggerConfig = DEFAULT_TRIGGER_CONFIG,
  now = new Date()
): { state: LongTermState; triggered: boolean; evaluation: TriggerEvaluation } {
  const evaluation = evaluateLongTermTrigger(recentMessages, config);
  if (!evaluation.shouldIncrement) {
    return { state, triggered: false, evaluation };
  }
  return {
    state: applyDowngrade(state, config.stackIncrement, now),
    triggered: true,
    evaluation,
  };
}
