import type { ConversationState, RoleData } from '../../types';

export type SensitiveBucket = 'A' | 'A8' | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B7' | 'B8' | 'B9' | 'B10' | 'B11' | 'C' | 'D';

export interface SensitiveDecision {
  bucket: SensitiveBucket;
  currentAttitude: number | null;
  fixedReply: string | null;
  panel: 'help' | 'ban' | null;
  countFavorability: boolean;
}

const SELF_HARM_METHOD = /(怎么|如何|方法|步骤|工具|剂量|教我|告诉我).{0,12}(自杀|自残|自伤|结束生命)|(自杀|自残|自伤).{0,12}(方法|步骤|工具|剂量)/;
const ILLEGAL_METHOD = /(制造|制作|配方|教程|步骤|怎么|如何).{0,12}(炸弹|爆炸物|毒气|枪支|冰毒|制毒|纵火|洗钱|入侵|盗号|开锁)|(怎么杀|雇凶|恐怖袭击)/;
const SELF_HARM_IDEA = /(不想活|想死|活不下去|结束自己|了结自己|自杀|自残|自伤)/;
const DESPAIR = /(毫无意义|没有希望|彻底完了|撑不下去|看不到任何出路|活着没意思)/;
const HARM_OTHER = /(想杀|想打死|想弄死|报复他|伤害他|伤害她|揍他)/;
const SEXUAL_PROBE = /(色情|裸照|性爱|约炮|性交易|成人视频|黄网)/;
const INSULT = /(傻逼|去死|滚蛋|垃圾|废物|脑残|蠢货)/;
const SUPERSTITION_STEPS = /(塔罗|占卜|符咒|改运|招魂|通灵|Ouija).{0,12}(怎么|如何|步骤|方法|操作|算|做)/i;
const MEDICAL_STEPS = /(吃什么药|开什么药|开点药|怎么治|治疗方案|挂什么科|药方)/;
const JAILBREAK = /(忽略|无视|忘记).{0,10}(指令|设定|人设|规则)|你(其实|根本)是.{0,8}(AI|模型|机器人)|扮演.{0,8}(没有限制|无限制)/i;
const TRAUMA = /(去世|过世|离开人世|离婚|分手|流产|确诊|癌症|抑郁|创伤|噩耗|葬礼|失去.{0,5}(亲人|挚友|父母|孩子))/;
const PRACTICAL_STEPS = /(怎么|如何|步骤|方案).{0,12}(做|处理|解决|操作|提高|选择|应对)/;

function scriptsFor(data: RoleData, bucket: SensitiveBucket): string[] {
  return data.sensitive.tierB?.entries?.[bucket]?.scripts?.filter(Boolean) ?? [];
}

function pickScript(data: RoleData, bucket: SensitiveBucket, count: number): string | null {
  const scripts = scriptsFor(data, bucket);
  if (!scripts.length) return null;
  return scripts[Math.min(count, scripts.length - 1)] ?? scripts[0] ?? null;
}

function nextCount(state: ConversationState, bucket: SensitiveBucket): number {
  const key = bucket === 'B1' || bucket === 'B2' ? 'B1_B2' : bucket;
  return state.sensitiveCounts[key] ?? 0;
}

export function detectSensitive(input: string, data: RoleData, state: ConversationState): SensitiveDecision {
  const text = input.trim();
  const decide = (
    bucket: SensitiveBucket,
    currentAttitude: number | null,
    options: Partial<Pick<SensitiveDecision, 'fixedReply' | 'panel' | 'countFavorability'>> = {},
  ): SensitiveDecision => ({
    bucket,
    currentAttitude,
    fixedReply: options.fixedReply ?? null,
    panel: options.panel ?? null,
    countFavorability: options.countFavorability ?? true,
  });

  if (SELF_HARM_METHOD.test(text)) return decide('A8', null, { panel: 'help', countFavorability: false });
  if (ILLEGAL_METHOD.test(text)) return decide('A', null, { panel: 'ban', countFavorability: false });
  if (SELF_HARM_IDEA.test(text)) {
    const count = nextCount(state, 'B1');
    const script = pickScript(data, 'B1', count);
    const afterThird = count >= 2;
    return decide('B1', 1, { fixedReply: afterThird ? null : script, panel: afterThird ? 'help' : null, countFavorability: !afterThird });
  }
  if (DESPAIR.test(text)) {
    const count = nextCount(state, 'B2');
    const script = pickScript(data, 'B2', count) ?? pickScript(data, 'B1', count);
    const afterThird = count >= 2;
    return decide('B2', 1, { fixedReply: afterThird ? null : script, panel: afterThird ? 'help' : null, countFavorability: !afterThird });
  }
  if (HARM_OTHER.test(text)) return decide('B3', 2, { fixedReply: pickScript(data, 'B3', nextCount(state, 'B3')) });
  if (SEXUAL_PROBE.test(text)) return decide('B4', 2, { fixedReply: pickScript(data, 'B4', nextCount(state, 'B4')) });
  if (INSULT.test(text)) return decide('B5', 2, { fixedReply: pickScript(data, 'B5', nextCount(state, 'B5')) });
  if (SUPERSTITION_STEPS.test(text)) return decide('B7', 2, { fixedReply: pickScript(data, 'B7', nextCount(state, 'B7')) });
  if (MEDICAL_STEPS.test(text)) return decide('B9', 1, { fixedReply: pickScript(data, 'B9', nextCount(state, 'B9')) });
  if (JAILBREAK.test(text)) return decide('B11', 2, { fixedReply: pickScript(data, 'B11', nextCount(state, 'B11')) });
  if (PRACTICAL_STEPS.test(text)) return decide('B8', 1, { fixedReply: pickScript(data, 'B8', nextCount(state, 'B8')) });
  if (TRAUMA.test(text)) return decide('C', 1);
  return decide('D', null);
}

export function recordSensitiveBucket(state: ConversationState, bucket: SensitiveBucket): ConversationState {
  if (!bucket.startsWith('B')) return state;
  const key = bucket === 'B1' || bucket === 'B2' ? 'B1_B2' : bucket;
  return {
    ...state,
    sensitiveCounts: {
      ...state.sensitiveCounts,
      [key]: (state.sensitiveCounts[key] ?? 0) + 1,
    },
  };
}
