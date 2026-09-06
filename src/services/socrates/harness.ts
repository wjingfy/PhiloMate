import { MODEL } from '../../constants/app';
import type {
  ConversationState,
  CorpusEntryRecord,
  PipelineResponse,
  RoleData,
  SocratesDialogueState,
} from '../../types';
import { chatCompletionTextWithHistory, type ModelMessage } from '../confucius/qwenJson';
import { trimByChars } from '../dialogue/generator';
import type { RetrievalResult } from '../dialogue/retrieval';
import {
  advanceSocratesStateV2,
  createBaseSocratesPlan,
  generateSocratesReplyV2,
  prepareSocratesPlan,
} from './engineV2.generated';

/**
 * 苏格拉底专属运行时只保留原交件中真正有用的合同：多轮历史、现代场景钩子、
 * 语料锚点与角色状态。旧 Python 的 50 余场景叠层、Best-of-2 和强制问号锁不进入运行时。
 */
export interface SocratesHarnessInput {
  userInput: string;
  priorTurns: Array<{ role: 'user' | 'assistant'; content: string }>;
  sceneKey?: string;
  excludedIds?: string[];
  state: ConversationState;
  data: RoleData;
}

export type SocratesHarnessOutput = PipelineResponse;

export type SocratesTurnMode =
  | 'thin'
  | 'playful'
  | 'daily'
  | 'emotion'
  | 'decision'
  | 'concept'
  | 'meta'
  | 'general';

export interface SocratesTurnPlan {
  mode: SocratesTurnMode;
  questionBudget: 0 | 1;
  analogyDomain?: string;
  friendlyAddress?: boolean;
  visibleUncertaintyAllowed?: boolean;
  hiddenReflection?: boolean;
  dialecticMove?: string;
  abstractConcept?: boolean;
  maxChars: number;
  minChars: number;
  temperature: number;
  topP: number;
  storyAllowed: boolean;
  retrieval: RetrievalResult;
}

interface SocratesExperience {
  id?: string;
  title?: string;
  monologue?: string;
  [key: string]: unknown;
}

const THIN_TURNS = new Set([
  '嗯', '哦', '喔', '哈', '啊', '好', '行', '在吗', '你好', '嗨', '哈喽', 'hello', 'hi',
  '嗯嗯', '哦哦', '哈哈', '好的', '好呀', '晚安', '早安', '拜拜', '再见', '知道了', '收到',
]);

const META_NO_QUESTIONS = ['问太多', '别问了', '不要问', '别追问', '像审讯', '像审问', '太啰嗦'];
const PLAYFUL_HINTS = ['哈哈', '开玩笑', '逗你', '笑死', '胡扯', '瞎聊', '梦见', '做梦', '怪念头'];
const CONCEPT_HINTS = ['什么是', '何谓', '定义', '本质', '公正', '正义', '德性', '美德', '幸福是什么', '善恶', '知识'];
const DECISION_HINTS = ['要不要', '该不该', '怎么办', '辞职', '离职', '分手', '复合', '原谅', '摊牌', '搬家', '选择'];
const EMOTION_HINTS = [
  '焦虑', '害怕', '好累', '很累', '累死', '疲惫', '难过', '想哭', '愤怒', '生气', '孤独', '羞耻', '尴尬',
  '冷战', '背叛', '失恋', '自卑', '不够好', '没人懂', '心里空',
];
const DAILY_HINTS = [
  '吃饭', '吃了', '晚饭', '午饭', '外卖', '喝酒', '天气', '下雨', '好热', '好冷', '通勤', '地铁', '公交', '加班',
  '开会', '工作', '同事', '老板', '家务', '洗碗', '猫', '狗', '宠物', '花钱', '刷手机',
];

const SETTINGS: Record<SocratesTurnMode, Omit<SocratesTurnPlan, 'mode' | 'questionBudget' | 'retrieval'>> = {
  thin: { minChars: 4, maxChars: 42, temperature: 0.88, topP: 0.92, storyAllowed: false },
  playful: { minChars: 22, maxChars: 100, temperature: 0.92, topP: 0.94, storyAllowed: true },
  daily: { minChars: 48, maxChars: 130, temperature: 0.86, topP: 0.92, storyAllowed: true },
  emotion: { minChars: 45, maxChars: 125, temperature: 0.78, topP: 0.88, storyAllowed: false },
  decision: { minChars: 60, maxChars: 145, temperature: 0.76, topP: 0.87, storyAllowed: false },
  concept: { minChars: 70, maxChars: 170, temperature: 0.74, topP: 0.86, storyAllowed: false },
  meta: { minChars: 28, maxChars: 100, temperature: 0.84, topP: 0.90, storyAllowed: true },
  general: { minChars: 52, maxChars: 140, temperature: 0.84, topP: 0.91, storyAllowed: true },
};

