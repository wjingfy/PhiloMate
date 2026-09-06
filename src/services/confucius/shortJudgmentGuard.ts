/**
 * 句首／短判断前缀：只许来自既有机制；未授权则禁自行附加。
 *
 * 既有白名单机制（见 sentence_organization.md）：
 * - §六 语气短词：欣赏／严厉／一般档（tonePhrase 注入块）
 * - §六丙 是否问短断（yesNoAnswer）
 * - 误读认池（glossRepair：是也／汝之言然／可也…）
 */

/** 与既有池对齐的句首短断探测（未授权时禁） */
const FREE_PREFIX_RE =
  /^(?:是也|然|非也|未可也|未也|可也简|可也|善哉问|大哉问|善哉|贤哉|君子哉|美哉|甚善|善|野哉|小人哉|谬哉|有是哉|已矣乎|惜乎|呜呼|噫|不然|汝之言然)(?:[。，！]|$)/;

export function looksUnauthorizedShortJudgment(
  reply: string,
  authorized: boolean
): boolean {
  if (authorized) return false;
  return FREE_PREFIX_RE.test((reply || '').trim());
}

/** 剥未授权句首短断；剥后若空则原样返回 */
export function stripUnauthorizedShortJudgment(reply: string): string {
  const t = (reply || '').trim();
  if (!FREE_PREFIX_RE.test(t)) return t;
  const next = t.replace(FREE_PREFIX_RE, '').replace(/^[，、；\s]+/, '').trim();
  return next || t;
}

/**
 * 本轮是否由既有机制授权使用句首／短判断前缀。
 * 授权来源仅限：是否问、欣赏块 suggest、严厉块 suggest、一般语气块、误读认池。
 */
export function isShortJudgmentAuthorized(params: {
  yesNoQuestion: boolean;
  suggestAffirmation: boolean;
  suggestStern: boolean;
  hasGeneralToneBlock: boolean;
  hasGlossRepair: boolean;
}): boolean {
  return (
    params.yesNoQuestion ||
    params.suggestAffirmation ||
    params.suggestStern ||
    params.hasGeneralToneBlock ||
    params.hasGlossRepair
  );
}

export function buildNoFreeShortJudgmentPromptBlock(authorized: boolean): string {
  if (authorized) {
    return `\n【句首／短判断前缀】本轮已由既有机制授权（是否问短断 §六丙 软可选，或语气短词 §六 欣赏／严厉／一般，或误读认池）。只按**本轮已注入的那一块**选用，勿叠床架屋另加前缀。是否问轮：**可酌情**用然／非也，非必须。\n`;
  }
  return `\n【句首／短判断前缀·禁自行附加（硬）】
既有规定里，句首／短判断**只**来自：
- §六 语气短词（欣赏／严厉／一般，约三成、须本轮注入对应块）
- §六丙 是否问短断（软：请裁属否时可酌情，非强制）
- 误读认池（是也／汝之言然／可也等）
本轮**未**注入上述任一机制 → 成句**禁止**自行加：是也／然／非也／可也／善哉／未可也／惜乎／不然 等。
选择问（A还是B）尤其禁「是也」起句；直接嵌典析理。\n`;
}
