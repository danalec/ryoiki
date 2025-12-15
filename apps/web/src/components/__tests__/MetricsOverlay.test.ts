import { render, fireEvent } from '@testing-library/svelte'
import { test, expect, vi } from 'vitest'
import MetricsOverlay from '../MetricsOverlay.svelte'
import { metricsOverlayVisible } from '../../lib/overlayStore'

vi.stubGlobal('fetch', vi.fn(async () => ({
  ok: true,
  json: async () => ({
    totals: { files: 1, lines: 10, code: 8, comments: 2 },
    advanced: {
      comment_density_pct: 20,
      cyclomatic_total: 5,
      cyclomatic_density: 0.001,
      abc: { a: 1, b: 2, c: 3, magnitude: 3.74 },
      halstead: { n1_ops_unique: 4, n2_operands_unique: 6, ops_total: 10, operands_total: 12, volume: 100, difficulty: 2.5, effort: 250 },
      maintainability_index: 75.3
    }
  })
})))

test('renders and toggles visibility', async () => {
  metricsOverlayVisible.set(true)
  const r = render(MetricsOverlay)
  expect(r.getByRole('dialog')).toBeTruthy()
  const btn = r.getByLabelText('Close metrics overlay')
  await fireEvent.click(btn)
  metricsOverlayVisible.set(false)
})
