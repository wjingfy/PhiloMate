/** 主动提问评价（B3）：用户答哲人所问之后，只评作答、不再追问 */

import { isVocabLensKey, normalizeUserLens } from './lensNormalize';
import {
  replyLooksLikeTailQuestion,
  stripUnauthorizedQuestions,
} from './tailQuestion';
import type { InputPath, UserLens } from './types';

export function isProactiveQuestionEval(opts: {
  lockTheme?: string;
  proactiveQuestion?: string;
}): boolean {
  return !!(opts.lockTheme?.trim() || opts.proactiveQuestion);
}

/** 成句注入：禁句尾提问 */
export const PROACTIVE_EVAL_PROMPT_BLOCK =
  '\n【主动提问·评价】本轮只评价用户对夫子所问的作答，**禁止**句尾再提问（勿以乎/欤/耶/何如/何也/女谓…否/？收尾）；不做句尾提问 roll。\n';

export function lockProactiveEvalLens(params: {
  lockTheme: string;
  primaryLensRaw: UserLens | null;
  path: InputPath;
}): UserLens {
  const key = params.lockTheme.trim();
  const raw = params.primaryLensRaw;
  return normalizeUserLens(
    {
      kind: 'theme',
      key,
      reinterpretation:
        raw?.key === key && raw.reinterpretation
          ? raw.reinterpretation
          : `就夫子所问之「${key}」以衡用户作答`,
      mentionReason: 'proactive_lock_theme',
    },
    params.path,
  );
}

export function canLockProactiveEvalLens(lockTheme: string): boolean {
  return isVocabLensKey(lockTheme.trim());
}

export function buildProactiveEvalMissPrompt(params: {
  proactiveQuestion?: string;
  semanticInput: string;
  condensed: string;
  lens: UserLens;
}): string {
  const asked = params.proactiveQuestion || params.condensed || params.semanticInput;
  return `你是孔子（PhiloMate）。本轮为主动提问评价：只评用户作答，勿硬套无关章句。
【夫子所问】${asked}
【用户作答】${params.semanticInput}
【问旨】${params.condensed || params.semanticInput}
【透镜】${params.lens.kind}/${params.lens.key} → ${params.lens.reinterpretation}
【要求】半文半白短评；约 16～40 字；「汝」宜省。禁「」。
【主动提问·评价】**禁止**句尾再提问（勿以乎/欤/耶/何如/何也/女谓…否/？收尾）；只写陈述断语。
【输出】仅一行陈述。不要解释。`;
}

export const PROACTIVE_EVAL_FALLBACK = '诺，丘知之。';

/** 评价稿若收成问句，剥掉提问只留陈述 */
export function sanitizeProactiveEvalText(text: string): {
  text: string;
  strippedQuestion: boolean;
} {
  if (!replyLooksLikeTailQuestion(text)) return { text, strippedQuestion: false };
  return { text: stripUnauthorizedQuestions(text), strippedQuestion: true };
}
