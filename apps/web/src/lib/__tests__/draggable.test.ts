import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { draggable } from '../draggable'

describe('draggable action', () => {
  let element: HTMLElement
  let handle: HTMLElement
  let storageGet: any
  let storageSet: any

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {}
    storageGet = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key])
    storageSet = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      store[key] = value
    })

    // Setup DOM
    element = document.createElement('div')
    handle = document.createElement('div')
    handle.className = 'handle'
    element.appendChild(handle)
    document.body.appendChild(element)

    // Mock layout
    Object.defineProperty(element, 'offsetWidth', { value: 100, configurable: true })
    Object.defineProperty(element, 'offsetHeight', { value: 100, configurable: true })
    element.getBoundingClientRect = vi.fn(() => ({
      left: 10,
      top: 10,
      width: 100,
      height: 100,
      right: 110,
      bottom: 110,
      x: 10,
      y: 10,
      toJSON: () => {}
    })) as any

    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
  })

  afterEach(() => {
    document.body.removeChild(element)
    vi.restoreAllMocks()
  })

  it('initializes correctly', () => {
    draggable(element, { handle: '.handle' })
    expect(element.style.position).toBe('fixed')
    expect(element.classList.contains('draggable-panel')).toBe(true)
    expect(handle.style.cursor).toBe('grab')
  })

  it('loads position from storage', () => {
    storageGet.mockReturnValue(JSON.stringify({ x: 50, y: 60 }))
    draggable(element, { handle: '.handle', storageKey: 'test-key' })

    expect(element.style.left).toBe('50px')
    expect(element.style.top).toBe('60px')
  })

  it('drags element on mouse move', () => {
    draggable(element, { handle: '.handle' })

    // Mouse down on handle
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 20, clientY: 20, bubbles: true }))

    // Mouse move on window
    // Start was at (10, 10), click at (20, 20) -> offset (10, 10)
    // Move to (50, 50) -> new pos (40, 40)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }))

    expect(element.style.left).toBe('40px')
    expect(element.style.top).toBe('40px')
    expect(handle.style.cursor).toBe('grabbing')
  })

  it('respects boundaries', () => {
    draggable(element, { handle: '.handle', boundary: true })

    // Mouse down
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 20, clientY: 20, bubbles: true }))

    // Move way out of bounds
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 9999, clientY: 9999 }))

    // Max X = 1024 - 100 = 924
    // Max Y = 768 - 100 = 668
    expect(element.style.left).toBe('924px')
    expect(element.style.top).toBe('668px')
  })

  it('saves position on drag end', () => {
    draggable(element, { handle: '.handle', storageKey: 'test-key' })

    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 20, clientY: 20, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }))
    window.dispatchEvent(new MouseEvent('mouseup'))

    expect(storageSet).toHaveBeenCalledWith('test-key', JSON.stringify({ x: 40, y: 40 }))
  })

  it('moves with keyboard', () => {
    draggable(element, { handle: '.handle' })

    // Initial position (10, 10) from getBoundingClientRect mock

    // Press ArrowRight
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))

    // Should move by 20px -> 10 + 20 = 30px
    expect(element.style.left).toBe('30px')
    expect(element.style.top).toBe('10px')
  })
})
