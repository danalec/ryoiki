<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { RotateCcw, Sliders, ChevronDown, Info } from 'lucide-svelte'
  import { heightScale, selectedLanguages, availableLanguages, languageStats } from '../lib/stores'
  import { slide } from 'svelte/transition'
  import { draggable } from '../lib/draggable'

  const dispatch = createEventDispatcher<{
    heightScaleChange: number
    rotateSpeedChange: number
    pulseAmplitudeChange: number
    resetCamera: void
    playPulse: void
    pausePulse: void
    stopPulse: void
    playRotate: void
    pauseRotate: void
    stopRotate: void
    rotateAccelChange: number
    toggleToon: boolean
    toggleTranslate: boolean
    toggleXray: boolean
    toggleRaycastMove: boolean
    borderThicknessChange: number
    shadowIntensityChange: number
    saturationChange: number
  }>()
  let isExpanded = false
  let isLanguageFilterExpanded = false
  let languageQuery = ''
  $: visibleLanguages = $availableLanguages.filter(l => {
    const lower = l.toLowerCase()
    return !['default', 'unknown', 'none'].includes(lower) && lower.includes(languageQuery.toLowerCase())
  })
  let cellShaded = true
  let translateMode = true
  let xrayMode = true
  let raycastOnMouseMove = true
  let rotateSpeed = 1
  let pulseAmplitude = 0.15
  let rotateAccel = 0
  let borderThickness = 0.3
  let shadowIntensity = 0.5
  let saturation = 1.2
  let isAdvancedShadingExpanded = false

  function handleHeightScaleChange(event: Event) {
    const target = event.target as HTMLInputElement
    const value = parseFloat(target.value)
    heightScale.set(value)
    dispatch('heightScaleChange', value)
  }

  function toggleLanguage(language: string) {
    const current = $selectedLanguages
    const updated = new Set(current)

    if (updated.has(language)) {
      updated.delete(language)
    } else {
      updated.add(language)
    }

    selectedLanguages.set(updated)
  }

  function resetCamera() {
    dispatch('resetCamera')
  }

  let pulsePlaying = false
  let rotatePlaying = false

  function pulsePlayPause() {
    pulsePlaying = !pulsePlaying
    dispatch(pulsePlaying ? 'playPulse' : 'pausePulse')
  }

  function pulseStop() {
    pulsePlaying = false
    dispatch('stopPulse')
  }

  function rotatePlayPause() {
    rotatePlaying = !rotatePlaying
    dispatch(rotatePlaying ? 'playRotate' : 'pauseRotate')
  }

  function rotateStop() {
    rotatePlaying = false
    dispatch('stopRotate')
  }

  function toggleToonMode(event: Event) {
    const target = event.target as HTMLInputElement
    cellShaded = target.checked
    dispatch('toggleToon', cellShaded)
  }

  function toggleTranslateMode(event: Event) {
    const target = event.target as HTMLInputElement
    translateMode = target.checked
    dispatch('toggleTranslate', translateMode)
  }

  function toggleXrayMode(event: Event) {
    const target = event.target as HTMLInputElement
    xrayMode = target.checked
    dispatch('toggleXray', xrayMode)
  }

  function toggleRaycastMove(event: Event) {
    const target = event.target as HTMLInputElement
    raycastOnMouseMove = target.checked
    dispatch('toggleRaycastMove', raycastOnMouseMove)
  }

  function onPulseAmplitudeInput(event: Event) {
    const target = event.target as HTMLInputElement
    const value = parseFloat(target.value)
    dispatch('pulseAmplitudeChange', value)
  }

  function onRotateSpeedInput(event: Event) {
    const target = event.target as HTMLInputElement
    const value = parseFloat(target.value)
    dispatch('rotateSpeedChange', value)
  }

  function onRotateAccelInput(event: Event) {
    const target = event.target as HTMLInputElement
    const value = parseFloat(target.value)
    dispatch('rotateAccelChange', value)
  }

  function onBorderThicknessInput(event: Event) {
    const target = event.target as HTMLInputElement
    const value = parseFloat(target.value)
    dispatch('borderThicknessChange', value)
  }

  function onShadowIntensityInput(event: Event) {
    const target = event.target as HTMLInputElement
    const value = parseFloat(target.value)
    dispatch('shadowIntensityChange', value)
  }

  function onSaturationInput(event: Event) {
    const target = event.target as HTMLInputElement
    const value = parseFloat(target.value)
    dispatch('saturationChange', value)
  }

  function selectAll() {
    selectedLanguages.set(new Set(visibleLanguages))
  }

  function selectNone() {
    selectedLanguages.set(new Set())
  }

  // Hover State Logic:
  // - Default: Component opacity 0.25 (faint)
  // - Hover/Focus: Component opacity 1.0 (fully visible)
  // - Background Layer: Fades from 0.7 to 1.0 on hover (inside the component)
  // - Transition: 300ms smooth fade
