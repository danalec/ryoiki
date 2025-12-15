<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Upload } from 'lucide-svelte'

  const dispatch = createEventDispatcher<{
    fileUpload: string
    overlayShow: void
    overlayHide: void
    openDialog: void
    cancelDialog: void
    error: string
    loadingStart: void
    loadingEnd: void
  }>()
  let isDragging = false
  let fileInput: HTMLInputElement
  let isDialogOpen = false
  let dialogMonitor: any = null

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    isDragging = true
    dispatch('overlayShow')
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    isDragging = false
    dispatch('overlayHide')
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragging = false
    dispatch('overlayHide')

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement
    const files = target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    } else {
      isDialogOpen = false
      dispatch('cancelDialog')
      dispatch('overlayHide')
    }
  }

  async function handleFile(file: File) {
    const isJsonExt = /\.cc\.json$/i.test(file.name)
    const isJsonMime = (file.type || '').toLowerCase() === 'application/json'
    if (!isJsonExt && !isJsonMime) {
      dispatch('error', 'Invalid file type. Please select a .cc.json file')
      return
    }

    try {
      dispatch('loadingStart')
      const content = await file.text()
      dispatch('fileUpload', content)
      dispatch('loadingEnd')
      isDialogOpen = false
      dispatch('overlayHide')
    } catch (error) {
      dispatch('loadingEnd')
      dispatch('error', 'Failed to read file')
    }
  }

  function openFilePicker() {
    fileInput.click()
    isDialogOpen = true
    dispatch('openDialog')
    dispatch('overlayShow')
    const monitor = () => {
      if (!isDialogOpen) return
      if (!fileInput.files || fileInput.files.length === 0) {
        isDialogOpen = false
        dispatch('cancelDialog')
        dispatch('overlayHide')
      }
      dialogMonitor = null
    }
    dialogMonitor = setTimeout(monitor, 800)
  }
</script>

<div
  class="bg-white rounded-lg shadow-xl p-8 max-w-md mx-auto border-2 transition-all duration-200 {isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 border-dashed'}"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  role="button"
  aria-label="Upload .cc.json by drag and drop"
  aria-busy={isDialogOpen}
  aria-live="polite"
  tabindex="0"
>
  <div class="text-center">
    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4 animate-pulse">
      <Upload class="h-6 w-6 text-blue-600" />
    </div>
    <h3 class="text-lg font-medium text-gray-900 mb-2">Upload ryoiki Data</h3>
    <p class="text-gray-500 mb-4">Drag and drop your .cc.json file here, or click to browse</p>
    <button on:click={openFilePicker} class="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
      Choose File
    </button>
    <input bind:this={fileInput} type="file" accept=".cc.json,application/json" on:change={handleFileSelect} class="hidden" />
  </div>
</div>
