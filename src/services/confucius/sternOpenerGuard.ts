/**
 * 严厉语气：委托 tonePhrase；触发槽仍为严厉(3)
 */
export {
  hasSternOpener,
  buildSternOpenerPromptBlock,
  dedupeSternOpener,
  STERN_OPENER_RES,
} from './tonePhrase';

import { hasSternOpener } from './tonePhrase';

/** 严厉开场触发条件：达到「最终严厉(3)」的两条路径 */
export function isSternJudgmentAttitudeSlot(params: {
  currentAttitude: number;
  longTermStack: number;
  cumulative: number;
}): boolean {
  const { currentAttitude, longTermStack, cumulative } = params;
  if (currentAttitude === 3 && longTermStack <= 0) return true;
  if (currentAttitude === 2 && longTermStack === 1 && cumulative === 3) return true;
  return false;
}

export function shouldSuggestSternOpener(params: {
  currentAttitude: number;
  longTermStack: number;
  cumulative: number;
  outputMode: string;
  isRebuttal?: boolean;
  isMetaCritique?: boolean;
  lastConfuciusReply?: string | null;
  recentConfuciusReplies?: string[];
  rollOk?: boolean;
}): boolean {
  if (params.rollOk === false) return false;
  if (!isSternJudgmentAttitudeSlot(params)) return false;
  if (params.outputMode !== 'normal') return false;
  if (params.isMetaCritique) return false;

  const recent = [
    params.lastConfuciusReply,
    ...(params.recentConfuciusReplies ?? []),
  ].filter((s): s is string => Boolean(s));

  if (recent.slice(0, 2).some(hasSternOpener)) return false;
  return true;
}
