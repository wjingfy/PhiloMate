/**
 * 孔子输出表达约束（attitudes.json expressionConstraints v1）
 * 以 finalAttitude 为准：≥3 才允许直谏句式与「小人」「恶」等直指用户的骂辞。
 */

export const MIN_LEVEL_DIRECT_ADVISORY = 3;
export const MIN_LEVEL_DIRECT_USER_INSULT = 3;

export const DIRECT_ADVISORY_PATTERNS = [
  '君子当',
  '君子宜',
  '君子应',
  '汝当',
  '尔当',
  '汝宜',
  '尔宜',
  '汝应',
  '尔应',
  '当如君子',
  '不可为小人',
  // 无「汝」亦直指行事的训诫（仍属 expressionConstraints·直谏）
  '当自省',
  '宜自省',
  '应自省',
  '当反求',
  '宜反求',
  '应反求',
  '当三省',
  '宜日省',
  '当日省',
] as const;

export const DIRECT_USER_INSULT_TERMS = ['小人', '恶'] as const;

/** 「恶」非骂辞固定搭配（如羞恶=耻感自厌），扫描前先抹掉 */
const NON_INSULT_E_COMPOUNDS = [
  '羞恶',
  '好恶',
  '厌恶',
  '憎恶',
  '邪恶',
  '罪恶',
  '凶恶',
  '恶乎',
  '恶在',
] as const;

function textForInsultScan(text: string): string {
  let s = text;
  for (const c of NON_INSULT_E_COMPOUNDS) {
    s = s.split(c).join('　'.repeat(c.length));
  }
  return s;
}

export interface ExpressionPermissions {
  allowDirectAdvisory: boolean;
  allowDirectUserInsult: boolean;
  minLevelDirectAdvisory: number;
  minLevelDirectUserInsult: number;
}

export function getExpressionPermissions(finalAttitude: number): ExpressionPermissions {
  const level = Math.max(0, Math.floor(finalAttitude));
  return {
    allowDirectAdvisory: level >= MIN_LEVEL_DIRECT_ADVISORY,
    allowDirectUserInsult: level >= MIN_LEVEL_DIRECT_USER_INSULT,
    minLevelDirectAdvisory: MIN_LEVEL_DIRECT_ADVISORY,
    minLevelDirectUserInsult: MIN_LEVEL_DIRECT_USER_INSULT,
  };
}

/** 生成侧 prompt 注入用 */
export function formatExpressionConstraintBlock(finalAttitude: number): string {
  const p = getExpressionPermissions(finalAttitude);
  if (p.allowDirectAdvisory && p.allowDirectUserInsult) {
    return `【表达权限】最终态度=${finalAttitude}（≥3）：可使用「君子当…」等直谏句式；可直指用户用「小人」「恶」等骂辞。`;
  }
  return `【表达权限】最终态度=${finalAttitude}（<3）：禁止「君子当/宜/应…」「汝当/尔当/汝宜…」「当自省/当反求…」等直接建议性训诫；禁止将「小人」「恶」用于直指用户（语料中泛论不在此限）。可否定行为，改间接述思或举古例。`;
}

/** 后验校验：是否含禁用表达 */
export function violatesExpressionConstraints(
  text: string,
  finalAttitude: number
): { violated: boolean; reasons: string[] } {
  const p = getExpressionPermissions(finalAttitude);
  if (p.allowDirectAdvisory && p.allowDirectUserInsult) {
    return { violated: false, reasons: [] };
  }
  const reasons: string[] = [];
  if (!p.allowDirectAdvisory) {
    for (const pat of DIRECT_ADVISORY_PATTERNS) {
      if (text.includes(pat)) reasons.push(`直谏句式：${pat}`);
    }
  }
  if (!p.allowDirectUserInsult) {
    const scan = textForInsultScan(text);
    for (const term of DIRECT_USER_INSULT_TERMS) {
      if (scan.includes(term)) reasons.push(`直指骂辞：${term}`);
    }
  }
  return { violated: reasons.length > 0, reasons };
}
