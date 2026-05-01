<script lang="ts">
  import type { AppVersion } from '../lib/types';
  import { getHistory } from '../lib/storage/db';

  interface Props {
    appId: string;
    currentVersion: number;
    onRollback: (version: AppVersion) => void;
  }

  let { appId, currentVersion, onRollback }: Props = $props();

  let versions = $state<AppVersion[]>([]);

  /**
   * Returns a human-readable relative time string (e.g., "2 hours ago", "3 days ago").
   */
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

  async function loadHistory() {
    const history = await getHistory(appId);
    // Sort by version descending (newest first)
    versions = history.sort((a, b) => b.version - a.version);
  }

  $effect(() => {
    if (appId) {
      loadHistory();
    }
  });
</script>

<div class="flex flex-col gap-1">
  <h3 class="font-serif text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Version History</h3>

  {#if versions.length === 0}
    <p class="text-xs text-gray-400">No version history yet.</p>
  {:else}
    <div class="relative">
      <!-- Vertical timeline line -->
      <div class="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200"></div>

      <div class="flex flex-col gap-3">
        {#each versions as ver (ver.version)}
          {@const isCurrent = ver.version === currentVersion}
          <div class="relative flex items-start gap-3 pl-5">
            <!-- Timeline dot -->
            <div
              class="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 transition-colors {isCurrent
                ? 'bg-mint-500 border-mint-500'
                : 'bg-white border-gray-300'}"
            ></div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium {isCurrent ? 'text-mint-600' : 'text-gray-700'}">
                  v{ver.version}
                </span>
                {#if isCurrent}
                  <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-mint-50 text-mint-600 font-medium">
                    current
                  </span>
                {/if}
                <span class="text-[10px] text-gray-400">{timeAgo(ver.timestamp)}</span>
              </div>
              <p class="text-[11px] text-gray-400 truncate mt-0.5">{ver.prompt}</p>

              {#if !isCurrent}
                <button
                  onclick={() => onRollback(ver)}
                  class="mt-1 text-[10px] text-mint-600 hover:text-mint-700 transition-colors min-h-[44px] min-w-[44px] flex items-center font-medium"
                >
                  &larrhk; Rollback
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
