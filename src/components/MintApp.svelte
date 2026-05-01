<script lang="ts">
  import { onMount } from 'svelte';
  import { apps, providerConfig, isGenerating, streamContent, currentApp, initStores } from '../lib/stores';
  import { generate } from '../lib/engine/generate';
  import { listApps, saveApp, saveVersion, deleteApp as removeApp } from '../lib/storage/db';
  import { forkApp } from '../lib/sharing/fork';
  import { loadGallery, type GalleryApp } from '../lib/gallery/loader';
  import { setProgressCallback } from '../lib/providers/webllm';
  import { THEMES, DEFAULT_THEME } from '../lib/engine/themes';
  import type { App } from '../lib/types';
  import SearchFilter from './SearchFilter.svelte';
  import AppDetail from './AppDetail.svelte';
  import OnboardingWizard from './OnboardingWizard.svelte';
  import { shouldShowOnboarding, getOnboardingState, saveOnboardingState } from '../lib/onboarding';

  let prompt = $state('');
  let selectedTheme = $state(DEFAULT_THEME);
  let webllmProgress = $state('');
  let view = $state<'library' | 'create' | 'preview' | 'detail' | 'gallery'>('library');
  let placeholderText = $state('Describe an app you want to create...');
  let placeholderIndex = $state(0);
  let placeholderInterval: ReturnType<typeof setInterval> | null = null;
  const placeholderExamples = [
    'A pomodoro timer with ambient sounds...',
    'A budget tracker with pie charts...',
    'A flashcard app for studying...',
    'A workout log with body diagram...',
    'A recipe scaler for cooking...',
  ];
  let previewHtml = $state('');
  let showSettings = $state(false);
  let showOnboarding = $state(false);
  let settingsProvider = $state('webllm');
  let settingsApiKey = $state('');
  let settingsModel = $state('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
  let settingsBaseUrl = $state('');
  let filteredApps = $state<App[]>([]);
  let iframeRef = $state<HTMLIFrameElement | null>(null);
  let detailApp = $state<App | null>(null);
  let galleryApps = $state<GalleryApp[]>([]);
  let galleryLoaded = $state(false);

  // UX: Live preview state for split-view generating flow
  let livePreviewHtml = $state('');
  let livePreviewInterval: ReturnType<typeof setInterval> | null = null;

  // UX: Cmd+K prompt focus ref
  let promptInputRef = $state<HTMLInputElement | null>(null);

  // UX: Completion toast state
  let showToast = $state(false);
  let toastMessage = $state('');
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  // UX: Inline error message state
  let errorMessage = $state('');

  // UX: Time-of-day greeting
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Late night coding?';
  }

  // UX: Extract HTML from stream content for live preview
  function extractLiveHtml(raw: string): string {
    const match = raw.match(/```html\s*\n([\s\S]*?)```/);
    if (match) return match[1].trim();
    const trimmed = raw.trim();
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) return trimmed;
    // Try partial HTML extraction (incomplete code block)
    const partialMatch = raw.match(/```html\s*\n([\s\S]*)/);
    if (partialMatch) return partialMatch[1].trim();
    return '';
  }

  // UX: Map error messages to human-friendly text
  function humanizeError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes('402') || lower.includes('insufficient balance'))
      return 'Your API credits ran out. Top up your account or switch to Browser AI (free) in settings.';
    if (lower.includes('401') || lower.includes('unauthorized'))
      return "Your API key doesn't seem right. Check it in settings.";
    if (lower.includes('429') || lower.includes('rate'))
      return 'The AI is taking a break. Try again in a moment.';
    if (lower.includes('failed to fetch') || lower.includes('network'))
      return "Can't reach the AI. Check your internet connection.";
    return 'Something went wrong. Try again or switch providers in settings.';
  }

  function dismissError() {
    errorMessage = '';
  }

  function triggerToast(msg: string) {
    showToast = true;
    toastMessage = msg;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { showToast = false; }, 3000);
  }

  function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
  }

  function startPlaceholderRotation() {
    if (placeholderInterval) return;
    placeholderInterval = setInterval(() => {
      if (!$currentApp) {
        placeholderIndex = (placeholderIndex + 1) % placeholderExamples.length;
        placeholderText = placeholderExamples[placeholderIndex];
      }
    }, 4000);
  }

  function stopPlaceholderRotation() {
    if (placeholderInterval) {
      clearInterval(placeholderInterval);
      placeholderInterval = null;
    }
  }

  // UX: Start live preview polling during generation
  function startLivePreview() {
    livePreviewHtml = '';
    if (livePreviewInterval) clearInterval(livePreviewInterval);
    livePreviewInterval = setInterval(() => {
      const content = $streamContent;
      if (content) {
        const html = extractLiveHtml(content);
        if (html) livePreviewHtml = html;
      }
    }, 2000);
  }

  function stopLivePreview() {
    if (livePreviewInterval) {
      clearInterval(livePreviewInterval);
      livePreviewInterval = null;
    }
  }

  onMount(async () => {
    initStores();
    setProgressCallback((p) => { webllmProgress = p.text; });
    const state = getOnboardingState();
    if (shouldShowOnboarding(state)) showOnboarding = true;
    const unsub = providerConfig.subscribe(c => {
      settingsProvider = c.provider;
      settingsApiKey = c.apiKey;
      settingsModel = c.model;
      settingsBaseUrl = c.baseUrl;
    });
    await refreshApps();

    // Check for prompt from URL params (landing page redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const urlPrompt = urlParams.get('prompt');
    if (urlPrompt) {
      prompt = urlPrompt;
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      handleGenerate();
    }

    startPlaceholderRotation();

    // UX: Cmd+K / Ctrl+K keyboard shortcut to focus prompt
    function handleGlobalKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        promptInputRef?.focus();
      }
    }
    window.addEventListener('keydown', handleGlobalKeydown);

    return () => {
      unsub();
      stopPlaceholderRotation();
      stopLivePreview();
      window.removeEventListener('keydown', handleGlobalKeydown);
    };
  });

  function handleOnboardingComplete() {
    saveOnboardingState({ completed: true, completedAt: Date.now(), skipped: false, providerConfigured: true });
    showOnboarding = false;
    initStores();
  }
  function handleOnboardingSkip() {
    saveOnboardingState({ completed: false, completedAt: null, skipped: true, providerConfigured: false });
    showOnboarding = false;
  }
  async function refreshApps() { apps.set(await listApps()); }

  async function handleGenerate() {
    if (!prompt.trim() || $isGenerating) return;
    errorMessage = '';
    isGenerating.set(true); streamContent.set(''); view = 'create';
    startLivePreview();
    try {
      console.log('[generate] currentApp:', $currentApp ? `"${$currentApp.title}" (${$currentApp.html.length} chars)` : 'null (new app)');
      const result = await generate($providerConfig, prompt, $currentApp, (chunk) => streamContent.update(s => s + chunk), selectedTheme);
      stopLivePreview();
      previewHtml = result.html; view = 'preview';
      // UX: Show completion toast
      triggerToast('Your app is ready');
      const app: App = {
        id: $currentApp?.id ?? crypto.randomUUID(), title: result.title, description: result.description,
        prompt, html: result.html, thumbnail: null, tags: result.tags,
        version: ($currentApp?.version ?? 0) + 1, createdAt: $currentApp?.createdAt ?? Date.now(),
        updatedAt: Date.now(), shareId: null, forkedFrom: $currentApp?.forkedFrom ?? null,
      };
      await saveApp(app);
      await saveVersion(app.id, { version: app.version, html: app.html, prompt, timestamp: Date.now() });
      currentApp.set(app); await refreshApps();
      setTimeout(async () => {
        try {
          const { captureFromHtml } = await import('../lib/storage/thumbnails');
          const thumb = await captureFromHtml(app.html);
          if (thumb) { app.thumbnail = thumb; await saveApp(app); currentApp.set({...app}); await refreshApps(); }
        } catch { /* thumbnail capture is best-effort */ }
      }, 1000);
    } catch (e: any) {
      stopLivePreview();
      // UX: Show human-friendly inline error instead of alert
      errorMessage = humanizeError(e.message || String(e));
    }
    finally { isGenerating.set(false); prompt = ''; }
  }

  function openApp(app: App) { currentApp.set(app); detailApp = app; view = 'detail'; }
  function newApp() { currentApp.set(null); detailApp = null; previewHtml = ''; view = 'library'; }
  async function handleDelete(id: string) { await removeApp(id); await refreshApps(); if ($currentApp?.id === id) newApp(); }
  async function handleFork(app: App) {
    const forked = await forkApp(app, 'library'); currentApp.set(forked); previewHtml = forked.html; await refreshApps(); view = 'preview';
  }
  async function handleGalleryFork(g: GalleryApp) {
    const forked = await forkApp({ ...g, prompt: g.description, thumbnail: null, version: 1, createdAt: g.createdAt, updatedAt: Date.now(), shareId: null, forkedFrom: null }, 'gallery');
    currentApp.set(forked); previewHtml = forked.html; await refreshApps(); view = 'preview';
  }
  async function showGalleryView() {
    view = 'gallery';
    if (!galleryLoaded) {
      try { const m = await loadGallery(); galleryApps = m.apps; galleryLoaded = true; } catch { galleryApps = []; }
    }
  }
  function saveSettings() {
    providerConfig.set({ provider: settingsProvider as any, apiKey: settingsApiKey, model: settingsModel, baseUrl: settingsBaseUrl });
    showSettings = false;
  }
  function handleKeydown(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }
</script>

<div>

{#if showOnboarding}
  <OnboardingWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
{/if}

<!-- UX: Completion Toast -->
{#if showToast}
  <div class="toast-container" role="status" aria-live="polite">
    <div class="toast-content">
      <svg class="w-4 h-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span class="text-sm text-gray-800 font-medium">{toastMessage}</span>
    </div>
  </div>
{/if}

<!-- Navigation -->
<nav class="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
  <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
    <button onclick={() => newApp()} class="flex items-center gap-2 hover:opacity-80 transition-opacity">
      <svg class="w-5 h-5 text-mint-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89-.82L7 21l-1-3.5C9.5 13 14 9 17 8z"/><path d="M17 8c-4 1-7 4-8.5 7.5"/></svg>
      <span class="font-semibold text-lg text-zinc-100 tracking-tight">Mint AI</span>
    </button>
    <div class="flex items-center gap-1">
      <button onclick={() => newApp()} class="text-sm text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800">Library</button>
      <button onclick={showGalleryView} class="text-sm text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800">Gallery</button>
      <button onclick={() => { showSettings = !showSettings }} class="text-zinc-500 hover:text-zinc-100 transition-colors p-2 rounded-lg hover:bg-zinc-800" aria-label="Settings">
        <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>
  </div>
</nav>

<!-- UX: Error Banner (between nav and main content) -->
{#if errorMessage}
  <div class="fixed top-14 left-0 right-0 z-40 animate-fade-in">
    <div class="max-w-6xl mx-auto px-4 pt-2">
      <div class="error-banner flex items-center justify-between gap-3 px-4 py-3 rounded-xl">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span class="text-sm text-red-800">{errorMessage}</span>
        </div>
        <button onclick={dismissError} class="text-red-400 hover:text-red-600 text-sm p-1 rounded hover:bg-red-100 transition-colors shrink-0" aria-label="Dismiss error">&times;</button>
      </div>
    </div>
  </div>
{/if}

<!-- Settings Modal -->
{#if showSettings}
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm" role="dialog" aria-label="Provider settings">
    <div class="glass rounded-2xl p-6 w-full max-w-md mx-4 animate-slide-up">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold text-zinc-100">Provider Settings</h2>
        <button onclick={() => { showSettings = false }} class="text-zinc-500 hover:text-zinc-100 p-2 rounded-lg hover:bg-zinc-800 transition-colors" aria-label="Close settings">
          <span class="text-sm">&times;</span>
        </button>
      </div>
      <label class="block mb-3"><span class="text-sm text-zinc-400">Provider</span>
        <select bind:value={settingsProvider} class="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 outline-none">
          <option value="webllm">Browser AI (Free)</option><option value="deepseek">DeepSeek</option>
          <option value="openai">OpenAI</option><option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama (Local)</option><option value="custom">Custom</option>
        </select>
      </label>
      {#if settingsProvider !== 'webllm'}
        <label class="block mb-3"><span class="text-sm text-zinc-400">API Key</span>
          <input type="password" bind:value={settingsApiKey} placeholder="sk-..." class="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 outline-none" />
        </label>
      {/if}
      <label class="block mb-3"><span class="text-sm text-zinc-400">Model</span>
        <input bind:value={settingsModel} class="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 outline-none" />
      </label>
      {#if settingsProvider !== 'webllm'}
        <label class="block mb-4"><span class="text-sm text-zinc-400">Base URL</span>
          <input bind:value={settingsBaseUrl} class="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 outline-none" />
        </label>
      {/if}
      <div class="flex gap-3 mt-5">
        <button onclick={saveSettings} class="flex-1 bg-mint-500 hover:bg-mint-600 text-black font-medium rounded-full py-2.5 text-sm transition-colors">Save</button>
        <button onclick={() => { showSettings = false }} class="flex-1 bg-gray-100 hover:bg-zinc-700 text-gray-700 rounded-full py-2.5 text-sm transition-colors">Cancel</button>
      </div>
    </div>
  </div>
{/if}

<main class="pt-14 pb-24 min-h-screen" class:pt-[4.5rem]={!!errorMessage}>

  <!-- Library View -->
  {#if view === 'library'}
    <div class="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      {#if $apps.length === 0}
        <div class="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <svg class="w-12 h-12 text-mint-400 mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89-.82L7 21l-1-3.5C9.5 13 14 9 17 8z"/><path d="M17 8c-4 1-7 4-8.5 7.5"/></svg>
          <h1 class="text-3xl sm:text-4xl font-bold mb-3 text-gradient tracking-tight">{getGreeting()}</h1>
          <p class="text-zinc-400 max-w-md mb-8 leading-relaxed">What would you like to build today?</p>
          <div class="flex flex-wrap gap-2 justify-center max-w-lg">
            {#each [
              'A workout tracker that shows muscle groups on a body diagram',
              'A budget app with spending pie charts and monthly trends',
              'A flashcard quiz that tracks your learning streaks',
              'A recipe scaler for dinner parties',
              'A habit tracker with daily streaks and heatmap',
            ] as s}
              <button onclick={() => { prompt = s; handleGenerate(); }} class="text-sm px-4 py-2.5 rounded-full glass border border-zinc-800 text-zinc-400 hover:text-mint-400 hover:border-mint-500/30 hover:bg-mint-500/10 transition-all duration-300 shadow-sm hover:shadow-md">{s}</button>
            {/each}
          </div>
        </div>
      {:else}
        <h2 class="text-xl font-semibold text-zinc-100 mb-4 tracking-tight">Your Apps</h2>
        <SearchFilter apps={$apps} onFilteredApps={(f) => { filteredApps = f; }} />
        {#if filteredApps.length === 0}
          <div class="flex flex-col items-center py-16 text-center">
            <p class="text-sm text-zinc-500">No apps match your search.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
            {#each filteredApps as app (app.id)}
              <div role="button" tabindex="0" onclick={() => openApp(app)} onkeydown={(e) => e.key === 'Enter' && openApp(app)} class="glass rounded-2xl overflow-hidden text-left group cursor-pointer glass hover:border-zinc-700 transition-all duration-300">
                {#if app.thumbnail}
                  <img src={app.thumbnail} alt="" class="w-full h-36 object-cover" />
                {:else}
                  <div class="w-full h-36 bg-gradient-to-br from-mint-50 via-cream-100 to-cream-200 flex items-center justify-center">
                    <span class="text-2xl text-zinc-500 group-hover:text-mint-300 transition-colors duration-300">{app.title.charAt(0)}</span>
                  </div>
                {/if}
                <div class="p-4">
                  <div class="flex items-start justify-between mb-1">
                    <h3 class="font-medium text-zinc-100 group-hover:text-mint-400 transition-colors truncate pr-2">{app.title}</h3>
                    <button onclick={(e) => { e.stopPropagation(); handleDelete(app.id); }} class="text-zinc-400 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all p-1 rounded" aria-label="Delete {app.title}">&times;</button>
                  </div>
                  <p class="text-sm text-zinc-500 line-clamp-2 mb-3">{app.description}</p>
                  <div class="flex items-center justify-between">
                    <div class="flex gap-1.5">{#each app.tags.slice(0,3) as tag}<span class="text-[10px] px-2 py-0.5 rounded-full bg-mint-500/10 text-mint-400">{tag}</span>{/each}</div>
                    <span class="text-[10px] text-zinc-500">{timeAgo(app.updatedAt)}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- Detail View -->
  {#if view === 'detail' && detailApp}
    <AppDetail app={detailApp} onBack={newApp} onModify={() => { view = 'library'; }} onShare={() => {}} onFork={() => handleFork(detailApp!)} onDelete={() => handleDelete(detailApp!.id)} onAppUpdated={(u) => { detailApp = u; currentApp.set(u); refreshApps(); }} />
  {/if}

  <!-- Gallery View -->
  {#if view === 'gallery'}
    <div class="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <h2 class="text-xl font-semibold text-zinc-100 mb-2 tracking-tight">Gallery</h2>
      <p class="text-sm text-zinc-400 mb-6">Curated demo apps. Fork any into your library.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {#each galleryApps as g (g.id)}
          <div class="glass rounded-2xl overflow-hidden group glass hover:border-zinc-700 transition-all duration-300">
            <div class="w-full h-36 bg-gradient-to-br from-mint-50 via-cream-100 to-cream-200 flex items-center justify-center">
              <span class="text-3xl text-zinc-500 group-hover:text-mint-300 transition-colors duration-300">{g.title.charAt(0)}</span>
            </div>
            <div class="p-4">
              <h3 class="font-medium text-zinc-100 mb-1">{g.title}</h3>
              <p class="text-sm text-zinc-500 line-clamp-2 mb-3">{g.description}</p>
              <div class="flex items-center justify-between">
                <div class="flex gap-1.5">{#each g.tags.slice(0,3) as tag}<span class="text-[10px] px-2 py-0.5 rounded-full bg-mint-500/10 text-mint-400">{tag}</span>{/each}</div>
                <button onclick={() => handleGalleryFork(g)} class="text-xs text-mint-400 hover:text-mint-400 px-3 py-1.5 rounded-lg hover:bg-mint-500/10 transition-all font-medium">Fork</button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- UX: Split-View Generating View -->
  {#if view === 'create'}
    <div class="split-view-container animate-fade-in">
      {#if webllmProgress && $providerConfig.provider === 'webllm'}
        <div class="mx-4 mb-4 bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-sm">
          <p class="text-xs text-mint-400 mb-1 font-medium">Loading browser AI model...</p>
          <p class="text-xs text-zinc-500">{webllmProgress}</p>
        </div>
      {/if}
      <div class="split-view">
        <!-- Left: Streaming code -->
        <div class="split-view-code">
          <div class="flex items-center gap-2 px-4 py-2 border-b border-gray-800/50">
            <div class="w-2 h-2 rounded-full bg-mint-500 animate-pulse"></div>
            <span class="text-xs text-zinc-500 font-medium">Building your app...</span>
          </div>
          <pre class="font-mono text-xs text-zinc-400 p-4 flex-1 overflow-auto whitespace-pre-wrap break-words">{$streamContent}</pre>
        </div>
        <!-- Right: Live preview -->
        <div class="split-view-preview">
          {#if livePreviewHtml}
            <iframe srcdoc={livePreviewHtml} sandbox="allow-scripts allow-same-origin allow-modals allow-forms" class="w-full h-full border-0 bg-white" title="Live preview"></iframe>
          {:else}
            <div class="flex flex-col items-center justify-center h-full text-center px-4">
              <div class="w-8 h-8 border-2 border-mint-300 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p class="text-sm text-zinc-500">Waiting for code...</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Preview View -->
  {#if view === 'preview'}
    <div class="h-[calc(100vh-3.5rem-6rem)] animate-fade-in">
      <div class="h-full flex flex-col">
        <div class="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800">
          <div class="flex items-center gap-3">
            <button onclick={newApp} class="text-zinc-400 hover:text-zinc-100 text-sm transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-800">&larr; Back</button>
            <span class="text-sm font-medium text-zinc-100">{$currentApp?.title ?? 'Preview'}</span>
          </div>
          <div class="flex items-center gap-1">
            <button onclick={async () => { if ($currentApp) { const { downloadHtml } = await import('../lib/sharing/encode'); downloadHtml($currentApp.html, $currentApp.title); } }} class="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-all">&darr; Export</button>
            <button onclick={() => window.open('data:text/html;charset=utf-8,' + encodeURIComponent(previewHtml), '_blank')} class="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-all">Fullscreen</button>
          </div>
        </div>
        <iframe bind:this={iframeRef} srcdoc={previewHtml} sandbox="allow-scripts allow-same-origin allow-modals allow-forms" class="flex-1 w-full bg-zinc-900 rounded-b-lg" title="App preview"></iframe>
      </div>
    </div>
  {/if}
</main>

<!-- Prompt Bar -->
<div class="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
  <div class="max-w-2xl mx-auto">
    <div class="bg-white rounded-2xl border border-zinc-800 shadow-sm focus-within:border-mint-400 focus-within:glow-mint transition-all duration-300 {$isGenerating ? 'shimmer' : ''}">
      <!-- Theme picker (only when creating new app) -->
      {#if !$currentApp && !$isGenerating}
        <div class="flex items-center gap-1.5 px-4 pt-3 pb-1 overflow-x-auto">
          <span class="text-[10px] text-zinc-500 shrink-0 mr-1">Theme</span>
          {#each THEMES as theme (theme.id)}
            <button
              onclick={() => { selectedTheme = theme.id; }}
              class="text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-all {selectedTheme === theme.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-zinc-400 hover:bg-zinc-700'}"
              title={theme.description}
            >
              {theme.emoji} {theme.name}
            </button>
          {/each}
        </div>
      {/if}
      <div class="flex items-center gap-3 px-4 py-3">
        <svg class="w-5 h-5 text-mint-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 17 3.5s-.3 3.5-1.5 6c3-1 5.5-1.5 5.5-1.5s-1 3.5-4 6c1.5.5 3 .5 3 .5s-2 3-6 3c0 1-1 3-3 3"/></svg>
        <input bind:this={promptInputRef} bind:value={prompt} onkeydown={handleKeydown} onfocus={stopPlaceholderRotation} onblur={startPlaceholderRotation} placeholder={$currentApp ? `Modify "${$currentApp.title}"...` : placeholderText} disabled={$isGenerating} class="flex-1 bg-transparent text-sm text-zinc-100 placeholder-gray-400 outline-none disabled:opacity-50" />
        <!-- UX: Cmd+K hint on desktop -->
        <span class="cmdk-hint hidden sm:inline-flex items-center text-[10px] text-zinc-400 border border-zinc-800 rounded px-1.5 py-0.5 font-mono select-none">⌘K</span>
        <button onclick={handleGenerate} disabled={!prompt.trim() || $isGenerating} class="bg-gray-900 hover:bg-gray-800 disabled:opacity-30 text-white font-medium text-sm px-5 py-2 rounded-full transition-all duration-200">
          {$isGenerating ? '...' : $currentApp ? 'Modify' : 'Create'}
        </button>
      </div>
    </div>
    {#if !$isGenerating}
      <p class="text-center text-[10px] text-zinc-500 mt-2">Apps run locally. Your data never leaves your device.</p>
    {/if}
  </div>
</div>

</div>

<style>
  /* UX: Toast notification */
  .toast-container {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    animation: toast-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .toast-content {
    display: flex;
    align-items: center;
    gap: 8px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 10px 18px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* UX: Error banner */
  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  /* UX: Split-view generating layout */
  .split-view-container {
    height: calc(100vh - 3.5rem - 6rem);
    padding: 0 1rem;
    display: flex;
    flex-direction: column;
  }
  .split-view {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 0;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .split-view-code {
    width: 40%;
    background: #111;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .split-view-preview {
    width: 60%;
    background: #fff;
    border-left: 1px solid #e5e7eb;
    min-height: 0;
  }

  /* UX: Mobile stacking for split view */
  @media (max-width: 767px) {
    .split-view {
      flex-direction: column;
    }
    .split-view-code {
      width: 100%;
      height: 40%;
    }
    .split-view-preview {
      width: 100%;
      height: 60%;
      border-left: none;
      border-top: 1px solid #e5e7eb;
    }
  }

  /* UX: Cmd+K hint styling */
  .cmdk-hint {
    display: none;
  }
  @media (min-width: 640px) {
    .cmdk-hint {
      display: inline-flex;
    }
  }
</style>
