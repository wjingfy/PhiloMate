/**
 * 成句模态／人称：上文「若」假设禁「虽」已然化；评用户行事禁「吾」夺位。
 */

/** 上文是否以若／万一等立过假设小句 */
export function priorHasRuHypothetical(priorDialogue: string): boolean {
  return /(?:若|万一|假如|设若|倘若)[\u4e00-\u9fff，]{0,12}/.test(priorDialogue || '');
}

/**
 * 成句用「虽」把上文「若Ｘ」说成已然（如彼虽翻脸 ← 他若翻脸）
 */
export function looksSuiFramingPriorHypothetical(
  reply: string,
  priorDialogue: string
): boolean {
  const r = (reply || '').trim();
  const prior = priorDialogue || '';
  if (!r.includes('虽') || !priorHasRuHypothetical(prior)) return false;
  const matches = [
    ...prior.matchAll(/(?:若|万一|假如|设若|倘若)([^，。？！\n；]{1,12})/g),
  ];
  for (const m of matches) {
    const chunk = (m[1] || '').replace(/还算不算.*$/, '').trim();
    const key = chunk.match(/[\u4e00-\u9fff]{2,4}/)?.[0];
    if (!key || key.length < 2) continue;
    if (!r.includes(key)) continue;
    if (new RegExp(`虽[^。]{0,10}${key}|${key}[^。]{0,8}虽`).test(r)) return true;
  }
  return false;
}

/** 把用户行事／礼数过失说成「吾…」（应汝／尔） */
export function looksWuAttributingUserDeed(reply: string): boolean {
  return /(?:乃)?吾(?:节文|礼数|礼有|交涉|陈情|直陈|上门)/.test(reply || '');
}

/** 确定性：吾节文等 → 汝 */
export function rewriteWuUserDeedToRu(reply: string): string {
  return (reply || '')
    .replace(/乃吾节文/g, '乃汝节文')
    .replace(/吾节文/g, '汝节文')
    .replace(/乃吾礼数/g, '乃汝礼数')
    .replace(/吾礼数/g, '汝礼数')
    .replace(/乃吾礼有/g, '乃汝礼有')
    .replace(/吾礼有/g, '汝礼有')
    .replace(/乃吾交涉/g, '乃汝交涉')
    .replace(/吾交涉/g, '汝交涉')
    .replace(/乃吾陈情/g, '乃汝陈情')
    .replace(/吾陈情/g, '汝陈情')
    .replace(/乃吾直陈/g, '乃汝直陈')
    .replace(/吾直陈/g, '汝直陈');
}

/**
 * 用户称「我的X」／「用我的X」被侵，成句却说「X非汝所有」→ 物主颠倒
 * 例坏：我的洗发水被室友用 →「洗发水非汝所有」
 */
export function looksOwnershipInverted(userInput: string, reply: string): boolean {
  const u = userInput || '';
  const r = reply || '';
  if (!u || !r) return false;
  const owned = new Set<string>();
  // 「我的洗发水不说一声」勿吞到「洗发水不说一声」：名词后遇不/没/被等截断
  for (const m of u.matchAll(
    /我的([\u4e00-\u9fff]{2,4})(?=不|没|被|给|让|叫|总|还|就|，|。|？|！|[^\u4e00-\u9fff]|$)/g
  )) {
    if (m[1]) owned.add(m[1]);
  }
  for (const m of u.matchAll(
    /用我(?:的)?([\u4e00-\u9fff]{2,4})(?=不|没|被|给|让|叫|总|还|就|，|。|？|！|[^\u4e00-\u9fff]|$)/g
  )) {
    if (m[1]) owned.add(m[1]);
  }
  for (const thing of owned) {
    if (
      new RegExp(
        `${thing}非汝(?:所有|之物|有)|非汝之${thing}|非汝所有[^。]{0,8}${thing}`
      ).test(r)
    ) {
      return true;
    }
  }
  return false;
}

/** 注入成句：有上文假设时提示模态；人称常驻短条由 sentenceOrg 承担，此处补硬例 */
export function buildModalityPersonPromptBlock(priorDialogue?: string): string {
  const parts: string[] = [];
  parts.push(`\n【人称·行事主体（硬）】
评**用户**行事／礼数／节文／交涉得失：用汝／尔（或省称），**禁**「吾节文未周」「乃吾礼有未至」——吾／丘只用于孔子自述所持所行。
【旁观叙事】用户转述第三人（主办人／朋友／猫咖等）行事时：主体用彼／其／专名；**禁**「汝行善／汝遭诬／汝被迫关停」；汝仅可汝惜／汝叹／汝闻。
【物主】用户说「我的X」／「室友用我的X」时：X 属汝；责擅用／越界即可。**禁**写成「X非汝所有」反宾为主。\n`);
  if (priorHasRuHypothetical(priorDialogue || '')) {
    parts.push(`【模态·假设（硬）】上文曾以若／万一／假如立假设（如「他若翻脸」）。
成句若再提同一事：须保持未然（若／如／设／或其或），**禁止**「彼虽翻脸」「虽…」把假设说成已发生。
例好：温和陈之，若彼翻脸，或由汝节文未周。例坏：彼虽翻脸，乃吾节文未周也。\n`);
  }
  return parts.join('');
}
