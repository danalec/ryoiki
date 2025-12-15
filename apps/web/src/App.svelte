<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { Scene3D } from './lib/three/scene'
  import { initializeWasm, parseCodeTree, layoutTreemap, getLanguageColors } from './lib/wasm-bridge'
  import { codeTree, rectNodes, languageColors, heightScale, hoveredBuilding, filteredRectNodes } from './lib/stores'
  import FileUpload from './components/FileUpload.svelte'
  import Controls from './components/Controls.svelte'
  import Legend from './components/Legend.svelte'
  import Tooltip from './components/Tooltip.svelte'
  import Toolbar from './components/Toolbar.svelte'
  import MetricsOverlay from './components/MetricsOverlay.svelte'

  let canvasContainer: HTMLDivElement | undefined
  let scene3D: Scene3D | undefined
  let isLoading = false
  let error: string | null = null
  let lastJsonHash: string | null = null
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  let lastLayoutWidth = 0
  let lastLayoutHeight = 0
  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const RESIZE_THRESHOLD = 0.05
  let raycastMoveEnabled = true
  let uploadOverlayVisible = false
  let successMessage: string | null = null
  let isRefreshing = false

  const toBytes = (s: string) => new TextEncoder().encode(s)
  const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')

  const fetchLatest = async () => {
    try {
      isLoading = true
      const resp = await fetch(`/ryoiki.cc.json`)
      if (!resp.ok) {
        console.warn(`Failed to fetch ryoiki.cc.json: ${resp.status} ${resp.statusText}`)
        return
      }
      const content = await resp.text()

      // Validate JSON before proceeding
      try {
        JSON.parse(content)
      } catch (e) {
        console.error("Malformed JSON received:", e)
        error = "Received malformed data from server"
        return
      }

      const digest = await crypto.subtle.digest('SHA-256', toBytes(content))
      const hash = toHex(digest)
      if (hash === lastJsonHash) return
      lastJsonHash = hash
      const tree = await parseCodeTree(content)
      const prune = (n: any): any => {
        if (!n || typeof n !== 'object') return n
        if (typeof n.path === 'string' && n.path.endsWith('Cargo.lock')) return null
        const children = Array.isArray(n.children) ? n.children.map(prune).filter((x) => x) : undefined
        return { ...n, children }
      }
      const pruned = prune(tree)
      codeTree.set(pruned)
      const layoutWidth = Math.max(1, canvasContainer?.clientWidth ?? 500)
      const layoutHeight = Math.max(1, canvasContainer?.clientHeight ?? 500)
      lastLayoutWidth = layoutWidth
      const rects = await layoutTreemap(pruned, layoutWidth, layoutHeight)
      rectNodes.set(rects)
      scene3D?.applyPerformanceProfile(rects.length)
      scene3D?.createBuildings(rects, get(heightScale))

      // Clear error if successful
      error = null
    } catch (err) {
      console.error("Error in fetchLatest:", err)
      error = err instanceof Error ? err.message : 'Failed to update data'
    } finally {
      isLoading = false
    }
  }

  async function handleRefresh() {
    isRefreshing = true
    error = null
    try {
      const res = await fetch('/api/refresh', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Refresh failed: ${res.statusText}`)
      }
      // After successful generation, fetch the latest data
      await fetchLatest()
      successMessage = 'Data refreshed successfully'
      setTimeout(() => (successMessage = null), 2000)
    } catch (err) {
      console.error("Refresh error:", err)
      error = err instanceof Error ? err.message : 'Refresh failed'
    } finally {
      isRefreshing = false
    }
  }

  onMount(() => {
    let running = true

    const setup = async () => {
      try {
        isLoading = true
        await initializeWasm()
        if (!canvasContainer) throw new Error('Canvas container not initialized')
        scene3D = new Scene3D(canvasContainer)

        const colors = await getLanguageColors()
        languageColors.set(colors)
        scene3D.setLanguageColors(colors)
        scene3D.setRaycastOnMouseMove(raycastMoveEnabled, (bd) => {
          hoveredBuilding.set(bd ? bd.metadata : null)
        })

        const animate = () => {
          if (!running) return
          requestAnimationFrame(animate)
          if (document.hidden) return
          if (!raycastMoveEnabled) {
            const hovered = scene3D.getHoveredBuilding()
            if (hovered) {
              hoveredBuilding.set(hovered.metadata)
            } else {
              hoveredBuilding.set(null)
            }
          }

          scene3D.render()
        }
        animate()

        await fetchLatest()
        refreshTimer = setInterval(fetchLatest, 10000)
        const ro = new ResizeObserver(entries => {
          const cr = entries[0]?.contentRect
          if (!cr) return
          const w = Math.max(1, Math.floor(cr.width))
          const h = Math.max(1, Math.floor(cr.height))
          const dw = Math.abs(w - lastLayoutWidth) / Math.max(1, lastLayoutWidth || w)
          const dh = Math.abs(h - lastLayoutHeight) / Math.max(1, lastLayoutHeight || h)
          if (dw < RESIZE_THRESHOLD && dh < RESIZE_THRESHOLD) return
          if (resizeTimer) clearTimeout(resizeTimer)
          resizeTimer = setTimeout(async () => {
            lastLayoutWidth = w
            lastLayoutHeight = h
            const currentTree = get(codeTree)
            if (!currentTree) return
            try {
              const rects = await layoutTreemap(currentTree, w, h)
              rectNodes.set(rects)
              scene3D?.applyPerformanceProfile(rects.length)
              scene3D?.createBuildings(get(filteredRectNodes), get(heightScale))
            } catch {}
          }, 150)
        })
        ro.observe(canvasContainer)
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to initialize application'
        isLoading = false
      }
    }

    setup()

    return () => {
      running = false
      if (scene3D) {
        scene3D.dispose()
      }
      if (refreshTimer) {
        clearInterval(refreshTimer)
      }
    }
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('dragenter', () => {
      uploadOverlayVisible = true
    })
    window.addEventListener('drop', () => {
      uploadOverlayVisible = false
    })
    window.addEventListener('dragleave', () => {
      uploadOverlayVisible = false
    })
  }

  async function handleFileUpload(content: string) {
    isLoading = true
    error = null

    try {
      const tree = await parseCodeTree(content)
      const prune = (n: any): any => {
        if (!n || typeof n !== 'object') return n
        if (typeof n.path === 'string' && n.path.endsWith('Cargo.lock')) return null
        const children = Array.isArray(n.children) ? n.children.map(prune).filter((x) => x) : undefined
        return { ...n, children }
      }
      const pruned = prune(tree)
      codeTree.set(pruned)

      const layoutWidth = Math.max(1, canvasContainer?.clientWidth ?? 500)
      const layoutHeight = Math.max(1, canvasContainer?.clientHeight ?? 500)
      lastLayoutWidth = layoutWidth
      lastLayoutHeight = layoutHeight
      const rects = await layoutTreemap(pruned, layoutWidth, layoutHeight)
      rectNodes.set(rects)
      scene3D?.applyPerformanceProfile(rects.length)

      if (scene3D) {
        scene3D.createBuildings(rects, $heightScale)
      }
      successMessage = 'Project data loaded'
      setTimeout(() => (successMessage = null), 2000)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to process file'
    } finally {
      isLoading = false
    }
  }

  function handleHeightScaleChange(newScale: number) {
    heightScale.set(newScale)
    if (scene3D && $rectNodes.length > 0) {
      scene3D.createBuildings($filteredRectNodes, newScale)
    }
  }

  function handleRotateSpeedChange(newSpeed: number) {
    if (scene3D) {
      scene3D.setRotateSpeed(newSpeed)
    }
  }

  function handleRotateAccelChange(newAccel: number) {
    if (scene3D) {
      scene3D.setRotateAcceleration(newAccel)
    }
  }

  function handleResetCamera() {
    if (scene3D) {
      scene3D.resetCamera()
    }
  }

  function handlePlayPulse() {
    if (!scene3D) return
    scene3D.startPulseAnimation()
  }

  function handlePausePulse() {
    if (!scene3D) return
    scene3D.pausePulseAnimation()
  }

  function handleStopPulse() {
    if (!scene3D) return
    scene3D.stopPulseAnimation()
  }

  function handlePlayRotate() {
    if (!scene3D) return
    scene3D.startRotateAnimation()
  }

  function handlePauseRotate() {
    if (!scene3D) return
    scene3D.pauseRotateAnimation()
  }

  function handleStopRotate() {
    if (!scene3D) return
    scene3D.stopRotateAnimation()
  }

  function handlePulseAmplitudeChange(newAmp: number) {
    if (scene3D) {
      scene3D.setPulseAmplitude(newAmp)
    }
  }

  function handleToggleToon(e: CustomEvent<boolean>) {
    if (scene3D) {
      scene3D.setToonMode(e.detail)
    }
  }

  function handleToggleXray(e: CustomEvent<boolean>) {
    if (scene3D) {
      scene3D.setXRayMode(e.detail)
    }
  }

  function handleToggleTranslate(e: CustomEvent<boolean>) {
    if (scene3D) {
      scene3D.setTranslateMode(e.detail)
    }
  }
  function handleToggleRaycastMove(e: CustomEvent<boolean>) {
    raycastMoveEnabled = e.detail
    if (scene3D) {
      scene3D.setRaycastOnMouseMove(e.detail, (bd) => {
        hoveredBuilding.set(bd ? bd.metadata : null)
      })
    }
  }

  function handleBorderThicknessChange(e: CustomEvent<number>) {
    if (scene3D) {
      scene3D.setBorderThickness(e.detail)
    }
  }

  function handleShadowIntensityChange(e: CustomEvent<number>) {
    if (scene3D) {
      scene3D.setShadowIntensity(e.detail)
    }
  }

  function handleSaturationChange(e: CustomEvent<number>) {
    if (scene3D) {
      scene3D.setSaturation(e.detail)
    }
  }

  $: if (scene3D && $filteredRectNodes.length > 0) {
    scene3D.createBuildings($filteredRectNodes, $heightScale)
  }
</script>

<main class="h-screen w-screen bg-gray-900 relative overflow-hidden">
  {#if error}
    <div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div class="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
        {error}
      </div>
    </div>
  {/if}
  {#if successMessage}
    <div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div class="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
        {successMessage}
      </div>
    </div>
  {/if}

  {#if isLoading}
    <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div class="bg-white rounded-lg p-6 shadow-xl" role="status" aria-live="polite" aria-busy="true">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-700">Loading project data...</p>
      </div>
    </div>
  {/if}

  <div bind:this={canvasContainer} class="w-full h-full"></div>
  <Toolbar
    isRefreshing={isRefreshing}
    on:refresh={handleRefresh}
    on:fileUpload={(e) => handleFileUpload(e.detail)}
    on:loadingStart={() => (isLoading = true)}
    on:loadingEnd={() => (isLoading = false)}
    on:error={(e) => (error = e.detail)}
    on:success={(e) => {
      successMessage = e.detail
      setTimeout(() => (successMessage = null), 2000)
    }}
  />
  <MetricsOverlay />

  {#if uploadOverlayVisible}
    <div class="absolute inset-0 flex items-center justify-center z-30 transition-opacity">
      <FileUpload
        on:fileUpload={(e) => handleFileUpload(e.detail)}
        on:overlayShow={() => (uploadOverlayVisible = true)}
        on:overlayHide={() => (uploadOverlayVisible = false)}
        on:openDialog={() => (uploadOverlayVisible = true)}
        on:cancelDialog={() => (uploadOverlayVisible = false)}
        on:loadingStart={() => (isLoading = true)}
        on:loadingEnd={() => (isLoading = false)}
        on:error={(e) => {
          error = e.detail
          uploadOverlayVisible = true
        }}
      />
    </div>
  {/if}

  {#if $codeTree}
    <Controls
      on:heightScaleChange={(e) => handleHeightScaleChange(e.detail)}
      on:rotateSpeedChange={(e) => handleRotateSpeedChange(e.detail)}
      on:rotateAccelChange={(e) => handleRotateAccelChange(e.detail)}
      on:resetCamera={handleResetCamera}
      on:playPulse={handlePlayPulse}
      on:pausePulse={handlePausePulse}
      on:stopPulse={handleStopPulse}
      on:pulseAmplitudeChange={(e) => handlePulseAmplitudeChange(e.detail)}
      on:playRotate={handlePlayRotate}
      on:pauseRotate={handlePauseRotate}
      on:stopRotate={handleStopRotate}
      on:toggleToon={handleToggleToon}
    on:toggleXray={handleToggleXray}
    on:toggleTranslate={handleToggleTranslate}
    on:toggleRaycastMove={handleToggleRaycastMove}
    on:borderThicknessChange={handleBorderThicknessChange}
    on:shadowIntensityChange={handleShadowIntensityChange}
    on:saturationChange={handleSaturationChange}
  />

    <Legend />

    <Tooltip />
  {/if}
</main>

<style>
  :global(html) {
    overflow: hidden;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter', system-ui, sans-serif;
  }
</style>
