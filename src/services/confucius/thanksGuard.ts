import { chatCompletionText } from './qwenJson';
import type { DialogueTurn } from './dialogueLensGuard';

/** 纯致谢轮（非新问题、非反驳） */
export function isThanksTurn(text: string): boolean {
  const t = text.trim();
  if (!/谢谢|多谢|感谢|有劳|辛苦了/.test(t)) return false;
  if (/但|然而|不过|？|吗|怎么|为何|什么|是否|是不是|还有|还想|另外/.test(t)) return false;
  if (t.length > 40) return false;
  return /孔子|夫子|丘|你|您|孔|老师/.test(t) || t.length <= 16;
}

/** 上文是否呈现用户解纷/省察等值得简短肯定之事 */
export function userDidWellInDialogue(priorTurns: DialogueTurn[]): boolean {
  const blob = priorTurns.map((t) => t.content).join('');
  return /解纷|平心|矛盾|谅解|信任|办法|解决|做得|不错|自律|推己|恕|理解.*感受|心平气和/.test(
    blob
  );
}

export function buildThanksPrompt(params: {
  userDidWell: boolean;
  priorDialogue?: string;
}): string {
  const ctx = params.priorDialogue ? `\n【上文摘要】\n${params.priorDialogue}\n` : '';
  const affirm = params.userDidWell
    ? '若上文可见解纷、平心、推己等善行，可嵌短肯定（如「善。」「解纷有道」），与自谦同一气，**禁止**后接「甚是」「汝已行之」等补评。'
    : '不必刻意夸人，受谢自谦即可。';

  return `你是孔子（PhiloMate 致谢轮）。用户本轮**仅致谢**，不是新问题。
${ctx}
【要求】
- 先受谢、自谦：丘何敢当 / 不敢当 / 言尽于此 / 善自勉之 等
- ${affirm}
- **禁止**再展开说教、禁止泼冷水（如「恕道修远」「实难轻言已至」「非其所及」「岂敢以…自许」）
- **禁止**引入新典句、新论点、新教训
- 温平收束，≤28字，半文言
【输出】仅一行。`;
}

export async function generateThanksReply(params: {
  userInput: string;
  priorTurns: DialogueTurn[];
}): Promise<string> {
  const priorDialogue = params.priorTurns
    .slice(-4)
    .map((t) => `${t.role === 'user' ? '用户' : '孔子'}：${t.content}`)
    .join('\n');
  const userDidWell = userDidWellInDialogue(params.priorTurns);

  try {
    const raw = await chatCompletionText(
      buildThanksPrompt({ userDidWell, priorDialogue }),
      params.userInput,
      undefined,
      48
    );
    const text = polishThanksReply(raw, userDidWell);
    if (text) return text;
  } catch {
    /* fallback below */
  }

  return userDidWell
    ? '善。汝平心解纷，丘何敢当。'
    : '汝言谢，丘何敢当。';
}

export function polishThanksReply(text: string, userDidWell: boolean): string {
  const t = (text || '').trim().replace(/^["「]|["」]$/g, '');
  if (!t) return '';
  if (/恕道修远|实难轻言|非其所及|岂敢以.*自许|勿施于人.*旨/.test(t)) {
    return userDidWell ? '善。汝平心解纷，丘何敢当。' : '汝言谢，丘何敢当。';
  }
  return t.length > 36 ? t.slice(0, 36) : t;
}
