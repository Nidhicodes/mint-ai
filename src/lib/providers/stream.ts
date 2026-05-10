import type { Message, ProviderConfig } from '../types';
import { streamWebLLM, WEBLLM_DEFAULT_MODEL } from './webllm';

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
  groq: { baseUrl: 'https://api.groq.com/openai', model: 'llama-3.3-70b-versatile' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'qwen3:4b' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5' },
  puter: { baseUrl: '', model: 'claude-sonnet-4-5' },
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

  if (config.provider === 'puter') {
    yield* streamPuter(config, messages);
    return;
  }

  if (config.provider === 'webllm') {
    const model = config.model || WEBLLM_DEFAULT_MODEL;
    yield* streamWebLLM(model, messages);
    return;
  }

  // OpenAI-compatible (DeepSeek, OpenAI, Groq, Ollama, custom)
  const base = config.baseUrl || getDefaults(config.provider).baseUrl;
  const model = config.model || getDefaults(config.provider).model;
  const isOllama = config.provider === 'ollama';
  const isGroq = config.provider === 'groq';
  const url = (isOllama || isGroq) ? `${base}/v1/chat/completions` : `${base}/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, stream: true, max_tokens: config.provider === 'groq' ? 4096 : 8192 }),
  });

  // Auto-retry on rate limit (429) — wait and try once more
  if (res.status === 429) {
    const retryAfter = parseFloat(res.headers.get('retry-after') || '5');
    const waitMs = Math.min(retryAfter * 1000, 30000);
    console.log(`[Mint AI] Rate limited, retrying in ${retryAfter}s...`);
    await new Promise(r => setTimeout(r, waitMs));
    const retry = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, stream: true, max_tokens: config.provider === 'groq' ? 4096 : 8192 }),
    });
    if (!retry.ok) throw new Error(`Provider error ${retry.status}: ${await retry.text()}`);
    if (!retry.body) throw new Error('No response body');
    const reader2 = retry.body.getReader();
    const decoder2 = new TextDecoder();
    let buffer2 = '';
    while (true) {
      const { done, value } = await reader2.read();
      if (done) break;
      buffer2 += decoder2.decode(value, { stream: true });
      const lines = buffer2.split('\n');
      buffer2 = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
        try { const json = JSON.parse(trimmed.slice(6)); const content = json.choices?.[0]?.delta?.content; if (content) yield content; } catch {}
      }
    }
    return;
  }

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

/**
 * Puter.js provider — free access to Claude, GPT, DeepSeek, etc.
 * Uses the "User-Pays" model: users authenticate with their Puter account.
 * No API keys needed from the developer.
 */
async function* streamPuter(
  config: ProviderConfig,
  messages: Message[],
): AsyncGenerator<string> {
  const puter = await loadPuter();
  const model = config.model || 'claude-sonnet-4-5';

  // Build the messages for Puter
  const puterMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Try streaming first
    const response = await puter.ai.chat(puterMessages, {
      model,
      stream: true,
    });

    if (response && typeof response[Symbol.asyncIterator] === 'function') {
      for await (const part of response) {
        const text = part?.text || part?.message?.content || '';
        if (text) yield text;
      }
    } else {
      // Fallback: non-streaming response
      const text = response?.message?.content?.[0]?.text
        || response?.message?.content
        || response?.toString()
        || '';
      if (text) yield text;
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('sign') || msg.includes('auth') || msg.includes('login')) {
      throw new Error('Please sign in to your Puter account. A sign-in window should appear — check if it was blocked by your popup blocker.');
    }
    throw new Error(`Puter AI error: ${msg}`);
  }
}

/** Dynamically load Puter.js SDK */
let puterPromise: Promise<any> | null = null;
function loadPuter(): Promise<any> {
  if (puterPromise) return puterPromise;
  puterPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).puter) {
      resolve((window as any).puter);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.onload = () => {
      const check = () => {
        if ((window as any).puter) {
          resolve((window as any).puter);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    };
    script.onerror = () => reject(new Error('Failed to load Puter.js SDK'));
    document.head.appendChild(script);
  });
  return puterPromise;
}
