<script lang="ts">
  import type { App } from '../lib/types';
  import { searchApps } from '../lib/search';

  interface Props {
    apps: App[];
    onFilteredApps: (filtered: App[]) => void;
  }

  let { apps, onFilteredApps }: Props = $props();

  let searchInput = $state('');
  let selectedTag = $state<string | null>(null);
  let debounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let debouncedQuery = $state('');

  // Derive unique tags from all apps
  let allTags = $derived<string[]>(
    [...new Set(apps.flatMap((app) => app.tags))].sort(),
  );

  // Debounce search input
  function handleInput(value: string) {
    searchInput = value;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedQuery = searchInput;
    }, 300);
  }

  function toggleTag(tag: string) {
    selectedTag = selectedTag === tag ? null : tag;
  }

  // Run filter whenever debouncedQuery, selectedTag, or apps change
  $effect(() => {
    const filtered = searchApps(apps, debouncedQuery, selectedTag);
    onFilteredApps(filtered);
  });
</script>

<div class="space-y-3">
  <!-- Search input -->
  <div class="relative">
    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input
      type="text"
      value={searchInput}
      oninput={(e) => handleInput(e.currentTarget.value)}
      placeholder="Search apps..."
      aria-label="Search apps"
      class="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-mint-400 focus:ring-1 focus:ring-mint-400/20 transition-all shadow-sm"
    />
  </div>

  <!-- Tag filter chips -->
  {#if allTags.length > 0}
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
      {#each allTags as tag (tag)}
        <button
          onclick={() => toggleTag(tag)}
          class="text-xs px-3 py-2 min-h-[44px] rounded-full transition-all duration-200 {selectedTag === tag
            ? 'bg-mint-50 text-mint-700 border border-mint-300 font-medium'
            : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 shadow-sm'}"
          aria-pressed={selectedTag === tag}
        >
          {tag}
        </button>
      {/each}
    </div>
  {/if}
</div>