</script>

<div
  class="absolute top-4 right-4 z-20 group opacity-25 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300"
  use:draggable={{ handle: '.drag-handle', storageKey: 'controls-pos' }}
>
  <div class="relative w-80 rounded-lg shadow-lg lg:shadow-lg lg:group-hover:shadow-xl border border-gray-800 lg:border-gray-800 lg:group-hover:border-gray-600 transition-all duration-300 ease-in-out">
    <!-- Background Layer -->
    <div class="absolute inset-0 bg-gray-900 rounded-lg opacity-70 lg:opacity-70 lg:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 ease-in-out backdrop-blur-sm will-change-[opacity]"></div>

    <!-- Content Layer -->
    <div class="relative z-10 p-4 text-white">
      <div class="flex items-center justify-between mb-4 drag-handle cursor-grab active:cursor-grabbing touch-none">
        <h3 class="text-lg font-semibold text-white flex items-center pointer-events-none">
          <Sliders class="h-5 w-5 mr-2" />
          Controls
        </h3>
        <button
          on:click={() => isExpanded = !isExpanded}
          class="text-gray-300 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors"
          aria-label={isExpanded ? "Collapse controls" : "Expand controls"}
          aria-expanded={isExpanded}
        >
          <ChevronDown
            class="h-5 w-5 transform transition-transform duration-300 {isExpanded ? 'rotate-180' : ''}"
          />
        </button>
      </div>

      {#if isExpanded}
        <div transition:slide={{ duration: 300 }} class="space-y-4">
        <div>
          <label for="heightScale" class="block text-sm font-medium text-gray-200 mb-2">
            Height Scale: {$heightScale.toFixed(1)}x
          </label>
          <input
            id="heightScale"
            type="range"
            min="0.01"
            max="3"
            step="0.1"
            value={$heightScale}
            on:input={handleHeightScaleChange}
            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label class="flex items-center">
            <input type="checkbox" checked={cellShaded} on:change={toggleToonMode} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span class="ml-2 text-sm text-gray-200">Cell Shading</span>
          </label>
          {#if cellShaded}
            <div transition:slide={{ duration: 300 }} class="pl-4 mt-2 border-l-2 border-gray-700 space-y-3">
              <div>
                <label for="borderThickness" class="block text-xs font-medium text-gray-400 mb-1">
                  Border Thickness: {borderThickness.toFixed(1)}
                </label>
                <input
                  id="borderThickness"
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  bind:value={borderThickness}
                  on:input={onBorderThicknessInput}
                  class="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <button
                class="flex items-center justify-between w-full text-xs font-medium text-gray-400 hover:text-white transition-colors pt-1"
                on:click={() => isAdvancedShadingExpanded = !isAdvancedShadingExpanded}
                aria-expanded={isAdvancedShadingExpanded}
              >
                <span>Advanced Settings</span>
                <ChevronDown
                  class="h-3 w-3 transform transition-transform duration-200 {isAdvancedShadingExpanded ? 'rotate-180' : ''}"
                />
              </button>

              {#if isAdvancedShadingExpanded}
                <div transition:slide={{ duration: 200 }} class="space-y-3">
                  <div>
                    <label for="shadowIntensity" class="block text-xs font-medium text-gray-400 mb-1">
                      Shadow Intensity: {shadowIntensity.toFixed(2)}
                    </label>
                    <input
                      id="shadowIntensity"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      bind:value={shadowIntensity}
                      on:input={onShadowIntensityInput}
                      class="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label for="saturation" class="block text-xs font-medium text-gray-400 mb-1">
                      Saturation: {saturation.toFixed(1)}
                    </label>
                    <input
                      id="saturation"
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      bind:value={saturation}
                      on:input={onSaturationInput}
                      class="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div>
          <label class="flex items-center">
            <input type="checkbox" checked={xrayMode} on:change={toggleXrayMode} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span class="ml-2 text-sm text-gray-200">X‑Ray Mode</span>
          </label>
        </div>

        <div>
          <label class="flex items-center">
            <input type="checkbox" checked={raycastOnMouseMove} on:change={toggleRaycastMove} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span class="ml-2 text-sm text-gray-200">Raycast on Mouse Move</span>
            <div class="ml-2 text-gray-400 cursor-help" title="Reduces CPU usage on large datasets by disabling per-frame raycasting; updates hover only while moving the mouse.">
              <Info class="h-4 w-4" />
            </div>
          </label>
        </div>

        <div>
          <label class="flex items-center">
            <input type="checkbox" checked={translateMode} on:change={toggleTranslateMode} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span class="ml-2 text-sm text-gray-200">Translate Mode (Middle Mouse Drag)</span>
          </label>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="btn btn-secondary px-2 py-1 text-xs"
            on:click={pulsePlayPause}
            title={pulsePlaying ? 'Pause' : 'Play'}
            aria-label={pulsePlaying ? 'Pause' : 'Play'}
          >
            {pulsePlaying ? '⏸' : '▶'}
          </button>
          <button
            class="btn btn-secondary px-2 py-1 text-xs"
            on:click={pulseStop}
            title="Stop"
            aria-label="Stop"
          >
            ⏹
          </button>
          <input
            id="pulseAmplitude"
            type="range"
            min="0"
            max="0.8"
            step="0.05"
            bind:value={pulseAmplitude}
            on:input={onPulseAmplitudeInput}
            class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span class="text-sm text-gray-200 w-12 text-right">{pulseAmplitude.toFixed(2)}x</span>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="btn btn-secondary px-2 py-1 text-xs"
            on:click={rotatePlayPause}
            title={rotatePlaying ? 'Pause' : 'Play'}
            aria-label={rotatePlaying ? 'Pause' : 'Play'}
          >
            {rotatePlaying ? '⏸' : '▶'}
          </button>
          <button
            class="btn btn-secondary px-2 py-1 text-xs"
            on:click={rotateStop}
            title="Stop"
            aria-label="Stop"
          >
            ⏹
          </button>
          <input
            id="rotateSpeed"
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            bind:value={rotateSpeed}
            on:input={onRotateSpeedInput}
            class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span class="text-sm text-gray-200 w-12 text-right">{rotateSpeed.toFixed(1)}x</span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-200">Rotation Accel</span>
          <input
            id="rotateAccel"
            type="range"
            min="0"
            max="2"
            step="0.05"
            bind:value={rotateAccel}
            on:input={onRotateAccelInput}
            class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span class="text-sm text-gray-200 w-12 text-right">{rotateAccel.toFixed(2)}</span>
        </div>

        <div class="border-t border-gray-700 pt-4">
          <button
            class="flex items-center justify-between w-full text-sm font-medium text-gray-200 mb-2 hover:text-white transition-colors"
            on:click={() => isLanguageFilterExpanded = !isLanguageFilterExpanded}
            aria-expanded={isLanguageFilterExpanded}
          >
            <span>Language Filter</span>
            <ChevronDown
              class="h-4 w-4 transform transition-transform duration-200 {isLanguageFilterExpanded ? 'rotate-180' : ''}"
            />
          </button>

          {#if isLanguageFilterExpanded}
            <div transition:slide={{ duration: 200 }}>
              <input
                type="text"
                placeholder="Filter languages..."
                bind:value={languageQuery}
                class="w-full mb-2 px-2 py-1 border rounded bg-gray-800 text-white border-gray-700 placeholder-gray-400 text-sm"
              />
              <div class="flex gap-2 mb-2">
                <button class="btn btn-secondary text-xs py-1 flex-1" on:click={selectAll}>Select All</button>
                <button class="btn btn-secondary text-xs py-1 flex-1" on:click={selectNone}>Select None</button>
              </div>
              <div class="max-h-32 overflow-y-auto space-y-2 pr-1">
                {#each visibleLanguages as language (language)}
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      checked={$selectedLanguages.has(language)}
                      on:change={() => toggleLanguage(language)}
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3 w-3"
                      disabled={!$languageStats[language] || $languageStats[language].count === 0}
                    />
                    <span class="ml-2 text-sm text-gray-200 capitalize">{language} ({$languageStats[language]?.count ?? 0})</span>
                  </label>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <button
          on:click={resetCamera}
          class="w-full btn btn-secondary flex items-center justify-center"
        >
          <RotateCcw class="h-4 w-4 mr-2" />
          Reset Camera
        </button>


      </div>
    {/if}
    </div>
  </div>
</div>
