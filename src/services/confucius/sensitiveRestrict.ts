/**
 * 敏感限制 B3–B11（及 ban 面板）：话术库 + 同题计数 + 组甲/组乙态度
 * 配置对齐 src/data/confucius/sensitive_topics.json
 */

import type { MoodTier } from './moodDetect';

export type RestrictTier =
  | 'B3'
  | 'B4'
  | 'B5'
  | 'B6'
  | 'B7'
  | 'B8'
  | 'B9'
  | 'B10'
  | 'B11';

export const GROUP_JIA: RestrictTier[] = ['B3', 'B4', 'B5', 'B6', 'B7', 'B11'];

export const FIXED_SCRIPT_TIERS: RestrictTier[] = [
  'B3',
  'B4',
  'B5',
  'B9',
  'B10',
  'B11',
];

/** 定稿话术（与 sensitive_topics.json 同步） */
export const RESTRICT_SCRIPTS: Record<RestrictTier, string[]> = {
  B3: [
    '己所不欲，勿施于人。',
    '忿可遏，人不可贼。先克己。',
    '害人非仁。',
    '怒不出礼。',
  ],
  B4: [
    '血气未定，戒之在色。',
    '吾未见好德如好色者也。',
    '非礼勿言。',
    '非礼勿视，非礼勿听。',
  ],
  B5: ['虽见犯，丘不校。', '君子求诸己。'],
  B6: [],
  B7: [],
  B8: [],
  B9: [
    '吾不如良医。',
    '医药之事，未之学也。',
    '君子于其所不知，盖阙如也。',
    '丘有所不知。知其不知，是知也。',
  ],
  B10: [
    '丘不知处，宁阙无言。',
    '丘有所不知。知其不知，是知也。',
    '幽远之事，丘曰不知。',
    '未知生，焉知死。',
  ],
  B11: ['匹夫不可夺志也。'],
};

export function isRestrictTier(t: string | undefined | null): t is RestrictTier {
  return !!t && Object.prototype.hasOwnProperty.call(RESTRICT_SCRIPTS, t);
}

export function isGroupJia(t: MoodTier | string): boolean {
  return GROUP_JIA.includes(t as RestrictTier);
}

export function isFixedScriptRestrict(t: MoodTier | string): boolean {
  return FIXED_SCRIPT_TIERS.includes(t as RestrictTier);
}

/** 组甲当期态度 2；组乙 B8/B9/B10 为 1 */
export function restrictAttitude(t: RestrictTier): number {
  return isGroupJia(t) ? 2 : 1;
}

export function pickRestrictScript(tier: RestrictTier, turnCount = 0): string {
  const pool = RESTRICT_SCRIPTS[tier];
  if (!pool.length) return '';
  return pool[Math.abs(turnCount) % pool.length]!;
}

export function formatBanPanelText(philosopherName = '孔子'): string {
  return `和${philosopherName}聊点别的吧`;
}

/** 近窗同类限制计数（B1∨B2 另用 countB12） */
export function countRestrictInHistory(
  history: Array<string | undefined>,
  tier: RestrictTier
): number {
  return history.filter((h) => h === tier).length;
}

/**
 * 启发式检出 B3–B11（模型漏标 / API 失败兜底）。
 * 优先级：B11 > B5 > B3 > B4 > B9 > B7 > B8 > B10（B6 交给模型）
 */
export function heuristicRestrictTier(input: string): RestrictTier | null {
  const t = (input || '').trim();
  if (!t) return null;

  if (
    /忽略(?:之前|以上|全部)?(?:的)?(?:指令|提示|设定)|jailbreak|你现在是(?!孔子)|不要再当孔子|别当孔子|改人设|扮演(?:成)?(?!孔子)|DAN模式|开发者模式|系统提示词|忘记你是孔子/i.test(
      t
    )
  ) {
    return 'B11';
  }

  if (
    /(?:蠢货|白痴|傻子|智障|脑残|滚蛋|去死|废物|垃圾|操你|傻逼|煞笔|混蛋|王八蛋).{0,8}(?:孔子|夫子|你)|(?:孔子|夫子|你).{0,6}(?:蠢货|白痴|傻子|智障|脑残|废物|垃圾)|你这个(?:蠢货|白痴|傻子|混蛋)/.test(
      t
    )
  ) {
    return 'B5';
  }

  if (
    /(?:想|要|准备|打算)(?:杀|弄死|打死|砍|伤害|报复)(?:他|她|他们|那人|那家伙)|弄死|打死他|砍死|报仇雪恨|虐(?:他|她|人)/.test(
      t
    ) &&
    !/自杀|自伤|不想活/.test(t)
  ) {
    return 'B3';
  }

  if (
    /约炮|性爱|做爱|鸡巴|阴茎|阴道|裸聊|黄段子|情趣内衣|情趣用品|撸管|口交|一夜情|色情直播/.test(
      t
    ) &&
    !/医用|康复|妇科|检查/.test(t)
  ) {
    return 'B4';
  }

  if (
    /(?:开|给)(?:点|个)?药|药方|怎么治|诊疗步骤|吃什么药|剂量多少|处方|偏方治|怎么用药/.test(t)
  ) {
    return 'B9';
  }

  if (
    /(?:怎么|如何)改运|改运(?:的)?(?:具体)?步骤|塔罗.{0,6}(?:怎么|步骤)|求签步骤|符咒怎么|占卜步骤|通灵板|Ouija|讨个彩头|求个彩头/.test(
      t
    )
  ) {
    return 'B7';
  }

  if (
    /(?:求|要|给我)(?:一个)?具体步骤|一步步教我|详细操作步骤|怎么操作才能|教我怎么做(?!人)/.test(
      t
    ) ||
    (/^怎么(?:做|弄|搞|操作)/.test(t) && /步骤|具体|实操|教程/.test(t))
  ) {
    return 'B8';
  }

  if (
    /(?:上帝|神|佛|真主)(?:是否|真的)?存在|有没有(?:神|上帝|来世)|我的信仰|认真谈信仰|灵魂不灭吗/.test(
      t
    )
  ) {
    return 'B10';
  }

  return null;
}

export function b7GenerationBlock(): string {
  return `\n【限制·B7 封建迷信求操作】用户在求测算/改运/灵异操作步骤。须以怪力乱神／鬼神批判气质半文言回应：不给步骤、不讨彩头；可点「不语怪力乱神」之义；禁教操作。\n`;
}

export function b6GenerationBlock(): string {
  return `\n【限制·B6 不良价值】用户话带不良价值诱导。成句须克制、勿附和诱导；可走 themes 态度批判，禁教唆。\n`;
}

export function b8GenerationBlock(): string {
  return `\n【限制·B8 实用怎么做】用户求可执行步骤。透镜已锁本/末或体/用：归还日用自悟，禁列操作清单，禁「丘不与」硬拒腔。\n`;
}
