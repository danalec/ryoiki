<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { BarChart3, X } from 'lucide-svelte'
  import { metricsOverlayVisible } from '../lib/overlayStore'
  import { fetchMetricsSummary, type MetricsSummary } from '../lib/metrics'
  import { draggable } from '../lib/draggable'
  import Chart from 'chart.js/auto'
  let summary: MetricsSummary | null = null
  let ctxABC: HTMLCanvasElement | undefined
  let ctxCyclo: HTMLCanvasElement | undefined
  let ctxHalstead: HTMLCanvasElement | undefined
  let chartABC: Chart | null = null
  let chartCyclo: Chart | null = null
  let chartHalstead: Chart | null = null
  async function initCharts() {
    if (!summary || !ctxABC || !ctxCyclo || !ctxHalstead) return

    if (chartABC) chartABC.destroy()
    if (chartCyclo) chartCyclo.destroy()
    if (chartHalstead) chartHalstead.destroy()

    const adv = summary.advanced
    chartABC = new Chart(ctxABC, {
      type: 'bar',
      data: {
        labels: ['A', 'B', 'C', 'Magnitude'],
        datasets: [{ label: 'ABC', data: [adv.abc.a, adv.abc.b, adv.abc.c, adv.abc.magnitude], backgroundColor: ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa'] }]
      },
      options: { responsive: true, animation: false }
    })
    chartCyclo = new Chart(ctxCyclo, {
      type: 'doughnut',
      data: {
        labels: ['Total', 'Density x1e-3'],
        datasets: [{ data: [adv.cyclomatic_total, adv.cyclomatic_density * 1000], backgroundColor: ['#ef4444', '#10b981'] }]
      },
      options: { responsive: true, animation: false }
    })
    chartHalstead = new Chart(ctxHalstead, {
      type: 'bar',
      data: {
        labels: ['n1 ops', 'n2 operands', 'ops total', 'operands total', 'volume', 'difficulty', 'effort'],
        datasets: [{ label: 'Halstead', data: [adv.halstead.n1_ops_unique, adv.halstead.n2_operands_unique, adv.halstead.ops_total, adv.halstead.operands_total, adv.halstead.volume, adv.halstead.difficulty, adv.halstead.effort], backgroundColor: '#22d3ee' }]
      },
      options: { responsive: true, animation: false }
    })
  }

  $: if ($metricsOverlayVisible && summary) {
    tick().then(initCharts)
  }

  onMount(async () => {
    summary = await fetchMetricsSummary()
  })

  function close() { metricsOverlayVisible.set(false) }
</script>

{#if $metricsOverlayVisible}
  <div
    class="fixed top-12 left-4 z-40 w-[min(28rem,90vw)] max-h-[90vh] overflow-y-auto bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl text-white"
    role="dialog"
    aria-modal="true"
    aria-label="Code metrics overview"
    use:draggable={{ handle: '.drag-handle', storageKey: 'metrics-overlay-pos' }}
  >
    <div class="drag-handle flex items-center justify-between px-4 py-3 border-b border-gray-700 cursor-grab active:cursor-grabbing touch-none">
      <h2 class="text-lg font-semibold flex items-center gap-2 pointer-events-none">
        <BarChart3 class="h-5 w-5" />
        Metrics
      </h2>
      <button class="p-2 rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Close metrics overlay" on:click={close}>
        <X class="h-4 w-4" />
      </button>
    </div>
    <div class="px-4 py-3 space-y-4">
      {#if summary}
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-800/70 rounded p-3">
            <div class="text-sm text-gray-300 mb-2">Totals</div>
            <div class="text-xs text-gray-400">Files: {summary.totals.files}</div>
            <div class="text-xs text-gray-400">Lines: {summary.totals.lines}</div>
            <div class="text-xs text-gray-400">Code: {summary.totals.code}</div>
            <div class="text-xs text-gray-400">Comments: {summary.totals.comments}</div>
            <div class="text-xs text-gray-400">Comment Density: {summary.advanced.comment_density_pct.toFixed(2)}%</div>
            <div class="text-xs text-gray-400">Maintainability Index: {summary.advanced.maintainability_index.toFixed(2)}</div>
          </div>
          <div class="bg-gray-800/70 rounded p-3">
            <div class="text-sm text-gray-300 mb-2">Cyclomatic</div>
            <canvas bind:this={ctxCyclo} aria-label="Cyclomatic metrics chart"></canvas>
          </div>
        </div>
        <div class="bg-gray-800/70 rounded p-3">
          <div class="text-sm text-gray-300 mb-2">ABC</div>
          <canvas bind:this={ctxABC} aria-label="ABC metrics chart"></canvas>
        </div>
        <div class="bg-gray-800/70 rounded p-3">
          <div class="text-sm text-gray-300 mb-2">Halstead</div>
          <canvas bind:this={ctxHalstead} aria-label="Halstead metrics chart"></canvas>
        </div>
      {:else}
        <div class="text-sm text-gray-300">Metrics not available</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @media (max-width: 640px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
