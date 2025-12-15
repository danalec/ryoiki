<script lang="ts">
  import { hoveredBuilding } from '../lib/stores'
  import { Code } from 'lucide-svelte'

  let tooltipElement: HTMLDivElement
  let mouseX = 0
  let mouseY = 0

  function handleMouseMove(e: MouseEvent) {
    mouseX = e.clientX
    mouseY = e.clientY
  }

  $: if ($hoveredBuilding && tooltipElement) {
    const tooltipWidth = tooltipElement.offsetWidth
    const tooltipHeight = tooltipElement.offsetHeight
    
    let left = mouseX + 10
    let top = mouseY - tooltipHeight - 10
    
    if (left + tooltipWidth > window.innerWidth) {
      left = mouseX - tooltipWidth - 10
    }
    
    if (top < 0) {
      top = mouseY + 10
    }
    
    tooltipElement.style.left = `${left}px`
    tooltipElement.style.top = `${top}px`
  }
</script>

<svelte:window on:mousemove={handleMouseMove} />

{#if $hoveredBuilding}
  <div
    bind:this={tooltipElement}
    class="fixed z-50 bg-black bg-opacity-80 text-white p-3 rounded-lg shadow-lg max-w-xs pointer-events-none transition-opacity duration-200"
  >
    <div class="flex items-start mb-2">
      <Code class="h-4 w-4 mr-2 mt-0.5 text-gray-300" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-white truncate" title={$hoveredBuilding.path}>
          {$hoveredBuilding.path}
        </p>
      </div>
    </div>
    
    <div class="space-y-1 text-xs text-gray-300">
      <div class="flex justify-between">
        <span>Language:</span>
        <span class="capitalize">{$hoveredBuilding.language}</span>
      </div>
      
      <div class="flex justify-between">
        <span>Lines of Code:</span>
        <span>{$hoveredBuilding.metrics.loc.toLocaleString()}</span>
      </div>
      
      {#if $hoveredBuilding.metrics.complexity}
        <div class="flex justify-between">
          <span>Complexity:</span>
          <span>{$hoveredBuilding.metrics.complexity}</span>
        </div>
      {/if}
      
      {#if $hoveredBuilding.metrics.functions}
        <div class="flex justify-between">
          <span>Functions:</span>
          <span>{$hoveredBuilding.metrics.functions}</span>
        </div>
      {/if}
    </div>
    
    <div class="absolute -bottom-1 left-4 w-2 h-2 bg-black bg-opacity-80 transform rotate-45"></div>
  </div>
{/if}