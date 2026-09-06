import type { InputPath } from './types';

export type SentenceMode = 'direct' | 'hua' | 'bridge';

const DIRECT_CLASSIC_ASK =
  /何谓|何为|是什么意思|何意|怎么理解|如何理解|是不是说|是否说|为何(?:必须|要|当)|为什么(?:必须|要)|何以(?:为|谓)/;

const PRIVATE_AFFAIRS =
  /(?:^|[，。！？])我|我的|自己|家人|父母|爸妈|我妈|我爸|亲人|朋友|好友|室友|同事|同学|恋人|伴侣|孩子|宠物|猫|狗|工作|上司|下属|考试|落榜|住院|病危|ICU|去世|分手|失恋|闹翻/;

/**
 * 选典后的可见成句形态。它不改变 path 或选典，只决定典与眼前事怎样说出来。
 */
export function resolveSentenceMode(params: {
  userInput: string;
  condensed?: string | null;
  path: InputPath;
  hasTension?: boolean | null;
  reinterpFit?: 'tight' | 'loose' | 'oppose_topic' | null;
  corpusBridge?: string | null;
  corpusBridgeSubjectOnly?: boolean | null;
}): SentenceMode {
  const text = `${params.userInput || ''}${params.condensed || ''}`;
  const privateAffair = PRIVATE_AFFAIRS.test(text);

  // ① 问的就是本条之题，且不是借题讲自己的私事。
  if (!privateAffair && DIRECT_CLASSIC_ASK.test(text)) return 'direct';

  // ② 私事与典义只差主语，或贴合已足，可直接化入眼前事。
  if (
    privateAffair &&
    (params.corpusBridgeSubjectOnly ||
      params.reinterpFit === 'tight' ||
      params.path === 'path1')
  ) {
    return 'hua';
  }

  // ③ 日常远事、无张力、贴合偏松，须把关系写清。
  if (
    params.path === 'path2' ||
    params.hasTension === false ||
    params.reinterpFit === 'loose' ||
    (params.corpusBridge && !params.corpusBridgeSubjectOnly)
  ) {
    return 'bridge';
  }

  return 'hua';
}

export function buildSentenceModeBlock(mode: SentenceMode, maxChars: number): string {
  if (mode === 'direct') {
    return `
【本轮·①直用】
- 用户问的就是本条之题：用 anchor 直接答本题，勿展览裁决 bridge，勿写成“用户一栏／典一栏”的对照表。
- 己言直接嵌字，不加引号；半文言一行，≤${maxChars}字。
`;
  }
  if (mode === 'hua') {
    return `
【本轮·②化用】
- 将 anchor 在原义上改主语、削枝或贴入眼前事；读完即在说用户之事，不另摆一段 bridge 讲解。
- 关系可轻接，不得写成“盖＋典名”的对照表；半文言一行，≤${maxChars}字。
`;
  }
  return `
【本轮·③写清桥】
- 用户事与典较远：用户侧极、典侧极、两边关系均须可读；关系写在接到典之前或同句接续处。
- 只写“盖＋典名”、只并置两极或把白话 bridge 抄进成句，皆算未写桥；口吻仍须像②化用，不像讲义表格。
- 半文言一行，≤${maxChars}字。
`;
}
