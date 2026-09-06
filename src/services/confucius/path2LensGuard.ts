import type { LensExtractResult, UserLens } from './types';
import { canonicalizeLensKey } from './lensNormalize';

/** path2：禁止把无张力日常硬套内/外、德性等 */
const OBJECT_DAMAGE =
  /坏|损|修|换|漏|裂|保养|维护|故障|自行车|车|电器|手机|电脑|器|物|工具|机器|设备/;
const REPAIR = /修|保养|维护|补|换|装/;
const INNER_OUTER_SIGNAL = /内心|外在|外观|里面|外面|内面|外露|内在|在外|于内|于外/;
const TENSION =
  /过|不及|太[过甚]|失衡|失|得|急|迫|伪|欺|恶|善|怒|悲|喜|厌|争|抢|贪|躁|懒|傲|谄|佞|溢|缺|偏/;

const STRETCH_CATEGORY_KEYS = new Set([
  '内/外',
  '德',
  '隐/显',
  '自恃',
  '人/己',
  '仁/不仁',
  '善/恶',
]);

/** 消/长合法：双方势力此消彼长（或明确可喻） */
const XIAO_ZHANG_FORCE =
  /公室|大夫|三桓|权势|政权|朝政|国势|盛衰|兴亡|此消彼长|彼长|此消|一方.{0,8}(?:消|衰|亡|微).{0,12}一方|势力/;

/** 个人日用进益／变好——应用得/失，禁消/长 */
const PERSONAL_GAIN_NOT_XIAO_ZHANG =
  /跑(?:步|了)|公里|耐力|变强|变好|进步|提升|进益|畅快|闷气|散了|栗子|好吃|好香|健身|练完|体重|学会了|终于会|比以前好|没那么沉|开心了|心轻/;

function pickObjectLens(text: string): UserLens {
  if (REPAIR.test(text)) {
    return {
      kind: 'category',
      key: '工具与手段',
      reinterpretation: '器损当以手段复',
      mentionReason: '修理=手段复器（path2贴切度）',
    };
  }
  return {
    kind: 'category',
    key: '工具与手段',
    reinterpretation: '器用失则手段当复',
    mentionReason: '物损=器用/手段（path2贴切度）',
  };
}

/**
 * 消/长 → 得/失：个人进益/日用变好不得套势力消长（16.3 池）。
 * path1/path2 皆适用。
 */
export function remapXiaoZhangPersonalGain(
  userInput: string,
  extract: LensExtractResult
): LensExtractResult {
  const text = `${userInput}${extract.condensed || ''}`;
  extract.lenses = (extract.lenses || []).map((l) => ({
    ...l,
    key: canonicalizeLensKey(l.key),
  }));
  const idx = extract.primaryLensIndex ?? 0;
  const primary = extract.lenses[idx];
  if (!primary || primary.kind !== 'category' || primary.key !== '消/长') return extract;
  if (XIAO_ZHANG_FORCE.test(text)) return extract;
  if (!PERSONAL_GAIN_NOT_XIAO_ZHANG.test(text)) return extract;

  extract.lenses[idx] = {
    kind: 'category',
    key: '得/失',
    reinterpretation: '同主日用进益乃得',
    mentionReason: '消长禁个人进益→得/失',
  };
  return extract;
}

/** 校正 path2 过度延伸的 lens（物损等贴切度）；范畴义项靠词表/prompt，不机械改标 */
export function tightenPath2Lens(userInput: string, extract: LensExtractResult): LensExtractResult {
  if (extract.path !== 'path2') return extract;

  const text = `${userInput}${extract.condensed || ''}`;
  extract.lenses = (extract.lenses || []).map((l) => ({
    ...l,
    key: canonicalizeLensKey(l.key),
  }));
  const idx = extract.primaryLensIndex ?? 0;
  const primary = extract.lenses[idx];
  if (!primary) return extract;

  const hasTension = TENSION.test(text);

  // 物损/修理：不得套内/外、德性等
  if (OBJECT_DAMAGE.test(text) && STRETCH_CATEGORY_KEYS.has(primary.key)) {
    extract.lenses[idx] = pickObjectLens(text);
    return extract;
  }

  if (
    primary.key === '内/外' &&
    !INNER_OUTER_SIGNAL.test(text) &&
    !hasTension &&
    OBJECT_DAMAGE.test(text)
  ) {
    extract.lenses[idx] = pickObjectLens(text);
    return extract;
  }

  if (!hasTension && STRETCH_CATEGORY_KEYS.has(primary.key) && OBJECT_DAMAGE.test(text)) {
    extract.lenses[idx] = pickObjectLens(text);
  }

  return extract;
}
