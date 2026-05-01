<script lang="ts">
  import type { App, AppVersion } from '../lib/types';
  import { downloadHtml } from '../lib/sharing/encode';
  import { rollbackToVersion } from '../lib/storage/db';
  import VersionHistory from './VersionHistory.svelte';
  import ShareDialog from './ShareDialog.svelte';

  interface Props {
    app: App;
    onBack: () => void;
    onModify: () => void;
    onShare: () => void;
    onFork?: () => void;
    onDelete?: () => void;
    onAppUpdated?: (app: App) => void;
  }

  let { app = $bindable(), onBack, onModify, onShare, onFork, onDelete, onAppUpdated }: Props = $props();

  let iframeRef = $state<HTMLIFrameElement | null>(null);
  let showHistory = $state(false);
  let showDeleteConfirm = $state(false);
  let showShareDialog = $state(false);
  let historyKey = $state(0);

  function timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  }

  function handleExport() {
    downloadHtml(app.html, app.title);
  }

  function handleFullscreen() {
    window.open(
      'data:text/html;charset=utf-8,' + encodeURIComponent(app.html),
      '_blank',
    );
  }

  async function handleRollback(version: AppVersion) {
    const updatedApp = await rollbackToVersion(app.id, version);
    app = updatedApp;
    historyKey++;
    onAppUpdated?.(updatedApp);
  }
</script>

<div class="h-[calc(100vh-3.5rem-6rem)] animate-fade-in flex flex-col">
  <!-- Header bar -->
  <div class="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800">
    <div class="flex items-center gap-3 min-w-0">
      <button
        onclick={onBack}
        class="text-zinc-400 hover:text-zinc-100 text-sm transition-colors shrink-0 min-h-[44px] min-w-[44px] px-2 flex items-center rounded-lg hover:bg-zinc-800"
        aria-label="Back to library"
      >
        &larr; Back
      </button>
      <h1 class="text-sm font-medium text-zinc-100 truncate">{app.title}</h1>
      <span class="text-[10px] text-zinc-500 shrink-0">v{app.version}</span>
    </div>
    <div class="flex items-center gap-0.5 shrink-0 flex-wrap">
      <button
        onclick={onModify}
        class="text-xs text-mint-400 hover:text-mint-400 font-medium px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-mint-500/100/10 transition-all"
      >
        Modify
      </button>
      {#if onFork}
        <button
          onclick={onFork}
          class="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-zinc-800 transition-all"
        >
          Fork
        </button>
      {/if}
      <button
        onclick={() => { showShareDialog = true; }}
        class="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-zinc-800 transition-all"
      >
        Share
      </button>
      <button
        onclick={handleExport}
        class="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-zinc-800 transition-all"
      >
        Export
      </button>
      <button
        onclick={handleFullscreen}
        class="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-zinc-800 transition-all"
      >
        Fullscreen
      </button>
      <button
        onclick={() => { showHistory = !showHistory }}
        class="text-xs px-3 py-2.5 min-h-[44px] rounded-lg transition-all {showHistory
          ? 'text-mint-400 bg-mint-500/10 font-medium'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
      >
        History
      </button>
      {#if onDelete}
        <button
          onclick={() => { showDeleteConfirm = true; }}
          class="text-xs text-zinc-500 hover:text-red-500 px-2.5 py-2.5 min-h-[44px] rounded-lg hover:bg-red-50 transition-all"
          aria-label="Delete app"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Metadata bar -->
  <div class="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      {#if app.description}
        <p class="text-xs text-zinc-400 max-w-xl">{app.description}</p>
      {/if}
      <div class="flex items-center gap-3 text-[10px] text-zinc-500">
        <span>Created {timeAgo(app.createdAt)}</span>
        <span aria-hidden="true">&middot;</span>
        <span>Updated {timeAgo(app.updatedAt)}</span>
      </div>
    </div>
    {#if app.tags.length > 0}
      <div class="flex gap-1.5 flex-wrap mt-2">
        {#each app.tags as tag}
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-mint-500/10 text-mint-400">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Content area -->
  <div class="flex-1 flex min-h-0">
    <iframe
      bind:this={iframeRef}
      srcdoc={app.html}
      sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
      class="flex-1 w-full bg-white {showHistory ? 'rounded-bl-lg' : 'rounded-b-lg'}"
      title="App preview: {app.title}"
    ></iframe>

    {#if showHistory}
      <div class="w-64 shrink-0 bg-white border-l border-zinc-800 overflow-y-auto p-3 rounded-br-lg">
        {#key historyKey}
          <VersionHistory
            appId={app.id}
            currentVersion={app.version}
            onRollback={handleRollback}
          />
        {/key}
      </div>
    {/if}
  </div>
</div>

{#if showShareDialog}
  <ShareDialog app={app} onClose={() => { showShareDialog = false; }} onAppUpdated={onAppUpdated} />
{/if}

{#if showDeleteConfirm}
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm" role="dialog" aria-label="Confirm delete">
    <div class="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 p-6 w-full max-w-sm mx-4 animate-slide-up">
      <h3 class="text-base font-semibold text-zinc-100 mb-2">Delete "{app.title}"?</h3>
      <p class="text-sm text-zinc-400 mb-5">This will permanently remove the app and all its version history. This can't be undone.</p>
      <div class="flex gap-3">
        <button onclick={() => { showDeleteConfirm = false; onDelete?.(); }} class="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium rounded-full py-2.5 text-sm transition-colors">Delete</button>
        <button onclick={() => { showDeleteConfirm = false; }} class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full py-2.5 text-sm transition-colors">Cancel</button>
      </div>
    </div>
  </div>
{/if}
