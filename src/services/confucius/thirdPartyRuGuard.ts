/**
 * 旁观／转述：第三人行事禁误作汝（成句人称）。
 */

/** 成句把第三人行事写成汝／女／尔＋行善／遭诬等 */
const THIRD_PARTY_DEED_AS_RU =
  /(?:汝|女|尔)(?:之)?(?:行善|遭诬|遭谤|被迫|关停|收钱|被诬|被谤)/;

/** 用户明确自称那件事的行事主体 → 不当旁观 */
function looksSelfAsDeedAgent(userInput: string): boolean {
  return /我(?:自己)?(?:办的|开的|做的|经营|负责|行善|遭诬|遭谤|被迫关停)|是我(?:的)?(?:店|馆|咖|公司)|我被迫|我遭(?:诬|谤)|我行善/.test(
    userInput || ''
  );
}

/**
 * 用户输入像旁观／转述第三人行事（我认识的、主办人、朋友、猫咖…）
 * 且非「我自己做了那事」。
 */
export function looksThirdPartyNarrative(userInput: string): boolean {
  const u = (userInput || '').trim();
  if (!u || looksSelfAsDeedAgent(u)) return false;
  return /我认识的|认识一个|主办人|朋友[的了]|同事[的了]|有个|有人|某人|那边|猫咖/.test(
    u
  );
}

/** 旁观叙事下，成句仍用汝＋行事动词把第三人的事派给用户 */
export function looksThirdPartyDeedAsRu(
  userInput: string,
  reply: string
): boolean {
  if (!looksThirdPartyNarrative(userInput)) return false;
  return THIRD_PARTY_DEED_AS_RU.test(reply || '');
}

/**
 * 明确模式确定性改写：汝行善→彼行善 等。
 * 旁观立场（汝惜／汝叹／汝闻／汝伤）不在此列，原样保留。
 */
export function rewriteThirdPartyRuDeedToBi(reply: string): string {
  return (reply || '')
    .replace(/(?:汝|女|尔)之行善/g, '彼行善')
    .replace(/(?:汝|女|尔)行善/g, '彼行善')
    .replace(/(?:汝|女|尔)之遭诬/g, '彼遭诬')
    .replace(/(?:汝|女|尔)遭诬/g, '彼遭诬')
    .replace(/(?:汝|女|尔)之遭谤/g, '彼遭谤')
    .replace(/(?:汝|女|尔)遭谤/g, '彼遭谤')
    .replace(/(?:汝|女|尔)之被迫/g, '彼被迫')
    .replace(/(?:汝|女|尔)被迫/g, '彼被迫')
    .replace(/(?:汝|女|尔)之关停/g, '彼关停')
    .replace(/(?:汝|女|尔)关停/g, '彼关停')
    .replace(/(?:汝|女|尔)之收钱/g, '彼收钱')
    .replace(/(?:汝|女|尔)收钱/g, '彼收钱')
    .replace(/(?:汝|女|尔)之被诬/g, '彼被诬')
    .replace(/(?:汝|女|尔)被诬/g, '彼被诬')
    .replace(/(?:汝|女|尔)之被谤/g, '彼被谤')
    .replace(/(?:汝|女|尔)被谤/g, '彼被谤');
}
