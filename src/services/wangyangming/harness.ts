import type { RetrievalResult } from '../dialogue/retrieval';

const TENSION_PATTERNS = [
  /两难|取舍|顾此失彼|进退|舍.*保|要.*还是|既.*又|一边.*一边/,
  /太拼|过度|不顾身体|代价|伤.*根本|两头难|过犹不及/,
];

export function hasWangYangmingTension(input: string): boolean {
  return TENSION_PATTERNS.some((pattern) => pattern.test(input));
}

export function resolveWangYangmingMaxChars(params: {
  baseMaxChars: number;
  cStrategy: boolean;
  retrieval: RetrievalResult;
  userInput: string;
}): number {
  if (params.cStrategy && params.baseMaxChars > 45) return 45;
  if (
    params.retrieval.path === 'path2'
    && !hasWangYangmingTension(params.userInput)
    && params.retrieval.entry
  ) {
    return Math.min(params.baseMaxChars + 20, 80);
  }
  return params.baseMaxChars;
}

export function wangYangmingLengthTarget(maxChars: number): string {
  return maxChars >= 45
    ? `长度目标约${Math.round(maxChars * 0.85)}字（${Math.max(40, maxChars - 20)}-${maxChars}字），勿过短`
    : `限${maxChars}字以内`;
}

export function finalizeWangYangmingReply(reply: string): string {
  return reply
    .replace(/[？?]+/g, '。')
    .replace(/(?:或许|也许|未必尽然|可能吧)/g, '')
    .replace(/。{2,}/g, '。')
    .trim();
}

