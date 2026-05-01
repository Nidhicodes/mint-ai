<script lang="ts">
  import { onMount } from 'svelte';
  import { getDefaults } from '../lib/providers/stream';

  interface Props {
    onComplete: () => void;
    onSkip: () => void;
  }

  let { onComplete, onSkip }: Props = $props();

  let showApiKeySection = $state(false);
  let hasWebGPU = $state<boolean | null>(null);

  // Provider setup fields for the API key path
  let provider = $state<string>('deepseek');
  let apiKey = $state('');
  let model = $state(getDefaults('deepseek').model);
  let baseUrl = $state(getDefaults('deepseek').baseUrl);

  onMount(async () => {
    // Detect WebGPU support
    try {
      if ('gpu' in navigator) {
        const adapter = await (navigator as any).gpu.requestAdapter();
        hasWebGPU = !!adapter;
      } else {
        hasWebGPU = false;
      }
    } catch {
      hasWebGPU = false;
    }

    // If no WebGPU, show the API key section by default
    if (hasWebGPU === false) {
      showApiKeySection = true;
    }
  });

  function handleProviderChange() {
    const d = getDefaults(provider);
    model = d.model;
    baseUrl = d.baseUrl;
  }

  function handleStartCreating() {
    // Default to WebLLM — save config and complete
    try {
      const d = getDefaults('webllm');
      localStorage.setItem(
        'mint-ai-provider',
        JSON.stringify({ provider: 'webllm', apiKey: '', model: d.model, baseUrl: d.baseUrl }),
      );
    } catch {
      // ignore
    }
    onComplete();
  }

  function handleSaveApiKey() {
    try {
      localStorage.setItem(
        'mint-ai-provider',
        JSON.stringify({ provider, apiKey, model, baseUrl }),
      );
    } catch {
      // ignore
    }
    onComplete();
  }
</script>

<!-- Full-screen modal overlay -->
<div
  class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  aria-label="Welcome to Mint AI"
>
  <div class="bg-zinc-900 sm:rounded-2xl rounded-t-2xl rounded-b-none p-8 w-full sm:max-w-lg max-w-full sm:mx-4 mx-0 animate-slide-up relative max-h-[90vh] overflow-y-auto shadow-xl border border-zinc-800">

    <div class="text-center">
      <svg class="w-10 h-10 text-mint-500 mx-auto mb-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89-.82L7 21l-1-3.5C9.5 13 14 9 17 8z"/><path d="M17 8c-4 1-7 4-8.5 7.5"/></svg>
      <h2 class="text-2xl font-bold mb-3 text-zinc-100 tracking-tight">Welcome to Mint AI</h2>

      <p class="text-zinc-400 text-sm mb-2 leading-relaxed max-w-sm mx-auto">
        Mint AI runs AI directly in your browser. No account needed.
      </p>

      {#if hasWebGPU === null}
        <!-- Still detecting WebGPU -->
        <p class="text-zinc-500 text-xs mb-6">Checking browser capabilities...</p>
      {:else if hasWebGPU}
        <p class="text-zinc-500 text-xs mb-6 leading-relaxed max-w-sm mx-auto">
          Your browser will download a small AI model (~2GB). This is one-time and cached.
        </p>
      {:else}
        <p class="text-amber-600 text-xs mb-4 leading-relaxed max-w-sm mx-auto">
          Your browser doesn't support WebGPU. Choose an AI provider below to get started.
        </p>
      {/if}

      {#if hasWebGPU !== false}
        <button
          onclick={handleStartCreating}
          class="w-full bg-mint-500/100 hover:bg-mint-600 text-black font-medium rounded-full py-3 min-h-[44px] text-sm transition-colors"
        >
          Start Creating
        </button>
      {/if}

      {#if hasWebGPU !== false && !showApiKeySection}
        <button
          onclick={() => { showApiKeySection = true; }}
          class="mt-4 text-sm text-zinc-500 hover:text-gray-600 transition-colors min-h-[44px]"
        >
          Use API key instead
        </button>
      {/if}
    </div>

    <!-- Expandable API key section (or shown by default when no WebGPU) -->
    {#if showApiKeySection}
      <div class="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
        <label class="block mb-3">
          <span class="text-sm text-zinc-400">Provider</span>
          <select
            bind:value={provider}
            onchange={handleProviderChange}
            class="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 outline-none"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label class="block mb-3">
          <span class="text-sm text-zinc-400">API Key</span>
          <input
            type="password"
            bind:value={apiKey}
            placeholder="sk-..."
            class="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 outline-none"
          />
        </label>

        <label class="block mb-3">
          <span class="text-sm text-zinc-400">Model</span>
          <input
            bind:value={model}
            class="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 outline-none"
          />
        </label>

        {#if provider !== 'ollama'}
          <label class="block mb-4">
            <span class="text-sm text-zinc-400">Base URL</span>
            <input
              bind:value={baseUrl}
              class="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 outline-none"
            />
          </label>
        {/if}

        <button
          onclick={handleSaveApiKey}
          class="w-full bg-mint-500/100 hover:bg-mint-600 text-black font-medium rounded-full py-3 min-h-[44px] text-sm transition-colors"
        >
          Save & Start Creating
        </button>
      </div>
    {/if}
  </div>
</div>
