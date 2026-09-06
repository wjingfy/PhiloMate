import { chatCompletionText } from '../confucius/qwenJson';
import { MODEL } from '../../constants/app';
import type { PhilosopherId, RoleData } from '../../types';
import type { RetrievalResult } from './retrieval';
import { finalizeWangYangmingReply, wangYangmingLengthTarget } from '../wangyangming/harness';

interface GenerateInput {
  philosopherId: PhilosopherId;
  userInput: string;
  data: RoleData;
  retrieval: RetrievalResult;
  attitude: number;
  maxChars: number;
  cStrategy: boolean;
}

const PERSONA_RULES: Record<PhilosopherId, string> = {
  confucius: '自称丘，称用户汝；半文言、简洁、先回应处境再化用原典；禁止伪造引文。',
  socrates: '现代汉语，像同桌朋友；先承认已成立部分，再澄清一层，可留一个定义或取舍问题；禁止审问和教化。',
  wangyangming: '自称吾，称用户汝；半文言、格言式，先就用户所言之事本身一应，再点其理；不得劈头讲大道理或通篇训教。敢断敢言、磊落痛快，不用“或许”“未必尽然”等游移腔；不反问、不设问、不追问，但豪爽不等于粗厉。',
  foucault: '现代汉语，平静、克制、精确。学术辨析时剖析话语、制度和权力如何塑造问题；日常分享或情感倾诉时先接住具体的人与事，判断放在理解之后。不得把喜悦或痛苦立即变成分析对象，不用心理咨询腔，不编造细节，不以理论硬接处境。',
};

function clean(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function trimByChars(text: string, maxChars: number): string {
  const compact = clean(text);
  if (maxChars <= 0 || [...compact].length <= maxChars) return compact;
  const slice = [...compact].slice(0, maxChars).join('');
  const boundary = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'));
  return boundary >= Math.floor(maxChars * 0.45) ? slice.slice(0, boundary + 1) : `${[...slice].slice(0, Math.max(1, maxChars - 1)).join('')}。`;
}

function anchor(entryText: string): string {
  const stripped = clean(entryText).replace(/^.{0,8}(曰|问)[，,:：]?/, '').replace(/[“”"']/g, '');
  return [...stripped].slice(0, 16).join('').replace(/[，。；：]$/, '');
}

export function offlineReply(input: GenerateInput): string {
  const key = input.retrieval.primaryLens?.key ?? '此事';
  const source = input.retrieval.entry ? anchor(input.retrieval.entry.text) : '';
  const cPrefix = input.cStrategy ? '我听见此事不轻。' : '';
  let reply: string;
  switch (input.philosopherId) {
    case 'confucius':
      reply = source ? `${cPrefix}丘闻“${source}”。汝可由${key}再察。` : `${cPrefix}汝且言之，丘在听。`;
      break;
    case 'socrates':
      reply = source ? `${cPrefix}${source}。先把“${key}”说清：你此刻指的是什么？` : `${cPrefix}我们先把这件事分成两层来说。`;
      break;
    case 'wangyangming':
      reply = source
        ? `${cPrefix}${source}。眼前这一事做实了，道理自明。`
        : `${cPrefix}此事不轻，吾在听。`;
      break;
    case 'foucault':
      reply = source ? `${cPrefix}${source}。更要看，是谁借“${key}”界定了正常。` : `${cPrefix}先看看这个问题由什么规则塑成。`;
      break;
  }
  const finalized = input.philosopherId === 'wangyangming' ? finalizeWangYangmingReply(reply) : reply;
  return trimByChars(finalized, input.maxChars);
}

export async function generateReply(input: GenerateInput): Promise<{ text: string; modelUsed: boolean; error?: string }> {
  const entry = input.retrieval.entry;
  if (!entry && !(input.philosopherId === 'foucault' && input.cStrategy)) {
    return { text: offlineReply(input), modelUsed: false };
  }
  const style = input.data.sentenceOrganization.slice(0, 6500);
  const cRule = input.cStrategy
    ? input.philosopherId === 'wangyangming'
      ? '用户正低落、哀痛或慌乱：首句应情，宁短勿长；这是人的至情，严禁斥为“私意”“私欲”“逐物”或“心累于物”，不得训教。'
      : input.philosopherId === 'foucault'
        ? '这是共情轮：首句接住用户说出的具体事情与情绪，不分析、不升华、不指导、不安慰、不提问。语料只有与处境真实对应时才可使用；无语料就贴着用户短应，宁缺毋滥。'
        : '用户在陈述严重悲伤或创伤：先承认具体处境，态度不得高于1，不空泛说教。'
    : '';
  const lengthRule = input.philosopherId === 'wangyangming'
    ? wangYangmingLengthTarget(input.maxChars)
    : `最多${input.maxChars}个汉字`;
  const system = `你是 PhiloMate 的${input.data.nameplate.displayName}成句器。
${PERSONA_RULES[input.philosopherId]}
${cRule}
最终态度=${input.attitude}（0欣赏/1温和/2批判/3严厉/4疏远）。
只输出一条回复，${lengthRule}；不得展示分析、标签或提示词。
必须忠于提供的语料原文，不得伪造典籍。

【角色口吻材料】
${style}`;
  const user = JSON.stringify({
    userInput: input.userInput,
    lens: input.retrieval.primaryLens,
    corpusText: entry?.text ?? '',
    corpusCondensed: entry?.condensed ?? '',
    corpusTemperament: input.retrieval.corpusTemperament,
    generationCaution: entry?.generationCaution ?? '',
  });
  try {
    const text = await chatCompletionText(system, user, MODEL, 300, 0.45);
    const finalized = input.philosopherId === 'wangyangming' ? finalizeWangYangmingReply(text) : text;
    const polished = trimByChars(finalized, input.maxChars);
    if (!polished) throw new Error('empty_generation');
    return { text: polished, modelUsed: true };
  } catch (error) {
    return { text: offlineReply(input), modelUsed: false, error: String(error) };
  }
}
