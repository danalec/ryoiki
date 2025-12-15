import { onMount } from 'svelte'
import { writable, derived } from 'svelte/store'

type Theme = 'light' | 'dark'

export function useTheme() {
  const theme = writable<Theme>('light')

  const getPreferredTheme = (): Theme => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  const applyTheme = (t: Theme) => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(t)
    localStorage.setItem('theme', t)
  }

  const toggleTheme = () => {
    theme.update((t) => (t === 'light' ? 'dark' : 'light'))
  }

  onMount(() => {
    const t = getPreferredTheme()
    theme.set(t)
    applyTheme(t)
  })

  theme.subscribe((t) => applyTheme(t))

  return {
    theme,
    toggleTheme,
    isDark: derived(theme, (t) => t === 'dark'),
  }
}