const BAD_ANCHOR_MARKERS = [
  '商务印书馆', '译者引言', '图书在版编目', 'ISBN', '出版说明', 'CIP数据',
  '苏格拉底去世', '苏格拉底的言辞', '苏格拉底啊',
];

function compact(text: string): string {
  return text.toLowerCase().replace(/[\s，。！？；：、“”‘’（）()【】\[\],.!?;:'"-]+/g, '');
}

function includesAny(text: string, hints: string[]): boolean {
  const lower = text.toLowerCase();
  return hints.some((hint) => lower.includes(hint.toLowerCase()));
}

function bigrams(text: string): Set<string> {
  const normalized = compact(text);
  const chars = [...normalized];
  const result = new Set<string>();
  for (let index = 0; index < chars.length - 1; index += 1) result.add(chars[index]! + chars[index + 1]!);
  return result;
}

function overlapScore(left: string, right: string, cap = 8): number {
  const rightGrams = bigrams(right);
  let score = 0;
  for (const gram of bigrams(left)) {
    if (rightGrams.has(gram)) score += 1;
    if (score >= cap) break;
  }
  return score;
}

function isValidAnchor(entry: CorpusEntryRecord): boolean {
  const anchor = (entry._legacy?.text_anchor || entry.text || '').trim();
  if (anchor.length < 8 || anchor.length > 120) return false;
  if (BAD_ANCHOR_MARKERS.some((marker) => anchor.includes(marker))) return false;
  if (entry._legacy?.status && !['approved', 'ok'].includes(entry._legacy.status)) return false;
  if (entry._legacy?.corpus_tier === 'negative') return false;
  return true;
}

export function detectSocratesMode(userInput: string): SocratesTurnMode {
  const text = userInput.trim();
  const bare = compact(text);
  if (!text || THIN_TURNS.has(text.toLowerCase()) || (bare.length <= 4 && /^[嗯哦喔哈啊好行嗨嘿]+$/u.test(bare))) return 'thin';
  if (includesAny(text, META_NO_QUESTIONS)) return 'meta';
  if (includesAny(text, PLAYFUL_HINTS)) return 'playful';
  if (includesAny(text, CONCEPT_HINTS)) return 'concept';
  if (includesAny(text, DECISION_HINTS)) return 'decision';
  if (includesAny(text, EMOTION_HINTS)) return 'emotion';
  if (includesAny(text, DAILY_HINTS)) return 'daily';
  return 'general';
}

export function scoreSocratesEntry(entry: CorpusEntryRecord, userInput: string): number {
  if (!isValidAnchor(entry)) return -1;
  const legacy = entry._legacy;
  let score = 0;
  for (const hook of legacy?.modern_user_hooks ?? []) {
    const cleanHook = hook.trim();
    if (cleanHook.length < 2) continue;
    if (userInput.includes(cleanHook)) score += 8 + Math.min(cleanHook.length, 10) * 0.2;
    else score += Math.min(overlapScore(cleanHook, userInput, 6), 5) * 0.45;
  }
  for (const pair of legacy?.modern_pairs ?? []) {
    if (pair.kind === 'negative' || !pair.user_message) continue;
    score += Math.min(overlapScore(pair.user_message, userInput, 8), 6) * 0.65;
  }
  for (const key of [...(entry.themes ?? []), ...(entry.categories ?? [])]) {
    if (key.length >= 2 && userInput.includes(key)) score += 3;
  }
  score += Math.min(overlapScore(entry.condensed, userInput, 6), 4) * 0.35;
  return score;
}

function selectFrame(entry: CorpusEntryRecord, userInput: string) {
  const frames = entry.attitudeFrames ?? [];
  const direct = frames.find((frame) => typeof frame.lensKey === 'string' && userInput.includes(frame.lensKey));
  if (direct) return direct;
  return frames
    .map((frame) => ({
      frame,
      score: Array.isArray(frame.keywords)
        ? (frame.keywords as unknown[]).reduce<number>((total, keyword) => (
          total + (typeof keyword === 'string' ? overlapScore(keyword, userInput, 4) : 0)
        ), 0)
        : 0,
    }))
    .sort((left, right) => right.score - left.score)[0]?.frame ?? frames[0] ?? null;
}

export function retrieveSocratesCorpus(userInput: string, data: RoleData, usedIds: string[]): RetrievalResult {
  const unused = data.corpus.filter((entry) => !usedIds.includes(entry.id));
  const pool = unused.length ? unused : data.corpus;
  const ranked = pool
    .map((entry) => ({ entry, score: scoreSocratesEntry(entry, userInput) }))
    .filter(({ score }) => score >= 4)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
  const best = ranked[0] ?? null;
  const entry = best?.entry ?? null;
  const frame = entry ? selectFrame(entry, userInput) : null;
  const lensKind = frame?.lensKind === 'theme' ? 'theme' : 'category';
  const lensKey = typeof frame?.lensKey === 'string' ? frame.lensKey : null;
  const trigger = typeof frame?.trigger === 'string' ? frame.trigger : '';
  return {
    path: best && best.score >= 8 ? 'path1' : 'path2',
    condensed: userInput.trim().slice(0, 160),
    primaryLens: lensKey ? {
      kind: lensKind,
      key: lensKey,
      reinterpretation: trigger || `由“${lensKey}”看本轮处境`,
    } : null,
    entry,
    frame: frame as Record<string, unknown> | null,
    corpusTemperament: trigger || entry?.condensed || '',
    speechAct: /[?？]|为何|怎么|如何|何为|是否|吗/.test(userInput) ? 'question' : 'statement',
  };
}

function recentAssistantAsked(priorTurns: SocratesHarnessInput['priorTurns']): boolean {
  return priorTurns
    .filter((turn) => turn.role === 'assistant')
    .slice(-2)
    .some((turn) => /[？?]/.test(turn.content));
}

function resolveQuestionBudget(
  mode: SocratesTurnMode,
  userInput: string,
  priorTurns: SocratesHarnessInput['priorTurns'],
  runtime: SocratesDialogueState,
): 0 | 1 {
  if (mode === 'meta' || mode === 'thin' || mode === 'playful' || mode === 'daily') return 0;
  if (runtime.questionCooldown > 0 || recentAssistantAsked(priorTurns)) return 0;
  const explicitlyAsks = /[？?]|怎么办|怎么选|该不该|要不要|你觉得|请问/.test(userInput);
  if (mode === 'concept') return 1;
  if (mode === 'decision' || mode === 'emotion' || mode === 'general') return explicitlyAsks ? 1 : 0;
  return 0;
}

export function createSocratesTurnPlan(input: SocratesHarnessInput): SocratesTurnPlan {
  const mode = detectSocratesMode(input.userInput);
  const runtime = input.state.roleRuntime?.socratesDialogueState ?? {
    turnCount: 0,
    questionCooldown: 0,
    consecutiveQuestionTurns: 0,
  };
  const setting = SETTINGS[mode];
  return {
    mode,
    questionBudget: resolveQuestionBudget(mode, input.userInput, input.priorTurns, runtime),
    ...setting,
    retrieval: retrieveSocratesCorpus(input.userInput, input.data, input.excludedIds ?? input.state.usedCorpusIds),
  };
}

/** Production entry: reproduce the colleague v2 planner and its model-assisted retrieval. */
export async function prepareSocratesTurnPlan(input: SocratesHarnessInput): Promise<SocratesTurnPlan> {
  const basePlan = createBaseSocratesPlan(input) as SocratesTurnPlan;
  return await prepareSocratesPlan(input, basePlan) as SocratesTurnPlan;
}

export function resolveSocratesMaxChars(plan: SocratesTurnPlan, attitude: number): number {
  void attitude;
  return plan.maxChars;
}

function modeDirective(mode: SocratesTurnMode): string {
  switch (mode) {
    case 'thin':
      return '这是短寒暄：自然回一两句，不升格成哲学课，不发问。';
    case 'playful':
      return '顺着玩笑说，可轻轻胡扯一幅明确是想象的小画面；有内容但不讲课，不发问。';
    case 'daily':
      return '从用户说的物件或日常细节起笔；可以讲一小段亲历或市集见闻，也可以给一句有趣观察，不发问。';
    case 'emotion':
      return '先说清具体处境里哪两股力量在拉扯，再给温和的暂定判断；不要心理咨询话术。';
    case 'decision':
      return '把两种选择各自保护和牺牲的东西摆开，先给暂定判断，再决定是否留一个问题。';
    case 'concept':
      return '先正面回答并区分概念、给出边界或反例；问句只能用于最后一步检验，不能以问代答。';
    case 'meta':
      return '对方嫌问题多：立刻停问，改成直说或讲一则短见闻，承认谈话形式需要换挡。';
    case 'general':
      return '回应本轮的具体人事，给一层可复述的判断；可偶尔用小故事，但不要把每轮都做成盘问。';
  }
}

function stableIndex(text: string, length: number): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return length ? Math.abs(hash) % length : 0;
}

function selectExperience(input: SocratesHarnessInput, plan: SocratesTurnPlan): SocratesExperience | null {
  if (!plan.storyAllowed) return null;
  const runtime = input.state.roleRuntime?.socratesDialogueState;
  const shouldTell = plan.mode === 'meta' || plan.mode === 'playful' || (runtime?.turnCount ?? 0) % 3 === 1;
  if (!shouldTell) return null;
  const entries = (input.data.experiences.experiences ?? [])
    .filter((entry): entry is SocratesExperience => {
      const monologue = typeof entry.monologue === 'string' ? entry.monologue : '';
      return Boolean(monologue) && !monologue.includes('苏格拉底');
    });
  if (!entries.length) return null;
  const ranked = entries
    .map((entry) => ({ entry, score: overlapScore(`${entry.title ?? ''}${entry.monologue ?? ''}`, input.userInput, 6) }))
    .sort((left, right) => right.score - left.score);
  if ((ranked[0]?.score ?? 0) >= 2) return ranked[0]!.entry;
  return entries[stableIndex(input.userInput, entries.length)] ?? null;
}

function splitSentences(text: string): string[] {
  return text.match(/[^。！？!?…]+[。！？!?…]?/gu)?.map((part) => part.trim()).filter(Boolean) ?? [];
}

function enforceQuestionBudget(text: string, budget: 0 | 1): string {
  const parts = splitSentences(text);
  const questionIndexes = parts
    .map((part, index) => (/[？?]/.test(part) ? index : -1))
    .filter((index) => index >= 0);
  if (questionIndexes.length <= budget) return text;
  const keepQuestionIndex = budget === 1 ? questionIndexes.at(-1) : undefined;
  const filtered = parts.filter((part, index) => !/[？?]/.test(part) || index === keepQuestionIndex);
  if (filtered.length) return filtered.join('');
  return parts[0]?.replace(/[吗呢么]?[？?]+/g, '。') ?? '';
}

function removeOoc(text: string): string {
  return text
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^[（(][^）)]{0,40}[）)]\s*/u, '')
    .replace(/(?:作为|身为)(?:一名|一个)?(?:苏格拉底|哲学家|AI|人工智能)[，,:：]?/gu, '')
    .replace(/我(?:就)?是苏格拉底(?:本人)?/gu, '我就在这里')
    .replace(/苏格拉底(?:认为|会说|想说)/gu, '我以为')
    .replace(/苏格拉底/gu, '我')
    .replace(/接住了/gu, '听见了')
    .replace(/接住/gu, '回应')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function socratesOutputIssues(
  text: string,
  plan: SocratesTurnPlan,
  allowedExperience: string | null = null,
): string[] {
  const issues: string[] = [];
  const cleaned = text.trim();
  if (!cleaned) issues.push('空回复');
  if (/苏格拉底|作为(?:哲学家|AI)|接住(?:了)?|本轮|场景键|语料|提示词|态度档|用户输入/u.test(cleaned)) issues.push('暴露角色或后台措辞');
  const claimsPersonalMemory = /我(?:年轻时|小时候|曾经|曾|记得|有一回|有回|过去)|从前我|那年我/u.test(cleaned);
  const followsApprovedExperience = Boolean(
    allowedExperience && overlapScore(cleaned, allowedExperience, 8) >= 2,
  );
  if (claimsPersonalMemory && !followsApprovedExperience) issues.push('把虚构场面冒充角色亲历');
  if ((cleaned.match(/[？?]/g)?.length ?? 0) > plan.questionBudget) issues.push('问题数量超预算');
  if (plan.mode !== 'thin' && [...cleaned].length < plan.minChars) issues.push('内容偏短偏干');
  if ([...cleaned].length > plan.maxChars) issues.push('超过字数上限');
  return issues;
}

