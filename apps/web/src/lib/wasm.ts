import init, { parse_cc_json, layout_treemap, get_language_colors } from '@cc/analyzer'
import type { CodeTree, RectNode, LanguageColors } from '@cc/ui'

let wasmInitialized = false

export async function initializeWasm(): Promise<void> {
  if (wasmInitialized) return
  
  try {
    await init()
    wasmInitialized = true
  } catch (error) {
    console.error('Failed to initialize WASM:', error)
    throw error
  }
}

export async function parseCodeTree(json: string): Promise<CodeTree> {
  if (!wasmInitialized) {
    throw new Error('WASM not initialized. Call initializeWasm() first.')
  }
  
  try {
    const result = parse_cc_json(json)
    return result as CodeTree
  } catch (error) {
    console.error('Failed to parse JSON:', error)
    throw error
  }
}

export async function layoutTreemap(tree: CodeTree, width: number, height: number): Promise<RectNode[]> {
  if (!wasmInitialized) {
    throw new Error('WASM not initialized. Call initializeWasm() first.')
  }
  
  try {
    const result = layout_treemap(tree, width, height)
    return result as RectNode[]
  } catch (error) {
    console.error('Failed to layout treemap:', error)
    throw error
  }
}

export async function getLanguageColors(): Promise<LanguageColors> {
  if (!wasmInitialized) {
    throw new Error('WASM not initialized. Call initializeWasm() first.')
  }
  
  try {
    const result = get_language_colors()
    return result as LanguageColors
  } catch (error) {
    console.error('Failed to get language colors:', error)
    throw error
  }
}