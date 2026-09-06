/**
 * 「是否／是不是／算不算」类**理论判断**：成句可酌情用论语式短答，**非硬强制**。
 * 仅覆盖归类／对错／应然／属否等判断；不含愿不愿、敢不敢、要不要等意向／能力／邀约。
 * 短答池取自论语用例（非自造白话是/否）。
 */

/**
 * 理论判断类 A/B 问关键词（须命中其一才注入软提示；单凭句末「吗／否」不够）
 * 留：是否／是不是／算不算／该不该／对不对／属不属／当不当／岂非…
 * 不留：愿不愿／敢不敢／要不要／能不能／可不可以／有没有／好不好／行不行／需不需要／可否／能否
 * 会不会：仅「会不会觉得／算／是…」等判断谓，不含会不会来／去
 */
const YES_NO_JUDGMENT_KEYWORD_RE =
  /是否|是不是|算不算|算不算是|该不该|应不应该|应否|对不对|属不属|当不当|岂非|岂不|会不会(?:觉得|以为|算|是|属于|等于|合|失|过|太|过于)/;

/** 意向／能力／邀约等：即使带是否类词，也不注入是否问块 */
const YES_NO_NON_JUDGMENT_RE =
  /愿不愿|敢不敢|要不要|能不能|可不可以|可不可|有没有|好不好|行不行|需不需要|可否|能否|去不去|来不来/;

/**
 * 反问／铺垫：形似「是否」实非请裁属否（如「是否也考虑过Ｘ」）
 * → 不注入是否问块、不授权短断
 */
const YES_NO_RHETORICAL_RE =
  /是否也(?:考虑|想过|想到|意识到|留意|注意|晓得|知道)|是否想过|是否意识到|是否注意到|有没有想过|可曾想过|可曾考虑/;

/**
 * 主句未明断是／否：视情况、因时因事、适度／执中、未可一概等
 * → 若已误加短断可剥掉（软收束，不补前缀）
 */
const SITUATIONAL_OR_MODERATE_RE =
  /视情况|看情况|视情形|视其情|视情|视境|因时|因事|因人|具体(?:情况|情形|而定)|未可一概|不可一概|难以一概|未可遽|不可遽断|当视|须视|分殊|两端|权衡|斟酌|过犹不及|适度|执中|中庸|中道|得中|相机|量力|情形不同|事不同|时不同|未可执一|不可执一|通权|权变|未可定断|难以遽定|未可遽定/;

/**
 * 是否问探测（软）：请裁属否／对错／应然时为 true，仅用于注入「可酌情短断」提示。
 * **不**单凭「…吗？」「…否？」；反问铺垫（是否也考虑过…）为 false。
 */
export function isYesNoStyleQuestion(input: string): boolean {
  const t = (input || '').trim();
  if (!t) return false;
  if (YES_NO_NON_JUDGMENT_RE.test(t)) return false;
  if (YES_NO_RHETORICAL_RE.test(t)) return false;
  return YES_NO_JUDGMENT_KEYWORD_RE.test(t);
}

/**
 * 主句是否「视情况／适度」类未定断（此类勿硬套然／非也）
 */
export function isSituationalOrModerateMain(replyOrBody: string): boolean {
  const stripped = stripYesNoShortPrefix(replyOrBody);
  const t = (stripped.body || replyOrBody || '').trim();
  if (!t) return false;
  return SITUATIONAL_OR_MODERATE_RE.test(t);
}

/**
 * 成句是否已带论语式短断（句首或首逗号前）
 * 是：然／是也／可也
 * 否：非也／未可也／未也；亦认「非矫情也」类否谓短断
 */
export function hasYesNoShortAnswer(reply: string): boolean {
  return stripYesNoShortPrefix(reply).polarity != null;
}

export type YesNoPolarity = 'yes' | 'no';
/** 主句立场：明断是／否，或视情况／适度（勿短断） */
export type YesNoStance = YesNoPolarity | 'situational';

