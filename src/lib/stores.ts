import { writable } from 'svelte/store';
import type { App, ProviderConfig } from './types';

export const apps = writable<App[]>([]);
export const currentApp = writable<App | null>(null);

export const providerConfig = writable<ProviderConfig>({
  provider: 'deepseek',
  apiKey: '',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com',
});

export const isGenerating = writable(false);
export const streamContent = writable('');

// Load config from localStorage on init
export function initStores() {
  try {
    const saved = localStorage.getItem('mint-ai-provider');
    if (saved) providerConfig.set(JSON.parse(saved));
  } catch { /* use defaults */ }

  // Persist config changes
  providerConfig.subscribe(c => {
    try { localStorage.setItem('mint-ai-provider', JSON.stringify(c)); } catch {}
  });
}
