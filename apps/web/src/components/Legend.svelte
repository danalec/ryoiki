<script lang="ts">
  import { languageColors, languageStats } from '../lib/stores'
  import { metricsOverlayVisible } from '../lib/overlayStore'
  import { BarChart3 } from 'lucide-svelte'
  import { slide } from 'svelte/transition'
  import { draggable } from '../lib/draggable'

  let isExpanded = false

  // Filter out languages with 0 lines of code to reduce clutter
  // Sort alphabetically for consistent display
  $: visibleColors = Object.entries($languageColors)
    .filter(([language]) => ($languageStats[language]?.loc ?? 0) > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
</script>

<div
  class="absolute bottom-4 left-4 z-20 group opacity-25 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300"
  use:draggable={{ handle: '.drag-handle', storageKey: 'legend-pos' }}
>
  <div class="relative w-64 rounded-lg shadow-lg lg:shadow-lg lg:group-hover:shadow-xl border border-gray-800 lg:border-gray-800 lg:group-hover:border-gray-600 transition-all duration-300 ease-in-out">
    <!-- Background Layer -->
    <div class="absolute inset-0 bg-gray-900 rounded-lg opacity-70 lg:opacity-70 lg:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 ease-in-out backdrop-blur-sm will-change-[opacity]"></div>

    <!-- Content Layer -->
    <div class="relative z-10 p-4 text-white">
      <div class="flex items-center justify-between mb-3 drag-handle cursor-grab active:cursor-grabbing touch-none">
        <div class="flex items-center">
          <button
            class="p-1 mr-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors pointer-events-auto focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Toggle Metrics"
            on:click|stopPropagation={() => metricsOverlayVisible.update(v => !v)}
            aria-label="Toggle metrics"
          >
            <BarChart3 class="h-5 w-5" />
          </button>
        </div>
        <button
          on:click={() => isExpanded = !isExpanded}
          class="text-gray-300 hover:text-white transition-colors"
          aria-label="Toggle legend"
        >
          <svg
            class="h-5 w-5 transform transition-transform {isExpanded ? 'rotate-180' : ''}"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {#if isExpanded}
        <div class="grid grid-cols-2 gap-2" transition:slide|local={{ duration: 300 }}>
          {#each visibleColors as [language, color] (language)}
            <div class="flex items-center" transition:slide|local={{ duration: 200 }}>
              <div
                class="w-4 h-4 rounded mr-2 border border-gray-700"
                style="background-color: {color}"
              ></div>
              <span class="text-sm text-gray-200 capitalize">{language}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
