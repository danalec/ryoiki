import { vi } from 'vitest'

// Mock Web Animations API for Svelte transitions in JSDOM
Element.prototype.animate = vi.fn().mockImplementation(() => ({
  finished: Promise.resolve(),
  onfinish: null,
  cancel: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  reverse: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))
