<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { cubicOut } from 'svelte/easing'
  import { UploadCloud, Menu, ChevronRight, RefreshCw } from 'lucide-svelte'

  const dispatch = createEventDispatcher<{
    fileUpload: string
    loadingStart: void
    loadingEnd: void
    error: string
    success: string
    refresh: void
  }>()

  export let isRefreshing = false
  let fileInput: HTMLInputElement | undefined
  let isUploading = false
  let progress = 0
  let isVisible = false

  onMount(() => {
    const stored = localStorage.getItem('ryoiki.toolbar.visible')
    if (stored !== null) {
      isVisible = stored === 'true'
    } else {
      // Default hidden if not stored
      isVisible = false
    }
  })

  function toggle() {
    isVisible = !isVisible
    localStorage.setItem('ryoiki.toolbar.visible', String(isVisible))
  }

  function onWindowKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.altKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault()
      toggle()
    }
  }

  function slideHorizontal(node: HTMLElement, {
    delay = 0,
    duration = 300,
    easing = cubicOut
  } = {}) {
    const style = getComputedStyle(node)
    const opacity = +style.opacity
    const w = parseFloat(style.width)
    const paddingLeft = parseFloat(style.paddingLeft)
    const paddingRight = parseFloat(style.paddingRight)
    const marginLeft = parseFloat(style.marginLeft)
    const marginRight = parseFloat(style.marginRight)
    const borderLeft = parseFloat(style.borderLeftWidth)
    const borderRight = parseFloat(style.borderRightWidth)

    return {
      delay,
      duration,
      easing,
      css: (t: number) => {
        // When t=0 (hidden), width/padding/margin should be 0.
        // When t=1 (shown), they should be full size.
        return `
        overflow: hidden;
        width: ${t * w}px;
        padding-left: ${t * paddingLeft}px;
        padding-right: ${t * paddingRight}px;
        margin-left: ${t * marginLeft}px;
        margin-right: ${t * marginRight}px;
        border-left-width: ${t * borderLeft}px;
        border-right-width: ${t * borderRight}px;
        opacity: ${t * opacity};
        white-space: nowrap;
      `
      }
    }
  }

  function openPicker() {
    fileInput?.click()
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }
  function validateFile(file: File): string | null {
    const nameOk = /\.json$/i.test(file.name) || /\.cc\.json$/i.test(file.name)
    const typeOk = (file.type || '').toLowerCase() === 'application/json'
    if (!nameOk && !typeOk) return 'Invalid file type. Please select a JSON file'
    return null
  }
  function handleSelect(e: Event) {
    const input = e.target as HTMLInputElement
    const f = input.files && input.files[0]
    if (!f) return
    const err = validateFile(f)
    if (err) {
      dispatch('error', err)
      return
    }
    isUploading = true
    progress = 0
    dispatch('loadingStart')
    const reader = new FileReader()
    reader.onprogress = (ev: ProgressEvent<FileReader>) => {
      if (ev.lengthComputable) {
        progress = Math.floor((ev.loaded * 100) / ev.total)
      }
    }
    reader.onerror = () => {
      isUploading = false
      progress = 0
      dispatch('loadingEnd')
      dispatch('error', 'Failed to read file')
    }
    reader.onload = () => {
      try {
        const content = String(reader.result || '')
        JSON.parse(content)
        dispatch('fileUpload', content)
        dispatch('success', 'JSON loaded')
      } catch {
        dispatch('error', 'Invalid JSON content')
      } finally {
        isUploading = false
        progress = 0
        dispatch('loadingEnd')
      }
    }
    reader.readAsText(f)
  }
</script>

<svelte:window on:keydown={onWindowKey} />

<div class="absolute top-2 left-2 z-50">
  <div
    class="flex items-center gap-2 bg-gray-800/70 backdrop-blur-sm text-white rounded-md p-1 shadow-md transition-all duration-300"
    role="toolbar"
    aria-label="Main toolbar"
  >
    <button
      class="p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
      on:click={toggle}
      title={isVisible ? "Hide Toolbar (Ctrl+Alt+T)" : "Show Toolbar (Ctrl+Alt+T)"}
      aria-label={isVisible ? "Hide toolbar" : "Show toolbar"}
      aria-expanded={isVisible}
      aria-controls="main-toolbar-content"
    >
      {#if isVisible}
        <Menu class="h-5 w-5 rotate-90" />
      {:else}
        <Menu class="h-5 w-5" />
      {/if}
    </button>

    {#if isVisible}
      <div transition:slideHorizontal id="main-toolbar-content" class="flex items-center gap-2 pl-2">
                <div class="w-px h-6 bg-gray-600 mx-1"></div>
                <button
                  class="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors disabled:opacity-60 whitespace-nowrap"
                  title="Refresh Data"
                  aria-label="Refresh Data"
                  aria-busy={isRefreshing}
                  on:click={() => dispatch('refresh')}
                  disabled={isRefreshing || isUploading}
                >
                  <RefreshCw class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
                  <span class="text-sm">Refresh</span>
                </button>
                <button
                  class="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors disabled:opacity-60 whitespace-nowrap"
          title="Upload JSON"
          aria-label="Upload JSON"
          aria-busy={isUploading}
          on:click={openPicker}
          on:keydown={onKey}
          disabled={isUploading}
        >
          {#if isUploading}
            <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
            <span class="text-sm">Uploading... {progress}%</span>
          {:else}
            <UploadCloud class="h-4 w-4" />
            <span class="text-sm">Upload</span>
          {/if}
        </button>
      </div>
    {/if}

    <input
      bind:this={fileInput}
      type="file"
      accept=".json,application/json,.cc.json"
      class="hidden"
      on:change={handleSelect}
    />
  </div>
</div>
