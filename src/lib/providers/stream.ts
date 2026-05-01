import type { Message, ProviderConfig } from '../types';
import { streamWebLLM, WEBLLM_DEFAULT_MODEL } from './webllm';

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'qwen3:4b' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5' },
  webllm: { baseUrl: '', model: WEBLLM_DEFAULT_MODEL },
  custom: { baseUrl: '', model: '' },
};

export function getDefaults(provider: string) {
  return PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.custom;
}

export async function* streamChat(
  config: ProviderConfig,
  messages: Message[],
): AsyncGenerator<string> {
  if (config.provider === 'anthropic') {
    yield* streamAnthropic(config, messages);
    return;
  }

  if (config.provider === 'webllm') {
    const model = config.model || WEBLLM_DEFAULT_MODEL;
    yield* streamWebLLM(model, messages);
    return;
  }

  // OpenAI-compatible (DeepSeek, OpenAI, Ollama, custom)
  const base = config.baseUrl || getDefaults(config.provider).baseUrl;
  const model = config.model || getDefaults(config.provider).model;
  const isOllama = config.provider === 'ollama';
  const url = isOllama ? `${base}/v1/chat/completions` : `${base}/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 8192 }),
  });

  if (!res.ok) throw new Error(`Provider error ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch { /* skip malformed chunks */ }
    }
  }
}

async function* streamAnthropic(
  config: ProviderConfig,
  messages: Message[],
): AsyncGenerator<string> {
  const system = messages.find(m => m.role === 'system')?.content ?? '';
  const rest = messages.filter(m => m.role !== 'system');

  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || 'claude-sonnet-4-5',
      max_tokens: 8192,
      system,
      messages: rest,
      stream: true,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.type === 'content_block_delta') {
          yield json.delta?.text ?? '';
        }
      } catch { /* skip */ }
    }
  }
}
