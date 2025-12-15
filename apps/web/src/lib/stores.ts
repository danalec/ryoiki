import { writable, derived } from 'svelte/store'
import type { CodeTree, RectNode, LanguageColors } from '@cc/ui'
import { normalizeLanguage } from './utils'

export const codeTree = writable<CodeTree | null>(null)
export const rectNodes = writable<RectNode[]>([])
export const languageColors = writable<LanguageColors>({})
export const heightScale = writable<number>(1)
export const selectedLanguages = writable<Set<string>>(new Set())
export const excludedFiles = writable<Set<string>>(new Set())
export const hoveredBuilding = writable<RectNode | null>(null)
export const markedNode = writable<RectNode | null>(null)

export const availableLanguages = derived(rectNodes, ($rectNodes) => {
  const languages = new Set<string>()
  for (const node of $rectNodes) {
    const lang = normalizeLanguage(node.language, node.path)
    languages.add(lang)
  }
  return Array.from(languages).sort()
})

export const languageStats = derived(rectNodes, ($rectNodes) => {
  const stats: Record<string, { count: number; loc: number }> = {}
  for (const node of $rectNodes) {
    const lang = normalizeLanguage(node.language, node.path)
    const loc = node.metrics?.loc ?? 0
    if (!stats[lang]) stats[lang] = { count: 0, loc: 0 }
    stats[lang].count += 1
    stats[lang].loc += loc
  }
  return stats
})

export const filteredRectNodes = derived(
  [rectNodes, selectedLanguages, excludedFiles],
  ([$rectNodes, $selectedLanguages, $excludedFiles]) => {
    let nodes = $rectNodes

    // Apply file exclusions
    if ($excludedFiles.size > 0) {
      nodes = nodes.filter(node => {
        const filename = node.path.split('/').pop() || ''
        return !$excludedFiles.has(filename)
      })
    }

    // Apply language filter
    if ($selectedLanguages.size === 0) return nodes
    return nodes.filter(node => $selectedLanguages.has(normalizeLanguage(node.language, node.path)))
  }
)