/** 剥句首论语式短断，露出主句 */
export function stripYesNoShortPrefix(reply: string): {
  polarity: YesNoPolarity | null;
  body: string;
  prefix: string;
} {
  const t = (reply || '').trim();
  if (!t) return { polarity: null, body: '', prefix: '' };

  let m = t.match(/^(然|是也|可也|非也|未可也|未也)([。，])([\s\S]*)$/);
  if (m) {
    const token = m[1]!;
    const polarity: YesNoPolarity =
      token === '非也' || token === '未可也' || token === '未也' ? 'no' : 'yes';
    return { polarity, body: (m[3] || '').trim(), prefix: token + m[2] };
  }
  if (/^然，/.test(t)) {
    return { polarity: 'yes', body: t.slice(2).trim(), prefix: '然，' };
  }
  if (/^可也，/.test(t)) {
    return { polarity: 'yes', body: t.slice(3).trim(), prefix: '可也，' };
  }
  m = t.match(/^(?:[\u4e00-\u9fff]{1,8}之言)?(是也)([。，])([\s\S]*)$/);
  if (m) {
    return {
      polarity: 'yes',
      body: (m[3] || '').trim(),
      prefix: t.slice(0, t.length - (m[3] || '').length),
    };
  }
  m = t.match(/^(非[\u4e00-\u9fff]{1,8}也)([。，])([\s\S]*)$/);
  if (m) {
    return { polarity: 'no', body: (m[3] || '').trim(), prefix: m[1]! + m[2]! };
  }
  m = t.match(/^(未[\u4e00-\u9fff]{1,8}也)([。，])([\s\S]*)$/);
  if (m) {
    return { polarity: 'no', body: (m[3] || '').trim(), prefix: m[1]! + m[2]! };
  }
  return { polarity: null, body: t, prefix: '' };
}

/**
 * 从**主句**判立场：situational（勿短断）／yes／no。
 */
export function inferYesNoStance(replyOrBody: string): YesNoStance {
  const stripped = stripYesNoShortPrefix(replyOrBody);
  const t = (stripped.body || replyOrBody || '').trim();
  if (!t) return 'yes';

  if (SITUATIONAL_OR_MODERATE_RE.test(t)) return 'situational';

  if (
    /非纵|不隐|勿隐|未可隐|不可隐|不当隐|非护短|非无条件|隐乃有界|隐有界|公心裁|非盲从|非徇|则过|失中|过矣|废|不宜|不当|未可|不可|非也/.test(
      t
    )
  ) {
    return 'no';
  }
  if (/^(?:非|未|勿|无|莫)/.test(t)) return 'no';
  if (/非[\u4e00-\u9fff]{1,8}之正/.test(t.slice(0, 48))) return 'no';

  if (/^(?:然|是|可)/.test(t)) return 'yes';
  if (/正合|乃可|亦此理|正属|固当|宜然|是也/.test(t.slice(0, 48))) return 'yes';
  return 'yes';
}

/** @deprecated 用 inferYesNoStance；保留兼容 */
export function inferYesNoPolarity(replyOrBody: string): YesNoPolarity {
  const s = inferYesNoStance(replyOrBody);
  return s === 'no' ? 'no' : 'yes';
}

/**
 * 软收束：仅当主句为视情况／适度且误加了短断时剥掉；**不**补然／非也。
 */
export function alignYesNoShortAnswer(reply: string): { text: string; changed: boolean } {
  const t = (reply || '').trim();
  if (!t) return { text: t, changed: false };
  if (!isSituationalOrModerateMain(t)) return { text: t, changed: false };

  const { polarity, body } = stripYesNoShortPrefix(t);
  if (polarity == null) return { text: t, changed: false };
  const rest = body.replace(/^[。，、；\s]+/, '');
  return { text: rest, changed: true };
}

/**
 * @deprecated 硬短断时代的前缀保底；软可选后勿在主路径调用。
 * 行为同 align（仅剥适度主句上的误加短断）。
 */
export function ensureYesNoShortAnswer(reply: string): string {
  return alignYesNoShortAnswer(reply).text;
}

/**
 * 注入成句 prompt：可酌情短答（软，非硬强制）
 * 典据：15.3 然／非也；17.4 是也；1.15·6.2 可也；13.24 未可也；16.13 未也；17.7 然，有是言也
 */
export function buildYesNoAnswerPromptBlock(): string {
  return `\n【是否问 · 短断（软）】用户若在请裁**属否／对错／应然**（句中含是否／是不是／算不算／该不该／对不对／属不属／会不会觉得…等；**单凭句末「吗／否」不算**），成句**可酌情**用论语式短答起句再析理；**非必须**——直接半文言裁断亦可，勿为凑短断而硬套。
**勿当是否问**：反问／铺垫如「是否也考虑过…」「是否想过…」后接陈述，不是请你答然／非也。
若选用短断：极性须贴后文主句；主句若视情况／适度／未可一概，则**不要**短断。
短答池（择一，照录语气）：然。／是也。／可也。／非也。／未可也。／未也。／然，有是言也。亦可「非矫情也」类否谓短断。
禁白话「是的／不是」。\n`;
}
