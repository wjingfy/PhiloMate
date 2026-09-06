/**
 * 欣赏语气：委托 tonePhrase（甲类句首/短判断 + 乙类君子哉等）
 */
export {
  hasAffirmationOpener,
  buildAffirmationPromptBlock,
  dedupeAffirmationOpener,
  AFFIRM_OPENER_RES as AFFIRMATION_OPENER_RES,
} from './tonePhrase';

import { hasAffirmationOpener } from './tonePhrase';

export function shouldSuggestAffirmationOpener(params: {
  currentAttitude: number;
  longTermStack: number;
  outputMode: string;
  isRebuttal?: boolean;
  isMetaCritique?: boolean;
  lastConfuciusReply?: string | null;
  recentConfuciusReplies?: string[];
  /** 未传则默认允许（由 pipeline 再 roll 概率） */
  rollOk?: boolean;
}): boolean {
  if (params.rollOk === false) return false;
  if (params.currentAttitude !== 0) return false;
  if (params.longTermStack > 0) return false;
  if (params.outputMode !== 'normal') return false;
  if (params.isRebuttal || params.isMetaCritique) return false;

  const recent = [
    params.lastConfuciusReply,
    ...(params.recentConfuciusReplies ?? []),
  ].filter((s): s is string => Boolean(s));

  if (recent.slice(0, 2).some(hasAffirmationOpener)) return false;
  return true;
}