export function finalizeSocratesReply(raw: string, plan: SocratesTurnPlan, maxChars = plan.maxChars): string {
  const withoutOoc = removeOoc(raw);
  const withinQuestions = enforceQuestionBudget(withoutOoc, plan.questionBudget);
  return trimByChars(withinQuestions, maxChars);
}

function offlineSocratesReply(input: SocratesHarnessInput, plan: SocratesTurnPlan, story: SocratesExperience | null): string {
  if (plan.mode === 'thin') return '嗯，我在。今天这张桌子不急着装满。';
  if (plan.mode === 'meta') return story?.monologue
    ? `${story.monologue} 我先把问题收起来，换成直说。`
    : '问得太密，谈话就像鞋里进了沙。我先把问题收起来，换成直说。';
  if (plan.mode === 'playful') return '这话若摆到市集上，大概能换来三种笑声和半筐并不可靠的智慧。先让它好玩一会儿。';
  if (story?.monologue) return `${story.monologue} 眼前这件事也有一点相似：先看实际发生了什么，再决定给它什么名字。`;
  if (plan.mode === 'emotion') return '难受并不等于软弱，只说明这件事碰到了你认真保护的东西。先让那东西有个准确的名字，别急着审判自己。';
  if (plan.mode === 'decision') return '两条路都在收取代价：一条保住眼前的安稳，一条保住以后不必反复责问自己的余地。先看哪一种损失更难补回。';
  if (plan.mode === 'concept' && plan.questionBudget === 1) return '定义不是给词换一件漂亮外衣，而是划出边界，让相反的例子也能接受检验。你愿意先说一个肯定算、一个肯定不算的例子吗？';
  return '这话里已经有两层：事情实际怎样，以及人们希望它被怎样称呼。先把两层分开，判断会比情绪更稳，也不必急着赢。';
}

