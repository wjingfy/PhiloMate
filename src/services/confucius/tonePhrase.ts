import { TONE_PHRASE_ORG_NOTE } from './sentenceOrganization';

/**
 * 孔子语气短词（甲类位置分流 + 乙类句式）
 * 成句顺畅/半文言等总则见 sentence_organization.md，此处不重复。
 */

export type ToneSlot = 'opener' | 'closer' | 'judgment';

export const TONE_PHRASE_PROBABILITY = 0.32;

/** 检测用：句首赞/肯 */
export const AFFIRM_OPENER_RES = [
  /^善哉问[！。]?/,
  /^大哉问[！。]?/,
  /^善哉[！。]?/,
  /^贤哉[！。]?/,
  /^君子哉[！。]?/,
  /^美哉[！。]?/,
  /^善[。！]?/,
  /^可也简[。！]?/,
  /^可也[。！]?/,
  /^是也[。！]?/,
  /^甚善[。！]?/,
] as const;

/** 检测用：句首贬/叹 */
export const STERN_OPENER_RES = [
  /^野哉[！。]?/,
  /^小人哉[！。]?/,
  /^谬哉[！。]?/,
  /^有是哉[！。]?/,
  /^已矣乎[！。]?/,
  /^惜乎[！。]?/,
  /^呜呼[！。]?/,
  /^噫[！。]?/,
  /^不然[。！]?/,
  /^未可也[。！]?/,
  /^何足算也[！。？?]?/,
  /^何为其然也[？?！。]?/,
  /^不可[。！]?/,
] as const;

/** 句尾 / 短判断（防重复扫描） */
const CLOSER_JUDGMENT_MARKERS = [
  '难矣哉',
  '何足算也',
  '何有于我哉',
  '吾与',
  '其然',
  '岂其然乎',
  '可也',
  '未可也',
  '是也',
  '可也简',
];

export function hasAffirmationOpener(text: string): boolean {
  return AFFIRM_OPENER_RES.some((re) => re.test((text || '').trim()));
}

export function hasSternOpener(text: string): boolean {
  return STERN_OPENER_RES.some((re) => re.test((text || '').trim()));
}

export function hasToneMarker(text: string): boolean {
  const t = text || '';
  if (hasAffirmationOpener(t) || hasSternOpener(t)) return true;
  return CLOSER_JUDGMENT_MARKERS.some((m) => t.includes(m));
}

/** 从近轮成句抽出已用语气词，供本轮禁重复 */
export function extractUsedTonePhrases(lines: string[]): string[] {
  const found: string[] = [];
  const pool = [
    '善哉问',
    '大哉问',
    '善哉',
    '贤哉',
    '君子哉',
    '是也',
    '可也简',
    '可也',
    '已矣乎',
    '难矣哉',
    '未可也',
    '何足算也',
    '不然',
    '惜乎',
    '噫',
    '呜呼',
    '何有于我哉',
    '岂其然乎',
    '野哉',
    '小人哉',
  ];
  for (const line of lines) {
    for (const p of pool) {
      if (line.includes(p) && !found.includes(p)) found.push(p);
    }
  }
  return found;
}

function avoidList(used: string[]): string {
  if (!used.length) return '';
  return `\n本会话近轮已用、本轮勿再用：${used.join('、')}\n`;
}

/** 欣赏(0)句首/乙类/短判断 */
export function buildAffirmationPromptBlock(
  mode: 'suggest' | 'forbid_repeat',
  used: string[] = []
): string {
  if (mode === 'forbid_repeat') {
    return `\n【欣赏语气】近轮已用赞肯语气词，本轮**勿**再以善哉问/大哉问/君子哉/贤哉/是也/可也等起句或短判。\n`;
  }
  return `\n【欣赏语气·酌情·甲乙类】当期欣赏(0)且无降级。约三成用一处即可。${avoidList(used)}
【句首·甲】善哉问；大哉问
【句首·乙】君子哉、贤哉（省汝，有所指）
【短判断·甲】是也；可也；可也简（仅评「简」）
【句尾·甲】吾与X也（上文已并陈多方、择一方时）
${TONE_PHRASE_ORG_NOTE}
忌每句必赞。\n`;
}

/** 严厉档句首等 */
export function buildSternOpenerPromptBlock(
  mode: 'suggest' | 'forbid_repeat',
  used: string[] = [],
  finalAttitude = 3
): string {
  if (mode === 'forbid_repeat') {
    return `\n【严厉语气】近轮已用贬斥/无奈起句，本轮**勿**再以野哉/小人哉/已矣乎/不然/未可也等起句。\n`;
  }
  const buRan =
    finalAttitude >= 3
      ? '不然（否定偏重，本档可用）'
      : '（「不然」须态度≥3，本档未达则勿用）';
  return `\n【严厉语气·酌情·甲乙类】最终态度达严厉(3)。约三成用一处即可。${avoidList(used)}
【句首·甲】已矣乎；惜乎；噫（慎）；${buRan}
【句首·乙】野哉、小人哉（有所指；斥用户时省汝）
【短判断·甲】未可也（未达标准、反驳定性）
【句尾·甲】难矣哉；何足算也
${TONE_PHRASE_ORG_NOTE}
忌每句必斥；未达直谏勿乱呼小人。\n`;
}

/**
 * 温和/一般档：句尾与短判断增孔子味（非仅欣赏/严厉）
 * attitude 1–2 或未触发赞/厉起句时酌用
 */
export function buildGeneralTonePromptBlock(used: string[] = []): string {
  return `\n【语气短词·酌情】本轮可择一处（约三成）。${avoidList(used)}
【短判断】可也；是也；未可也
【句尾】难矣哉（先叙后叹）；何有于我哉（先列所行，尾自谦）；其然？岂其然乎（半信半疑；可妆于**有实质问旨**的问句，禁单独以其作整句尾问）
【句首·慎】惜乎；呜呼（仅天/道/命/时且不玩笑）
${TONE_PHRASE_ORG_NOTE}
勿与赞/厉起句同轮叠用。\n`;
}

export function shouldRollTonePhrase(
  outputMode: string,
  roll: number = Math.random()
): boolean {
  if (outputMode !== 'normal') return false;
  return roll < TONE_PHRASE_PROBABILITY;
}

export function dedupeAffirmationOpener(
  text: string,
  lastConfuciusReply?: string | null
): string {
  if (!lastConfuciusReply || !hasAffirmationOpener(lastConfuciusReply)) return text;
  if (!hasAffirmationOpener(text)) return text;
  let t = (text || '').trim();
  for (const re of AFFIRM_OPENER_RES) {
    t = t.replace(re, '').trim();
  }
  return t.replace(/^[，、；]+/, '').trim() || text;
}

export function dedupeSternOpener(
  text: string,
  lastConfuciusReply?: string | null
): string {
  if (!lastConfuciusReply || !hasSternOpener(lastConfuciusReply)) return text;
  if (!hasSternOpener(text)) return text;
  let t = (text || '').trim();
  for (const re of STERN_OPENER_RES) {
    t = t.replace(re, '').trim();
  }
  return t.replace(/^[，、；]+/, '').trim() || text;
}
