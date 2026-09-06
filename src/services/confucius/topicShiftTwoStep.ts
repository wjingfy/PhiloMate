/**
 * 强制换典尾问两步：先抽象框架（禁原文专名），再填原文短语。
 */
import { MODEL } from '../../constants/app';
import { chatCompletionJson } from './qwenJson';
import { getCorpusReinterp } from './corpus';
import type { CorpusEntry, UserLens } from './types';

export interface TopicShiftFrame {
  ok: boolean;
  bridge: string;
  askIntent: string;
  rejectReason?: string;
}

/** 剥掉 temperament 的「｜原句：…」专名串，只留抽象轴 */
export function abstractTemperamentLine(raw?: string): string {
  if (!raw) return '';
  return raw.split('｜')[0].split('|')[0].trim();
}

/** 从换典原文抽可填入的短语（恶…者 / 四字格等） */
export function extractFillableClassicPhrases(entry: CorpusEntry): string[] {
  const text = (entry.text || '').replace(/\s+/g, '');
  const out = new Set<string>();
  for (const m of text.matchAll(/恶([\u4e00-\u9fff]{2,10})者/g)) {
    out.add(`恶${m[1]}者`);
    out.add(m[1]);
  }
  for (const m of text.matchAll(/([\u4e00-\u9fff]{2}而[\u4e00-\u9fff]{1,2})/g)) {
    if (m[1].length <= 6) out.add(m[1]);
  }
  return [...out].slice(0, 8);
}

export function collectBanPhrases(entry: CorpusEntry): string[] {
  return extractFillableClassicPhrases(entry);
}

const NODE_HINT =
  '任、信、所安、堪任、不信、象、质、迹、诚、名、实、内外、表里';

export async function buildTopicShiftAbstractFrame(params: {
  userCondensed: string;
  userReinterp: string;
  lens: UserLens;
  mainCorpusId: string;
  shiftEntry: CorpusEntry;
}): Promise<TopicShiftFrame> {
  const { userCondensed, userReinterp, lens, mainCorpusId, shiftEntry } = params;
  const abstractAxes = (shiftEntry.temperaments || [])
    .map(abstractTemperamentLine)
    .filter(Boolean)
    .join('；');
  const ban = collectBanPhrases(shiftEntry);
  const banLine = ban.length ? ban.join('、') : '（无）';
  const reinterp = getCorpusReinterp(shiftEntry, lens);

  const system = `你是 PhiloMate 尾问逻辑框架器（第一步，只搭架子，不写最终成句）。

任务：把「本轮断语方向」与「换典抽象义」接成可读短桥 + 问旨，供下一步再填原文。

硬约束：
- 只使用抽象义；**禁止**输出下列原文专名/短语：${banLine}
- bridge 须同时扣住断语节点（可参考：${NODE_HINT}）与换典抽象轴
- askIntent 用白话/半文言写「打算问什么」，仍禁专名
- 若抽象上接不上：ok=false，bridge/askIntent 可空

输出 JSON：{"ok":true|false,"bridge":"…","askIntent":"…","rejectReason":"失败时短因"}
不要 JSON 以外文字。`;

  const user = `用户问旨：${userCondensed || '（无）'}
透镜 ${lens.kind}/${lens.key}：${userReinterp || lens.reinterpretation || ''}
主典 id：${mainCorpusId}（断语只用主典，本步不写主典原文）
换典 id：${shiftEntry.id}
换典抽象 temperament：${abstractAxes || abstractTemperamentLine(reinterp) || shiftEntry.condensed || ''}
换典 condensed（仅助理解，勿抄专名）：${(shiftEntry.condensed || '').slice(0, 60)}`;

  try {
    const frame = await chatCompletionJson<TopicShiftFrame>(
      system,
      user,
      MODEL,
      280,
      0.2,
      false
    );
    if (!frame || typeof frame.ok !== 'boolean') {
      return { ok: false, bridge: '', askIntent: '', rejectReason: 'bad_json' };
    }
    const blob = `${frame.bridge || ''}${frame.askIntent || ''}`;
    if (frame.ok && ban.some((p) => p && blob.includes(p))) {
      return {
        ok: false,
        bridge: '',
        askIntent: '',
        rejectReason: 'frame_leaked_classic',
      };
    }
    return {
      ok: frame.ok,
      bridge: (frame.bridge || '').trim(),
      askIntent: (frame.askIntent || '').trim(),
      rejectReason: frame.rejectReason,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      bridge: '',
      askIntent: '',
      rejectReason: `frame_api_error:${msg.slice(0, 160)}`,
    };
  }
}

/** 第二步：把框架 + 允许原文交给成句 prompt */
export function buildTopicShiftFillPromptBlock(
  lens: UserLens,
  shiftEntry: CorpusEntry,
  frame: TopicShiftFrame
): string {
  const phrases = extractFillableClassicPhrases(shiftEntry);
  const phraseLine = phrases.length ? phrases.join('、') : '（无现成短语，用抽象问旨收束）';
  return `\n【句尾提问·须加·强制换典·两步填空】
本轮主典与用户自陈抽象义近同。换典 ${shiftEntry.id}（范畴 ${lens.key}）。
**已通过的逻辑框架（必须沿用，禁止删桥）：**
- 短桥：${frame.bridge}
- 问旨：${frame.askIntent}
成句顺序：断语（只用本轮主典，一眼可读）以「。」收束 → 若需写入上述短桥亦须可读 → **另起一句**句末一问。
句末问：把「问旨」落实为半文言问句；**可以**从下列原文短语中择一嵌入问句以增孔子味：${phraseLine}
硬：断语与尾问用「。」隔开；尾问须一眼能懂「在问什么、与断语什么关系」；短语只能填进已接通的问旨槽；**禁止**删掉短桥后裸接短语；**禁止**分号；仅一问。
例坏：…知亦有涯，汝惑亦真境乎？（逗号粘问 + 缩句谜语）
例好：君子道者三，丘未能有焉。女之迷茫，亦求道而未至乎？
`;
}
