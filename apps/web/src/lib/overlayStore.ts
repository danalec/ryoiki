import { writable } from 'svelte/store'

const KEY = 'ryoiki.metrics.overlay.visible.v1'
function getInitial(): boolean {
  if (typeof localStorage === 'undefined') return true
  const v = localStorage.getItem(KEY)
  if (v === null) return true // Default to true if not set
  return v === 'true'
}
export const metricsOverlayVisible = writable<boolean>(getInitial())
metricsOverlayVisible.subscribe((v) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, v ? 'true' : 'false')
    }
  } catch {}
})
