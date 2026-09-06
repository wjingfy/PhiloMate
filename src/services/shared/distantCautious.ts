/** 疏远档回避句：单句或句池；出句时随机抽一句 */

export function parseDistantCautiousTexts(raw: unknown): string[] {
  const items = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const texts: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const text = String((item as { text?: unknown }).text ?? '').trim();
    if (text) texts.push(text);
  }
  return texts;
}

export function pickDistantCautiousText(
  raw: unknown,
  rng: () => number = Math.random,
): string | null {
  const texts = parseDistantCautiousTexts(raw);
  if (texts.length === 0) return null;
  if (texts.length === 1) return texts[0];
  const i = Math.min(texts.length - 1, Math.floor(rng() * texts.length));
  return texts[i];
}
