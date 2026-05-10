import { writable } from 'svelte/store';
import type { App, ProviderConfig } from './types';

export const apps = writable<App[]>([]);
export const currentApp = writable<App | null>(null);

export const providerConfig = writable<ProviderConfig>({
  provider: 'groq',
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  baseUrl: 'https://api.groq.com/openai',
});

export const isGenerating = writable(false);
export const streamContent = writable('');

// Known default models per provider
const PROVIDER_MODEL_MAP: Record<string, string> = {
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5',
  puter: 'claude-sonnet-4-5',
  ollama: 'qwen3:4b',
  webllm: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
};

const PROVIDER_URL_MAP: Record<string, string> = {
  groq: 'https://api.groq.com/openai',
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  ollama: 'http://localhost:11434',
};

// Load config from localStorage on init
export function initStores() {
  try {
    const saved = localStorage.getItem('mint-ai-provider');
    if (saved) {
      const parsed = JSON.parse(saved) as ProviderConfig;
      // Fix stale model: if model doesn't belong to the current provider, reset it
      const isWebLLMModel = parsed.model?.toLowerCase().includes('-mlc') || parsed.model?.toLowerCase().includes('q4f16');
      if (isWebLLMModel && parsed.provider !== 'webllm') {
        parsed.model = PROVIDER_MODEL_MAP[parsed.provider] || '';
      }
      // Ensure baseUrl is set
      if (!parsed.baseUrl && parsed.provider !== 'webllm' && parsed.provider !== 'puter') {
        parsed.baseUrl = PROVIDER_URL_MAP[parsed.provider] || '';
      }
      providerConfig.set(parsed);
    }
  } catch { /* use defaults */ }

  // Persist config changes
  providerConfig.subscribe(c => {
    try { localStorage.setItem('mint-ai-provider', JSON.stringify(c)); } catch {}
  });
}
