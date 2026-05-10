<script lang="ts">
  import { onMount } from 'svelte';
  import { getDefaults } from '../lib/providers/stream';

  interface Props {
    onComplete: () => void;
    onSkip: () => void;
  }

  let { onComplete, onSkip }: Props = $props();

  let showAdvanced = $state(false);
  let hasWebGPU = $state<boolean | null>(null);

  // Advanced provider fields
  let provider = $state<string>('deepseek');
  let apiKey = $state('');
  let model = $state(getDefaults('deepseek').model);
  let baseUrl = $state(getDefaults('deepseek').baseUrl);

  onMount(async () => {
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
  });

  function handleProviderChange() {
    const d = getDefaults(provider);
    model = d.model;
    baseUrl = d.baseUrl;
  }

  function selectPuter() {
    try {
      const d = getDefaults('puter');
      localStorage.setItem('mint-ai-provider', JSON.stringify({ provider: 'puter', apiKey: '', model: d.model, baseUrl: '' }));
    } catch { /* ignore */ }
    onComplete();
  }

  function selectWebLLM() {
    try {
      const d = getDefaults('webllm');
      localStorage.setItem('mint-ai-provider', JSON.stringify({ provider: 'webllm', apiKey: '', model: d.model, baseUrl: '' }));
    } catch { /* ignore */ }
    onComplete();
  }

  function handleSaveApiKey() {
    try {
      localStorage.setItem('mint-ai-provider', JSON.stringify({ provider, apiKey, model, baseUrl }));
    } catch { /* ignore */ }
    onComplete();
  }
</script>

<div class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Welcome to Mint AI">
  <div class="sm:rounded-2xl rounded-t-2xl rounded-b-none p-8 w-full sm:max-w-lg max-w-full sm:mx-4 mx-0 animate-slide-up relative max-h-[90vh] overflow-y-auto border border-white/[0.08]" style="background:rgba(12,12,12,0.95);backdrop-filter:blur(24px)">

    <div class="text-center">
      <svg class="w-10 h-10 text-mint-400 mx-auto mb-5" viewBox="0 0 32 32" fill="none">
        <path d="M16 4C10 8 6 14 6 20c0 4 2.5 7 6 8 1.5.4 3 .2 4-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M16 4c6 4 10 10 10 16 0 4-2.5 7-6 8-1.5.4-3 .2-4-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M16 4v23" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
      </svg>
      <h2 class="text-2xl font-bold mb-2 text-white tracking-tight">Welcome to Mint AI</h2>
      <p class="text-white/40 text-sm mb-8 leading-relaxed max-w-sm mx-auto">Choose how you want to power your app generation.</p>
    </div>

    <!-- Provider cards -->
    <div class="space-y-3 mb-6">
      <!-- Groq — recommended, free, fast -->
      <button onclick={() => { provider = 'groq'; handleProviderChange(); showAdvanced = true; }} class="w-full text-left p-4 rounded-xl border border-mint-500/20 bg-mint-500/[0.04] hover:bg-mint-500/[0.08] hover:border-mint-500/30 transition-all duration-300 group">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-semibold text-white">⚡ Groq — Free & Blazing Fast</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-mint-500/20 text-mint-400 font-medium">Recommended</span>
        </div>
        <p class="text-xs text-white/40 leading-relaxed">Llama 3.3 70B at 700+ tokens/sec. Free API key in 30 seconds at groq.com. Best quality for free.</p>
      </button>

      <!-- Puter — free, no key needed but opens separate window -->
      <button onclick={selectPuter} class="w-full text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-medium text-white">🌐 Puter — No API Key Needed</span>
        </div>
        <p class="text-xs text-white/35 leading-relaxed">Access Claude, GPT, DeepSeek via free Puter account. Opens a Puter window for auth.</p>
      </button>

      <!-- WebLLM — offline -->
      {#if hasWebGPU !== false}
        <button onclick={selectWebLLM} class="w-full text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium text-white">🔒 Browser AI — Fully Offline</span>
          </div>
          <p class="text-xs text-white/35 leading-relaxed">Runs in your browser. No data leaves your device. Downloads 2GB model once. Simpler apps.</p>
        </button>
      {/if}
    </div>

    <!-- Advanced toggle -->
    {#if !showAdvanced}
      <button onclick={() => { showAdvanced = true; }} class="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors py-2">
        Use your own API key (DeepSeek, Groq, OpenAI, etc.)
      </button>
    {/if}

    {#if showAdvanced}
      <div class="mt-4 pt-4 border-t border-white/[0.06] animate-fade-in space-y-3">
        <label class="block">
          <span class="text-sm text-white/50">Provider</span>
          <select bind:value={provider} onchange={handleProviderChange} class="mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:border-mint-500/40 outline-none">
            <option value="deepseek">DeepSeek (~$0.001/app)</option>
            <option value="groq">Groq (Free tier — fast)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label class="block">
          <span class="text-sm text-white/50">API Key</span>
          <input type="password" bind:value={apiKey} placeholder="sk-..." class="mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:border-mint-500/40 outline-none" />
        </label>
        <label class="block">
          <span class="text-sm text-white/50">Model</span>
          <input bind:value={model} class="mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:border-mint-500/40 outline-none" />
        </label>
        <button onclick={handleSaveApiKey} class="w-full bg-mint-500 hover:bg-mint-400 text-white font-medium rounded-full py-3 text-sm transition-colors shadow-lg shadow-mint-500/20 mt-2">
          Save & Start
        </button>
      </div>
    {/if}

    <!-- Skip -->
    <button onclick={onSkip} class="w-full text-center text-xs text-white/20 hover:text-white/40 transition-colors py-3 mt-2">
      Skip for now
    </button>
  </div>
</div>
