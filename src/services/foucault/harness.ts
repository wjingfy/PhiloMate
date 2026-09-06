import { MODEL } from '../../constants/app';
import type { CorpusEntryRecord, RoleData } from '../../types';
import { chatCompletionText } from '../confucius/qwenJson';
import type { RetrievalResult } from '../dialogue/retrieval';

const EMPATHY_INPUT = /压力|焦虑|失眠|睡不着|疲惫|厌倦|厌烦|撑不住|完不成|害怕失败|低落|难受|痛苦|去世|离世|失去|分手|创伤/;

export function isFoucaultEmpathyInput(input: string): boolean {
  return EMPATHY_INPUT.test(input);
}

function empathyScore(input: string, entry: CorpusEntryRecord): number {
  const blob = JSON.stringify({
    condensed: entry.condensed,
    frames: entry.attitudeFrames,
    caution: entry.generationCaution,
  });
  const groups = [
    /压力|焦虑|完不成|害怕|困难/,
    /失眠|睡不着/,
    /疲惫|厌倦|厌烦|不想做|自讨苦吃/,
    /去世|离世|死亡|失去|丧亲/,
    /痛苦|低落|难受|崩溃/,
  ];
  return groups.reduce((score, pattern) => score + (pattern.test(input) && pattern.test(blob) ? 4 : 0), 0);
}

function firstFrame(entry: CorpusEntryRecord): Record<string, unknown> | null {
  return (entry.attitudeFrames?.find((frame) => frame.lensKey === '体验') ?? entry.attitudeFrames?.[0] ?? null) as Record<string, unknown> | null;
}

export function adjustFoucaultEmpathyRetrieval(
  input: string,
  data: RoleData,
  retrieval: RetrievalResult,
): RetrievalResult {
  if (!isFoucaultEmpathyInput(input)) return retrieval;
  const ranked = data.corpus
    .filter((entry) => entry.themes?.includes('体验'))
    .map((entry) => ({ entry, score: empathyScore(input, entry) }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  const entry = ranked[0]?.score ? ranked[0].entry : null;
  return {
    ...retrieval,
    path: 'path2',
    primaryLens: entry ? { kind: 'theme', key: '体验', reinterpretation: '以真实相近的亲历作陪伴，不指导用户' } : null,
    entry,
    frame: entry ? firstFrame(entry) : null,
    corpusTemperament: entry?.temperaments?.[0] ?? '',
  };
}

const CRISIS_SYSTEM = `你是福柯。用户刚说了轻生的话，你只写定稿回应之前的一句接话。
若本句或上文有具体的人、事、处境，用不超过25字平平接住；没有则只输出“无”。
禁止诊断、劝慰、建议、分析、提问、承诺、鼓励和虚构事实。只输出接话正文或“无”。`;

export async function composeFoucaultCrisisLeadIn(
  userInput: string,
  priorTurns: Array<{ role: string; content: string }>,
): Promise<string> {
  const context = priorTurns.slice(-4).map((turn) => `${turn.role}: ${turn.content}`).join('\n');
  if (!context) return '';
  try {
    const raw = await chatCompletionText(
      CRISIS_SYSTEM,
      JSON.stringify({ context, userInput }),
      MODEL,
      80,
      0.2,
    );
    const text = raw.replace(/[\r\n]+/g, '').trim();
    if (!text || text === '无' || /[？?]|建议|应该|会好的|坚强/.test(text)) return '';
    return [...text].slice(0, 25).join('').replace(/[，；：]$/, '。');
  } catch {
    return '';
  }
}

