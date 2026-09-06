/** 福柯 3.0 主动提问评价：判定与成句分档，不改长期态度。 */
import { chat, chatJson, llmConfig } from './v3/llm';
import { PROMPT_EVAL_JUDGE_SYSTEM, PROMPT_EVAL_SYSTEM } from './v3/prompts';
import {
  EXPRESSION_BLOCKS,
  dropLabelledFirstSentence,
  hitEvalLabelOpening,
  polishOutput,
} from './v3/compose';

export type EvalVerdict = 'appreciate' | 'explore' | 'question_back';

export interface PendingFoucaultQuestion {
  id: string;
  group: string;
  text: string;
  evalPoints: string[];
  attempts: number;
}

export interface EvaluationResult {
  reply: string;
  verdict: EvalVerdict;
  viaModel: boolean;
  keepPending: boolean;
}

export const EVAL_MAX_CHARS = 150;
const MAX_ATTEMPTS = 2;

function isValidVerdict(value: unknown): value is EvalVerdict {
  return value === 'appreciate' || value === 'explore' || value === 'question_back';
}

async function judgeAnswer(
  pending: PendingFoucaultQuestion,
  userAnswer: string,
): Promise<{ verdict: EvalVerdict; reason: string; viaModel: boolean }> {
  const payload = [
    `【问题】${pending.text}`,
    `【evalPoints】${pending.evalPoints.join('；')}`,
    `【用户回答】${userAnswer.slice(0, 500)}`,
  ].join('\n');
  const judged = await chatJson<{ verdict?: string; reason?: string }>(
    PROMPT_EVAL_JUDGE_SYSTEM,
    payload,
    { temperature: 0.2, maxTokens: 96, model: llmConfig.routeModel },
  );
  if (judged && isValidVerdict(judged.verdict)) {
    return {
      verdict: judged.verdict,
      reason: typeof judged.reason === 'string' ? judged.reason : '',
      viaModel: true,
    };
  }
  const trimmed = userAnswer.trim();
  if (trimmed.length < 8 || /^(不知道|不清楚|说不上来|没想过|不会)/.test(trimmed)) {
    return { verdict: 'question_back', reason: '兜底：回答过短或拒答', viaModel: false };
  }
  return { verdict: 'explore', reason: '兜底：模型不可用', viaModel: false };
}

const FALLBACK_LINES: Record<EvalVerdict, string> = {
  appreciate: '你答到了点子上，这话里有你自己的东西。',
  explore: '你碰到这个问题的边了。往里再走一步看看。',
  question_back: '你绕开了我问的那句。再看一遍那个问题。',
};

async function composeEvaluation(
  pending: PendingFoucaultQuestion,
  userAnswer: string,
  verdict: EvalVerdict,
  reason: string,
  hasEmotion: boolean,
): Promise<string> {
  const expressionBlock = EXPRESSION_BLOCKS[verdict === 'appreciate' ? 0 : 1];
  const payload = [
    `【你提出的问题】${pending.text}`,
    `【evalPoints（你在意的点）】${pending.evalPoints.join('；')}`,
    `【用户的回答】${userAnswer.slice(0, 500)}`,
    `【verdict】${verdict}（${reason || '无理由'}）`,
    hasEmotion ? '【应情】用户的回答带着情绪体验：首句先接住那个人，再谈问题。' : '',
    `【maxChars】${EVAL_MAX_CHARS}`,
    `【expressionBlock】${expressionBlock}`,
  ].filter(Boolean).join('\n');
  const raw = await chat(
    [
      { role: 'system', content: PROMPT_EVAL_SYSTEM },
      { role: 'user', content: payload },
    ],
    { temperature: 0.7, maxTokens: 256, model: llmConfig.model, enableThinking: false },
  );
  if (!raw) return FALLBACK_LINES[verdict];
  let output = polishOutput(raw, EVAL_MAX_CHARS);
  if (output && hitEvalLabelOpening(output)) output = dropLabelledFirstSentence(output);
  return output || FALLBACK_LINES[verdict];
}

export async function evaluateFoucaultAnswer(options: {
  pending: PendingFoucaultQuestion;
  userAnswer: string;
  hasEmotion: boolean;
}): Promise<EvaluationResult> {
  const { pending, userAnswer, hasEmotion } = options;
  const { verdict, reason, viaModel } = await judgeAnswer(pending, userAnswer);
  const reply = await composeEvaluation(pending, userAnswer, verdict, reason, hasEmotion);
  return {
    reply,
    verdict,
    viaModel,
    keepPending: verdict === 'question_back' && pending.attempts + 1 < MAX_ATTEMPTS,
  };
}
