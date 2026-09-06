import { MODEL, MODEL_ROUTE } from '../../constants/app';

interface ChatPayload {
  text: string;
}

export interface ModelMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTextOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  enableThinking?: boolean;
}

async function requestModel(params: {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
  temperature: number;
  json: boolean;
  enableThinking: boolean;
  history?: ModelMessage[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: params.system },
        ...(params.history ?? []).slice(-8),
        { role: 'user', content: params.user },
      ],
      model: params.model,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      json: params.json,
      enableThinking: params.enableThinking,
      topP: params.topP,
      frequencyPenalty: params.frequencyPenalty,
      presencePenalty: params.presencePenalty,
    }),
  });
  if (!response.ok) throw new Error(`model_http_${response.status}`);
  const payload = (await response.json()) as ChatPayload;
  if (!payload.text) throw new Error('model_empty');
  return payload.text;
}

function stripFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

export async function chatCompletionJson<T>(
  system: string,
  user: string,
  model = MODEL_ROUTE,
  maxTokens = 400,
  temperature = 0.2,
  enableThinking = false,
): Promise<T> {
  const text = await requestModel({ system, user, model, maxTokens, temperature, json: true, enableThinking });
  return JSON.parse(stripFence(text)) as T;
}

export async function chatCompletionText(
  system: string,
  user: string,
  model = MODEL,
  maxTokens = 500,
  temperatureOrEnableThinking: number | boolean = 0.5,
): Promise<string> {
  const temperature = typeof temperatureOrEnableThinking === 'number' ? temperatureOrEnableThinking : 0.75;
  const enableThinking = typeof temperatureOrEnableThinking === 'boolean' ? temperatureOrEnableThinking : false;
  return requestModel({ system, user, model, maxTokens, temperature, json: false, enableThinking });
}

export async function chatCompletionTextWithHistory(
  system: string,
  history: ModelMessage[],
  user: string,
  options: ChatTextOptions = {},
): Promise<string> {
  return requestModel({
    system,
    history,
    user,
    model: options.model ?? MODEL,
    maxTokens: options.maxTokens ?? 480,
    temperature: options.temperature ?? 0.82,
    json: false,
    enableThinking: options.enableThinking ?? false,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
  });
}

/** 当前服务端使用非流式代理；保持孔子入口合同并一次性回传最终文本。 */
export async function chatCompletionTextStream(
  system: string,
  user: string,
  onDelta: (fullSoFar: string) => void,
  model = MODEL,
  maxTokens = 120,
  enableThinking = false,
): Promise<string> {
  const text = await chatCompletionText(system, user, model, maxTokens, enableThinking);
  onDelta(text);
  return text;
}