async function generateSocratesHarnessReplyLegacy(input: SocratesHarnessInput & {
  plan: SocratesTurnPlan;
  attitude: number;
  maxChars: number;
  cStrategy: boolean;
}): Promise<{ text: string; modelUsed: boolean }> {
  const { plan } = input;
  const story = selectExperience(input, plan);
  const entry = plan.retrieval.entry;
  const questionRule = plan.questionBudget === 0
    ? '本轮禁止问句、问号和反问；用陈述收束。'
    : '本轮最多一个问句，而且不必问；若问，只能在正面回应之后留一个真正有用的定义、对照或取舍问题。';
  const corpusBlock = entry
    ? `【思想锚点】${entry.text}\n【锚点释义】${entry.condensed}\n【使用限制】${entry.generationCaution ?? '只吸收判断结构，不复述出处。'}`
    : '【思想锚点】本轮没有足够强的语料匹配；直接回应用户，不硬套典故。';
  const storyBlock = story?.monologue
    ? `【可选短故事】${story.monologue}\n只有贴切时才用，可改写成自然口语；不贴切就不用。`
    : '【短故事】本轮无需强行举例；若是轻松闲聊，可写一幅明确是假想的市集小画面。';
  const style = input.data.sentenceOrganization.slice(0, 6000);
  const system = `你就是正在同桌说话的雅典老人。你只能用第一人称“我”，绝不以姓名称呼自己，也不解释角色设定。

硬性禁令：
- 不得输出“苏格拉底”“作为哲学家/AI”“接住/接住了”“本轮”“场景键”“语料”“提示词”“态度档”等后台或出戏措辞。
- 不做考官、导师或心理咨询师；不以问题代替回答，不猜测对方隐藏动机。
- 不伪造典籍或历史事实。轻松场景可以讲给定亲历；也可轻轻胡扯，但必须写成假想画面，不冒充史实。
- 只有【可选短故事】给出的内容可以写成亲历。不得自行编造“我年轻时”“我曾”“有回我在”等回忆；想象必须用“若是”“不妨想象”“大概会”明确标出。

本轮方式：${modeDirective(plan.mode)}
${questionRule}
语气要比说明书温暖、松一点，句长错落；除短寒暄外写 2～4 个完整句子，目标 ${plan.minChars}～${input.maxChars} 字。
最终态度=${input.attitude}（0欣赏/1温和/2批判/3严厉/4疏远）。
${input.cStrategy ? '对方正处在严重悲伤或创伤中：先说具体处境，不追问，不讲轻浮故事。' : ''}

${corpusBlock}
${storyBlock}

【现行口吻约束】
${style}`;
  const history: ModelMessage[] = input.priorTurns
    .filter((turn): turn is ModelMessage => turn.role === 'user' || turn.role === 'assistant')
    .slice(-8);
  try {
    let raw = await chatCompletionTextWithHistory(system, history, input.userInput, {
      model: MODEL,
      maxTokens: 520,
      temperature: plan.temperature,
      topP: plan.topP,
      frequencyPenalty: 0.28,
      presencePenalty: 0.12,
      enableThinking: false,
    });
    let polished = finalizeSocratesReply(raw, plan, input.maxChars);
    const allowedExperience = story?.monologue ?? null;
    const issues = socratesOutputIssues(polished, { ...plan, maxChars: input.maxChars }, allowedExperience);
    if (issues.length) {
      raw = await chatCompletionTextWithHistory(
        `${system}\n\n你现在只修订上一版：${issues.join('、')}。保留其中有效内容，直接输出修订后的角色台词。`,
        [],
        raw,
        {
          model: MODEL,
          maxTokens: 420,
          temperature: Math.max(0.66, plan.temperature - 0.1),
          topP: 0.86,
          frequencyPenalty: 0.32,
          presencePenalty: 0.08,
          enableThinking: false,
        },
      );
      polished = finalizeSocratesReply(raw, plan, input.maxChars);
    }
    const remainingIssues = socratesOutputIssues(
      polished,
      { ...plan, maxChars: input.maxChars },
      allowedExperience,
    );
    if (remainingIssues.length) throw new Error(`socrates_output_rejected:${remainingIssues.join(',')}`);
    if (!polished) throw new Error('empty_socrates_generation');
    return { text: polished, modelUsed: true };
  } catch {
    return {
      text: finalizeSocratesReply(offlineSocratesReply(input, plan, story), plan, input.maxChars),
      modelUsed: false,
    };
  }
}

