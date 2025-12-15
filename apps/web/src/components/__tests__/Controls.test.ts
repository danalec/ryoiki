import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import Controls from '../Controls.svelte'

describe('Controls', () => {
  it('has correct hover state classes', () => {
    const { container } = render(Controls)
    // Select the background layer which has the opacity transition
    const backgroundLayer = container.querySelector('.group > div > div.absolute')

    expect(backgroundLayer).toBeTruthy()
    expect(backgroundLayer?.className).toContain('opacity-70') // Default opacity
    expect(backgroundLayer?.className).toContain('lg:opacity-70') // Desktop default
    expect(backgroundLayer?.className).toContain('lg:group-hover:opacity-100') // Hover state
    expect(backgroundLayer?.className).toContain('transition-opacity')
  })
})
