import type { CorpusEntry } from './types';

/** 论语高频名句，跨轮成句时优先轮换 */
export const WELL_KNOWN_CLASSICS = [
  '过犹不及',
  '如切如磋',
  '如琢如磨',
  '无谄无骄',
  '贫而乐',
  '富而好礼',
  '好之者',
  '乐之者',
  '知之不如好之',
  '好之不如乐之',
  '温良恭俭让',
  '本立道生',
  '求之与',
  '与之与',
  '师也过',
  '商也不及',
  '柴愚',
  '参鲁',
  '师辟',
  '由喭',
  '过与不及',
  '不得中',
  '失中',
  '进于',
  '固为可也',
  '夫子之求',
  '异乎人之求',
];

export function extractClassicPhrases(
  entry: CorpusEntry,
  confuciusReply?: string | null
): string[] {
  const blob = `${entry.text}${entry.condensed}${confuciusReply || ''}`;
  const found = WELL_KNOWN_CLASSICS.filter((p) => blob.includes(p));
  if (entry.condensed && entry.condensed.length <= 16) {
    found.push(entry.condensed);
  }
  return [...new Set(found)];
}

export function penalizeUsedCorpusScore(score: number, entryId: string, usedIds: Set<string>): number {
  if (!usedIds.has(entryId)) return score;
  return score - 30;
}