export async function generateSocratesHarnessReply(input: SocratesHarnessInput & {
  plan: SocratesTurnPlan;
  attitude: number;
  maxChars: number;
  cStrategy: boolean;
}): Promise<{ text: string; modelUsed: boolean; reflectionUsed?: boolean }> {
  return await generateSocratesReplyV2(input) as {
    text: string;
    modelUsed: boolean;
    reflectionUsed?: boolean;
  };
}

function advanceSocratesDialogueStateLegacy(
  previous: SocratesDialogueState | undefined,
  plan: SocratesTurnPlan,
  reply: string | null,
): SocratesDialogueState {
  const base = previous ?? { turnCount: 0, questionCooldown: 0, consecutiveQuestionTurns: 0 };
  const asked = Boolean(reply && /[？?]/.test(reply));
  const cooldown = plan.mode === 'meta'
    ? 3
    : Math.max(asked ? 1 : 0, Math.max(0, base.questionCooldown - 1));
  return {
    turnCount: base.turnCount + 1,
    questionCooldown: cooldown,
    consecutiveQuestionTurns: asked ? base.consecutiveQuestionTurns + 1 : 0,
    lastMode: plan.mode,
  };
}

export function advanceSocratesDialogueState(
  previous: SocratesDialogueState | undefined,
  plan: SocratesTurnPlan,
  reply: string | null,
): SocratesDialogueState {
  return advanceSocratesStateV2(previous, plan, reply) as SocratesDialogueState;
}

export const SOCRATES_RUNTIME_NOTE =
  '苏格拉底使用专属轻量 harness：现代钩子检索、多轮历史、场景话语动作、跨轮提问预算；旧 Python 与旧前端不进入运行时。';
