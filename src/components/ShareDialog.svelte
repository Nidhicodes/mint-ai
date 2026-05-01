<script lang="ts">
  import type { App } from '../lib/types';
  import { encodeApp, downloadHtml, injectOgMeta } from '../lib/sharing/encode';
  import { createGist } from '../lib/sharing/gist';
  import { saveApp } from '../lib/storage/db';

  interface Props {
    app: App;
    onClose: () => void;
    onAppUpdated?: (app: App) => void;
  }

  let { app = $bindable(), onClose, onAppUpdated }: Props = $props();

  // URL Link state
  let shareUrl = $state('');
  let urlTooLarge = $state(false);
  let copied = $state(false);

  // Gist state
  let githubToken = $state('');
  let gistLoading = $state(false);
  let gistError = $state('');
  let gistUrl = $state('');
  let gistCopied = $state(false);

  // Size limit: 50KB compressed
  const MAX_URL_SIZE = 50 * 1024;
  const TOKEN_STORAGE_KEY = 'mint-ai-github-token';

  // Load token from localStorage on mount
  $effect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        githubToken = stored;
      }
    } catch {
      // localStorage unavailable
    }
  });

  // Generate URL on mount
  $effect(() => {
    try {
      const htmlWithOg = injectOgMeta(app.html, {
        title: app.title,
        description: app.description,
        thumbnail: app.thumbnail,
      });
      const encoded = encodeApp(htmlWithOg);
      if (encoded.length > MAX_URL_SIZE) {
        urlTooLarge = true;
        shareUrl = '';
      } else {
        urlTooLarge = false;
        shareUrl = `${window.location.origin}/share#app=${encoded}`;
      }
    } catch {
      urlTooLarge = true;
      shareUrl = '';
    }
  });

  async function copyToClipboard() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  }

  function saveToken() {
    try {
      if (githubToken.trim()) {
        localStorage.setItem(TOKEN_STORAGE_KEY, githubToken.trim());
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable
    }
  }

  async function handleCreateGist() {
    if (!githubToken.trim()) {
      gistError = 'Please enter a GitHub personal access token.';
      return;
    }

    gistError = '';
    gistLoading = true;

    try {
      saveToken();
      const htmlWithOg = injectOgMeta(app.html, {
        title: app.title,
        description: app.description,
        thumbnail: app.thumbnail,
      });
      const result = await createGist(htmlWithOg, app.title, githubToken.trim());
      gistUrl = result.gistUrl;

      // Update app's shareId in IndexedDB — deep clone to strip Svelte proxies
      const updatedApp: App = JSON.parse(JSON.stringify({ ...app, shareId: result.gistUrl }));
      await saveApp(updatedApp);
      app = updatedApp;
      onAppUpdated?.(updatedApp);
    } catch (err) {
      gistError = err instanceof Error ? err.message : 'An unexpected error occurred.';
    } finally {
      gistLoading = false;
    }
  }

  async function copyGistUrl() {
    if (!gistUrl) return;
    try {
      await navigator.clipboard.writeText(gistUrl);
      gistCopied = true;
      setTimeout(() => { gistCopied = false; }, 2000);
    } catch {
      // Fallback
    }
  }

  function handleDownload() {
    downloadHtml(app.html, app.title);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Modal overlay -->
<div
  class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
  role="dialog"
  aria-label="Share app"
  onclick={handleBackdropClick}
>
  <div class="bg-zinc-900 sm:rounded-2xl rounded-t-2xl rounded-b-none p-6 w-full sm:max-w-lg max-w-full sm:mx-4 mx-0 animate-slide-up max-h-[90vh] overflow-y-auto shadow-xl border border-zinc-800">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-zinc-100">Share &ldquo;{app.title}&rdquo;</h2>
      <button
        onclick={onClose}
        class="text-zinc-500 hover:text-zinc-100 text-sm transition-colors p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-zinc-800"
        aria-label="Close share dialog"
      >
        &times;
      </button>
    </div>

    <!-- URL Link Section -->
    <div class="mb-5">
      <h3 class="text-sm font-medium text-gray-700 mb-2">Link</h3>
      {#if urlTooLarge}
        <p class="text-xs text-zinc-400 bg-gray-50 rounded-lg px-3 py-3 border border-zinc-800">
          App is too large for URL sharing. Try GitHub Gist or Download instead.
        </p>
      {:else}
        <div class="flex gap-2">
          <input
            type="text"
            readonly
            value={shareUrl}
            class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400 outline-none truncate"
          />
          <button
            onclick={copyToClipboard}
            class="shrink-0 px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-all duration-200 {copied
              ? 'bg-mint-500/100 text-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-gray-700'}"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p class="text-[10px] text-zinc-500 mt-1.5">
          Link contains the full app. No server needed.
        </p>
      {/if}
    </div>

    <!-- GitHub Gist Section -->
    <div class="mb-5">
      <h3 class="text-sm font-medium text-gray-700 mb-2">GitHub Gist</h3>
      <div class="bg-gray-50 rounded-lg px-3 py-3 border border-zinc-800">
        {#if gistUrl}
          <!-- Success: show gist URL with copy button -->
          <div class="flex gap-2">
            <input
              type="text"
              readonly
              value={gistUrl}
              class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 outline-none truncate"
            />
            <button
              onclick={copyGistUrl}
              class="shrink-0 px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-all duration-200 {gistCopied
                ? 'bg-mint-500/100 text-white'
                : 'bg-zinc-900 hover:bg-zinc-800 text-gray-700 border border-zinc-800'}"
            >
              {gistCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p class="text-[10px] text-mint-400 mt-1.5">
            Gist created successfully.
          </p>
        {:else}
          <!-- Token input and create button -->
          <div class="space-y-2">
            <label class="block">
              <span class="text-[10px] text-zinc-400 mb-1 block">GitHub Personal Access Token</span>
              <input
                type="password"
                bind:value={githubToken}
                onblur={saveToken}
                placeholder="ghp_xxxxxxxxxxxx"
                class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-700 outline-none focus:border-mint-400 transition-colors placeholder:text-zinc-500"
              />
            </label>
            <p class="text-[10px] text-zinc-500">
              Token needs the <code class="text-zinc-400 bg-gray-100 px-1 rounded">gist</code> scope. Stored locally only.
            </p>
            <button
              onclick={handleCreateGist}
              disabled={gistLoading}
              class="w-full px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed {gistLoading
                ? 'bg-gray-100 text-zinc-500'
                : 'bg-mint-500/10 hover:bg-mint-100 text-mint-400'}"
            >
              {gistLoading ? 'Creating Gist...' : 'Create Gist'}
            </button>
          </div>
        {/if}

        {#if gistError}
          <p class="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
            {gistError}
          </p>
        {/if}
      </div>
    </div>

    <!-- Download Section -->
    <div>
      <h3 class="text-sm font-medium text-gray-700 mb-2">Download</h3>
      <div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-3 border border-zinc-800">
        <div>
          <p class="text-xs text-gray-700">{app.title}.html</p>
          <p class="text-[10px] text-zinc-500 mt-0.5">Standalone HTML file</p>
        </div>
        <button
          onclick={handleDownload}
          class="px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-gray-700 transition-all"
        >
          Download
        </button>
      </div>
    </div>
  </div>
</div>
