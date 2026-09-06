/**
 * 福柯 3.0 模型适配层。
 *
 * 交付包原本直接从浏览器读取 VITE_DASHSCOPE_API_KEY。当前整合工程统一
 * 通过 /api/chat 访问模型，密钥只保存在服务器环境变量中，因此这里复用
 * 现有安全代理，同时保留成句档/轻量档分流和关闭深度思考的约定。
 */
import { MODEL, MODEL_ROUTE } from '../../../constants/app';
import {
  chatCompletionJson,
  chatCompletionTextWithHistory,
  type ModelMessage,
} from '../../confucius/qwenJson';

export const llmConfig = {
  get model(): string {
    return MODEL;
  },
  get routeModel(): string {
    return MODEL_ROUTE;
  },
};

/** 专属管线只在 /api/health 已确认模型可用时进入。 */
export function llmAvailable(): boolean {
  return true;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chat(
  messages: ChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    model?: string;
    enableThinking?: boolean;
  } = {},
): Promise<string | null> {
  const system = messages.find((message) => message.role === 'system')?.content ?? '';
  let userIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      userIndex = index;
      break;
    }
  }
  const user = userIndex >= 0 ? messages[userIndex]!.content : '';
  const history = messages
    .slice(0, userIndex >= 0 ? userIndex : messages.length)
    .filter((message): message is ModelMessage => message.role !== 'system');
  try {
    return await chatCompletionTextWithHistory(system, history, user, {
      model: opts.model ?? llmConfig.model,
      maxTokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.2,
      enableThinking: opts.enableThinking ?? false,
    });
  } catch (error) {
    console.warn('[Foucault v3 model fallback]', error);
    return null;
  }
}

export function extractJson<T = Record<string, unknown>>(raw: string | null): T | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1]!.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export async function chatJson<T = Record<string, unknown>>(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<T | null> {
  try {
    return await chatCompletionJson<T>(
      system,
      user,
      opts.model ?? llmConfig.routeModel,
      opts.maxTokens ?? 400,
      opts.temperature ?? 0.2,
      false,
    );
  } catch (error) {
    console.warn('[Foucault v3 JSON fallback]', error);
    return null;
  }
}
