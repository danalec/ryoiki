export interface DraggableOptions {
  handle?: string
  storageKey?: string
  boundary?: boolean
}

let globalZIndex = 50

export function draggable(node: HTMLElement, options: DraggableOptions = {}) {
  let { handle, storageKey, boundary = true } = options

  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let isDragging = false

  const handleEl = handle ? node.querySelector(handle) as HTMLElement : node
  if (!handleEl) return

  // Initialize styles
  node.style.position = 'fixed'
  node.classList.add('draggable-panel')
  handleEl.style.cursor = 'grab'
  handleEl.style.touchAction = 'none' // Prevent scrolling on touch

  // Accessibility
  if (!handleEl.getAttribute('tabindex')) {
    handleEl.setAttribute('tabindex', '0')
  }
  handleEl.setAttribute('aria-grabbed', 'false')
  handleEl.setAttribute('role', 'button')
  handleEl.setAttribute('aria-label', 'Drag to move panel')

  // Load persisted position or initial
  if (storageKey) {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        x = parsed.x
        y = parsed.y

        // Initial boundary check in case window size changed
        if (boundary) {
          const maxX = window.innerWidth - node.offsetWidth
          const maxY = window.innerHeight - node.offsetHeight
          x = Math.min(Math.max(0, x), maxX)
          y = Math.min(Math.max(0, y), maxY)
        }

        node.style.left = `${x}px`
        node.style.top = `${y}px`
        node.style.right = 'auto'
        node.style.bottom = 'auto'
      } else {
        // Initialize from computed style if no storage
        const rect = node.getBoundingClientRect()
        x = rect.left
        y = rect.top
        // We don't set style here, allowing CSS to define initial position until first drag
      }
    } catch (e) {
      console.warn('Failed to load draggable position', e)
    }
  } else {
    const rect = node.getBoundingClientRect()
    x = rect.left
    y = rect.top
  }

  function handleDown(e: MouseEvent | TouchEvent) {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    // Ignore clicks on buttons/interactive elements within handle
    if ((e.target as HTMLElement).closest('button, a, input')) return

    isDragging = true

    // Refresh rect in case of resize or initial CSS positioning
    const rect = node.getBoundingClientRect()
    // If we haven't set x/y yet (first drag), sync them
    if (node.style.left === '' || node.style.left === 'auto') {
        x = rect.left
        y = rect.top
    }

    startX = clientX - rect.left
    startY = clientY - rect.top

    handleEl.style.cursor = 'grabbing'
    node.style.userSelect = 'none'
    node.style.zIndex = `${++globalZIndex}` // Bring to front
    node.style.transition = 'none' // Disable transition during drag
    node.style.opacity = '0.9'
    node.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)' // Enhanced shadow

    // Ensure we are now using left/top for positioning
    node.style.left = `${x}px`
    node.style.top = `${y}px`
    node.style.right = 'auto'
    node.style.bottom = 'auto'

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchend', handleUp)
  }

  function handleMove(e: MouseEvent | TouchEvent) {
    if (!isDragging) return
    e.preventDefault() // Prevent scrolling on mobile

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    let newX = clientX - startX
    let newY = clientY - startY

    // Boundary constraints
    if (boundary) {
      const maxX = window.innerWidth - node.offsetWidth
      const maxY = window.innerHeight - node.offsetHeight
      newX = Math.min(Math.max(0, newX), maxX)
      newY = Math.min(Math.max(0, newY), maxY)
    }

    // Collision detection (basic)
    const panels = document.querySelectorAll('.draggable-panel')
    let collision = false
    const rect = { left: newX, top: newY, right: newX + node.offsetWidth, bottom: newY + node.offsetHeight }

    panels.forEach(panel => {
      if (panel === node) return
      const other = panel.getBoundingClientRect()
      // Simple AABB collision
      if (rect.left < other.right && rect.right > other.left &&
          rect.top < other.bottom && rect.bottom > other.top) {
        collision = true
      }
    })

    if (collision) {
      node.style.borderColor = 'rgba(239, 68, 68, 0.8)' // Red warning on overlap
    } else {
      node.style.borderColor = ''
    }

    x = newX
    y = newY
    node.style.left = `${x}px`
    node.style.top = `${y}px`

    // Clear right/bottom to ensure left/top take precedence
    node.style.right = 'auto'
    node.style.bottom = 'auto'
  }

  function handleUp() {
    isDragging = false
    handleEl.style.cursor = 'grab'
    node.style.userSelect = ''
    // Keep zIndex high to stay on top
    node.style.opacity = ''
    node.style.boxShadow = ''
    node.style.borderColor = ''

    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify({ x, y }))
    }

    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('touchmove', handleMove)
    window.removeEventListener('mouseup', handleUp)
    window.removeEventListener('touchend', handleUp)
  }

  handleEl.addEventListener('mousedown', handleDown)
  handleEl.addEventListener('touchstart', handleDown)
  handleEl.addEventListener('keydown', handleKey)

  function handleKey(e: KeyboardEvent) {
    const step = 20
    let dx = 0
    let dy = 0

    switch(e.key) {
      case 'ArrowLeft': dx = -step; break
      case 'ArrowRight': dx = step; break
      case 'ArrowUp': dy = -step; break
      case 'ArrowDown': dy = step; break
      default: return
    }

    e.preventDefault()

    // Ensure current x/y are set
    if (node.style.left === '' || node.style.left === 'auto') {
      const rect = node.getBoundingClientRect()
      x = rect.left
      y = rect.top
    }

    let newX = x + dx
    let newY = y + dy

    if (boundary) {
      const maxX = window.innerWidth - node.offsetWidth
      const maxY = window.innerHeight - node.offsetHeight
      newX = Math.min(Math.max(0, newX), maxX)
      newY = Math.min(Math.max(0, newY), maxY)
    }

    x = newX
    y = newY
    node.style.left = `${x}px`
    node.style.top = `${y}px`
    node.style.right = 'auto'
    node.style.bottom = 'auto'

    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify({ x, y }))
    }
  }

  return {
    destroy() {
      handleEl.removeEventListener('mousedown', handleDown)
      handleEl.removeEventListener('touchstart', handleDown)
      handleEl.removeEventListener('keydown', handleKey)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchend', handleUp)
    }
  }
}
