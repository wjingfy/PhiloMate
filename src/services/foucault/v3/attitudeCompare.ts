/**
 * 再解释比照 → 当期态度 + alignment（03-corpus-to-output-logic.md §6）
 *
 * 一次比照同时得到 currentAttitude 与 alignment；
 * 不用旧关键词极性启发式（§6 已废）。
 */
import { chatJson, llmAvailable, llmConfig } from './llm';
import { PROMPT_COMPARE_SYSTEM } from './prompts';
import { getAlignedFrame, readAttitudeLevel, readStance } from './corpus';
import type { Alignment, CompareResult, CorpusEntry, Lens } from './types';

/* ---------------- §6.2 比照调用 ---------------- */

export async function compareReinterpretation(opts: {
  userReinterp: string;
  userCondensed: string;
  entry: CorpusEntry;
  primaryLens: Lens;
  corpusReinterp: string;
}): Promise<{ result: CompareResult; viaModel: boolean }> {
  const frame = getAlignedFrame(opts.entry, opts.primaryLens.kind, opts.primaryLens.key);
  const stance = frame ? readStance(frame) : 'neutral_explain';

  if (llmAvailable()) {
    const payload = [
      `【用户侧】`,
      `再解释：${opts.userReinterp}`,
      `问旨（含意图）：${opts.userCondensed}`,
      ``,
      `【语料侧】`,
      `temperament/义项：${opts.corpusReinterp}`,
      `condensed：${opts.entry.condensed}`,
      `帧立场（stance）：${stance}`,
      `baseAttitude：${frame ? readAttitudeLevel(frame) : 1}`,
    ].join('\n');
    const j = await chatJson<CompareResult>(PROMPT_COMPARE_SYSTEM, payload, {
      model: llmConfig.routeModel, // 轻量档：短 JSON 比照（模型分流表）
    });
    if (
      j &&
      ['tight', 'loose', 'oppose_topic'].includes(j.fit) &&
      ['same', 'opposite', 'inquire', 'unclear'].includes(j.stanceRelation)
    ) {
      return { result: j, viaModel: true };
    }
  }
  // fallbackCompareLocal：保守，偏 inquire/loose，不轻易 tight/opposite
  return {
    result: { fit: 'loose', stanceRelation: 'inquire', reason: '本地兜底：保守判疏' },
    viaModel: false,
  };
}

/* ---------------- §6.3 定档映射 mapAttitudeFromCompare ---------------- */

export function mapAttitudeFromCompare(baseAttitude: number, cmp: CompareResult): number {
  // base=4（疏远）一律保持 4（福柯沿用孔子现行规则；§14.2b 可复审）
  if (baseAttitude === 4) return 4;
  if (cmp.fit === 'tight' && cmp.stanceRelation === 'same') return baseAttitude;
  if (cmp.fit === 'tight' && cmp.stanceRelation === 'opposite') {
    if (baseAttitude === 2 || baseAttitude === 3) return baseAttitude;
    if (baseAttitude === 0) return 2;
    return 1;
  }
  // loose / inquire / unclear / oppose_topic
  return 1;
}

/* ---------------- §6.4 alignment → mode（福柯映射） ---------------- */

/**
 * 福柯表达策略（§14.1 须改项定稿）：
 *   match → 「直陈」：顺着自己的分析往下说
 *   mismatch → 「论证」：以用户具体事短证语料之义
 */
export function resolveAlignment(cmp: CompareResult, baseAttitude: number): Alignment {
  if (baseAttitude === 4) return 'mismatch'; // 疏远帧现行常 mismatch
  if (cmp.stanceRelation === 'opposite') return 'mismatch';
  if (cmp.fit === 'oppose_topic') return 'mismatch';
  return 'match';
}

export function modeOfAlignment(alignment: Alignment): string {
  return alignment === 'match' ? '直陈' : '论证';
}
