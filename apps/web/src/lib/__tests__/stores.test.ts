import { get } from 'svelte/store'
import { describe, it, expect } from 'vitest'
import { rectNodes, selectedLanguages, excludedFiles, filteredRectNodes } from '../stores'
import type { RectNode } from '@cc/ui'

describe('filteredRectNodes', () => {
  const mockNodes: RectNode[] = [
    { path: '/src/main.rs', language: 'Rust', metrics: { loc: 100 } } as any,
    { path: '/src/lib.rs', language: 'Rust', metrics: { loc: 50 } } as any,
    { path: '/Cargo.lock', language: 'TOML', metrics: { loc: 200 } } as any,
    { path: '/README.md', language: 'Markdown', metrics: { loc: 10 } } as any,
  ]

  it('should return all nodes when no filters are active', () => {
    rectNodes.set(mockNodes)
    selectedLanguages.set(new Set())
    excludedFiles.set(new Set())

    const result = get(filteredRectNodes)
    expect(result).toHaveLength(4)
  })

  it('should exclude files present in excludedFiles', () => {
    rectNodes.set(mockNodes)
    selectedLanguages.set(new Set())
    excludedFiles.set(new Set(['README.md']))

    const result = get(filteredRectNodes)
    expect(result).toHaveLength(3)
    expect(result.find(n => n.path === '/README.md')).toBeUndefined()
  })

  it('should filter by selected languages', () => {
    rectNodes.set(mockNodes)
    excludedFiles.set(new Set())
    selectedLanguages.set(new Set(['rust'])) // normalizeLanguage lowercases

    const result = get(filteredRectNodes)
    expect(result).toHaveLength(2)
    expect(result.every(n => n.language === 'Rust')).toBe(true)
  })

  it('should apply both exclusion and language filters', () => {
    rectNodes.set(mockNodes)
    excludedFiles.set(new Set(['README.md']))
    selectedLanguages.set(new Set(['markdown']))

    const result = get(filteredRectNodes)
    expect(result).toHaveLength(0)
  })
})
