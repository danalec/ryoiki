import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import Legend from '../Legend.svelte'
import { rectNodes, languageColors } from '../../lib/stores'
import { get } from 'svelte/store'

describe('Legend', () => {
  it('filters out languages with 0 lines of code', async () => {
    // Setup stores
    languageColors.set({
      'rust': '#dea584',
      'javascript': '#f1e05a',
      'python': '#3572a5'
    })

    rectNodes.set([
      {
        path: 'src/main.rs',
        language: 'Rust',
        metrics: { loc: 100, complexity: 1 },
        x: 0, y: 0, width: 10, height: 10, depth: 10
      },
      {
        path: 'src/script.js',
        language: 'JavaScript',
        metrics: { loc: 0, complexity: 0 },
        x: 0, y: 0, width: 10, height: 10, depth: 10
      },
      {
        path: 'src/script.py',
        language: 'Python',
        metrics: { loc: 50, complexity: 1 },
        x: 0, y: 0, width: 10, height: 10, depth: 10
      }
    ])

    const { getByText, queryByText, getByLabelText, container } = render(Legend)

    // Expand the legend
    const toggleButton = getByLabelText('Toggle legend')
    await toggleButton.click()

    // Check visible languages
    // Rust has 100 LOC -> Visible
    expect(getByText('rust')).toBeTruthy()

    // Python has 50 LOC -> Visible
    expect(getByText('python')).toBeTruthy()

    // JavaScript has 0 LOC -> Hidden
    expect(queryByText('javascript')).toBeNull()
  })

  it('has correct hover state classes', () => {
    const { container } = render(Legend)
    // Select the background layer which has the opacity transition
    const backgroundLayer = container.querySelector('.group > div > div.absolute')

    expect(backgroundLayer).toBeTruthy()
    expect(backgroundLayer?.className).toContain('opacity-70') // Default opacity
    expect(backgroundLayer?.className).toContain('lg:opacity-70') // Desktop default
    expect(backgroundLayer?.className).toContain('lg:group-hover:opacity-100') // Hover state
    expect(backgroundLayer?.className).toContain('transition-opacity')
  })
})
