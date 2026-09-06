import type { LensExtractResult, UserLens } from './types';

/** 纯发笑 → 仍走乐，不触发本规则 */
export function isLaughterOnly(text: string): boolean {
  const t = text.trim();
  return /^[哈呵嘻]{2,}[!！。.~～]*$/.test(t);
}

/**
 * 句首客套笑：哈哈哈哈 + 实质内容。
 * 多为语气缓冲/换题客套，**不是** theme 乐；真喜须落在后文（开心/高兴…）或整句纯笑。
 */
export function isCourtesyLaughPrefix(text: string): boolean {
  const t = (text || '').trim();
  if (!t || isLaughterOnly(t)) return false;
  const m = t.match(/^[哈呵嘻]{2,}[,，!！。.\s~～]*(.+)$/s);
  if (!m?.[1]) return false;
  const rest = m[1].trim();
  if (rest.length < 6) return false;
  // 后文仍在表喜悦本身 → 保留乐
  if (/^(好|真|太|超)?(开心|高兴|喜悦|快乐|乐呵|喜欢)/.test(rest)) return false;
  return true;
}

/** 去掉句首客套笑，供 route/lens/hint（对话原文仍保留完整句） */
export function stripCourtesyLaughPrefix(text: string): string {
  if (!isCourtesyLaughPrefix(text)) return (text || '').trim();
  const stripped = text.replace(/^[哈呵嘻]{2,}[,，!！。.\s~～]*/, '').trim();
  return stripped || text.trim();
}

/** 附和/应承（确实、对、是…）后接议题续说 —— 不是夸赞 */
export function isMereAgreement(text: string): boolean {
  const t = stripCourtesyLaughPrefix(text).trim();
  if (!t) return false;
  if (/^(确实|对啊?|是啊?|嗯+|对的|是的|没错|是这样)[。.!！…]*$/.test(t)) return true;
  const m = t.match(/^(确实|对啊?|是啊?|嗯+|对的|是的|没错|是这样)[。.!！，,\s]+([\s\S]+)$/);
  if (!m?.[2]) return false;
  return !hasExplicitPraise(m[2].trim());
}

/** 明确夸人/夸言（不含「条件不错」类叙述） */
function hasExplicitPraise(t: string): boolean {
  if (!t) return false;
  return (
    /(?:说|讲)[得的]?(?:好|对|不错)|(?:做|写)[得的]?不错|挺好|真好|真不错|挺不错|很不错|^不错[啊呀哦]?$|中肯|有道理|在理|受教|佩服|夸|称赞|赞[美扬同]?|了不起|厉害|优秀|精彩|真[厉好棒]|太[好棒了]|好好[哦啊呀]?|您说|^好[啊呀哦]?$|认同(?:你|您|夫子|这话|此言)|很认同|深表认同/.test(
      t
    ) || /没想到.{0,12}(夫子|孔子|你|您).{0,20}(中肯|挺好|说得|有道理)/.test(t)
  );
}

/** 夸人/赞许（含 meta 夸对话）；附和续议不算 */
export function isPraiseInput(text: string): boolean {
  if (isLaughterOnly(text)) return false;
  const t = stripCourtesyLaughPrefix(text);
  if (isMereAgreement(t)) return false;
  return hasExplicitPraise(t);
}

/** 夸的是孔子/上轮回答（须松议题粘滞，勿续论旧 lens） */
export function isPraiseOfAssistant(text: string): boolean {
  if (!isPraiseInput(text)) return false;
  const t = stripCourtesyLaughPrefix(text);
  return /孔子|夫子|丘|你|您|这话|这句|刚才|上句|发言|意见|回答|见解/.test(t);
}

function pickPraiseLens(userInput: string): UserLens {
  const toConfucius = isPraiseOfAssistant(userInput) || /孔子|夫子|丘|你|您|说的|讲得|说得/.test(userInput);
  if (toConfucius) {
    return {
      kind: 'category',
      key: '知/不知',
      reinterpretation: '闻誉未确知其否',
      mentionReason: '夸孔子/对话→知/不知',
    };
  }
  return {
    kind: 'theme',
    key: '省察',
    reinterpretation: '闻善当自省',
    mentionReason: '夸人→省察',
  };
}

function toCondensed(userInput: string): string {
  if (isPraiseOfAssistant(userInput) || /孔子|夫子|丘|你|您/.test(userInput)) {
    return '赞许夫子所言中肯';
  }
  return '闻人称赞';
}

/** 夸人：path1，归入 省察 或 知/不知；禁止误归 乐 */
export function boostPraiseLens(userInput: string, extract: LensExtractResult): LensExtractResult {
  if (!isPraiseInput(userInput)) return extract;

  const lens = pickPraiseLens(userInput);
  extract.path = 'path1';
  extract.lenses = [lens];
  extract.primaryLensIndex = 0;
  // 夸赞轮强制刷新 condensed，避免沿用「器损/情感隐匿」旧问旨
  extract.condensed = toCondensed(userInput);
  return extract;
}

function dietLensFromText(rest: string): UserLens {
  if (/蛋白质|吃足肉|食肉|吃肉/.test(rest)) {
    return {
      kind: 'theme',
      key: '饮食',
      reinterpretation: '重肉食以足养',
      mentionReason: '客套笑后实质=饮食配比，非乐',
    };
  }
  return {
    kind: 'theme',
    key: '饮食',
    reinterpretation: '菜肉配比求宜',
    mentionReason: '客套笑后实质=荤素，非乐',
  };
}

/**
 * 客套笑误标 乐：删 乐 lens；若只剩空则按后文实质重抽（饮食等）。
 */
export function demoteCourtesyLaughLeLens(
  userInput: string,
  extract: LensExtractResult
): LensExtractResult {
  if (!isCourtesyLaughPrefix(userInput)) return extract;

  const rest = stripCourtesyLaughPrefix(userInput);
  const lenses = (extract.lenses || []).filter((l) => !(l.kind === 'theme' && l.key === '乐'));
  const primaryWasLe = extract.lenses?.[extract.primaryLensIndex ?? 0]?.key === '乐';

  if (lenses.length === 0 || primaryWasLe) {
    if (/荤素|蛋白质|肉|蔬菜|饮食|吃/.test(rest)) {
      extract.path = 'path1';
      extract.lenses = [dietLensFromText(rest)];
      extract.primaryLensIndex = 0;
      extract.condensed = /蛋白质|肉/.test(rest)
        ? '觉素少而实缺肉，近重食肉'
        : '讲究荤素搭配';
      return extract;
    }
    // 删乐后无合法 lens：保持空，禁止硬塞过度/不及等假范畴
    if (lenses.length === 0) {
      extract.lenses = [];
      extract.primaryLensIndex = 0;
      extract.condensed = rest.slice(0, 28);
      return extract;
    }
  }

  extract.lenses = lenses;
  // primary 若仍指向已删的 乐，改到 0
  const idx = Math.min(Math.max(0, extract.primaryLensIndex ?? 0), lenses.length - 1);
  if (extract.lenses[idx]?.key === '乐' || primaryWasLe) {
    extract.primaryLensIndex = 0;
  } else {
    extract.primaryLensIndex = idx;
  }
  if (/笑|喜形|乐之|哈哈/.test(extract.condensed || '')) {
    extract.condensed = rest.slice(0, 28);
  }
  return extract;
}
