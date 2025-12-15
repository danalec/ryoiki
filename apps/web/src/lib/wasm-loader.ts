// Mock WASM implementation for ryoiki analyzer
// This provides the same interface as the real WASM module

let initialized = false

export async function initWasm(): Promise<any> {
  if (initialized) return

  // Simulate WASM initialization
  await new Promise(resolve => setTimeout(resolve, 100))
  initialized = true
}

export function parse_cc_json(json: string): any {
  if (!initialized) throw new Error('WASM not initialized')

  try {
    const parsed = JSON.parse(json)

    const EXT_LANGUAGE: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript', 'cts': 'typescript', 'mts': 'typescript',
      'js': 'javascript', 'jsx': 'javascript', 'cjs': 'javascript', 'mjs': 'javascript',
      'svelte': 'svelte', 'vue': 'javascript',
      'css': 'css', 'scss': 'css', 'sass': 'css', 'less': 'css',
      'html': 'html', 'htm': 'html',
      'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'toml': 'toml', 'xml': 'xml',
      'rs': 'rust', 'c': 'c', 'h': 'c', 'hh': 'cpp', 'hpp': 'cpp', 'hxx': 'cpp',
      'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
      'py': 'python', 'java': 'java', 'go': 'go', 'rb': 'ruby', 'php': 'php',
      'kt': 'kotlin', 'kts': 'kotlin', 'swift': 'swift', 'cs': 'csharp',
      'scala': 'scala', 'rspec': 'ruby',
      'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'ps1': 'powershell', 'psm1': 'powershell', 'psd1': 'powershell',
      'm': 'objective-c', 'mm': 'objective-cpp',
      'ml': 'ocaml', 'mli': 'ocaml',
      'hs': 'haskell', 'lhs': 'haskell',
      'r': 'r', 'sql': 'sql', 'proto': 'proto', 'graphql': 'graphql', 'gql': 'graphql',
      'tf': 'terraform', 'tfvars': 'terraform', 'hcl': 'hcl',
      'nix': 'nix', 'dart': 'dart', 'elm': 'elm',
      'groovy': 'groovy', 'gradle': 'gradle',
      'md': 'markdown', 'mdx': 'markdown', 'rst': 'restructuredtext',
      'ini': 'ini', 'cfg': 'ini',
      'bat': 'batch', 'cmd': 'batch'
    }

    const KNOWN_BASENAMES: Record<string, string> = {
      'makefile': 'make',
      'dockerfile': 'docker',
      'cmakelists.txt': 'cmake',
      'jenkinsfile': 'groovy',
      'gemfile': 'ruby',
      'rakefile': 'ruby',
      'podfile': 'ruby',
      'vagrantfile': 'ruby',
      'build': 'bazel',
      'workspace': 'bazel'
    }

    const normalize = (s: any): string => {
      const v = (typeof s === 'string' ? s : '').trim().toLowerCase()
      if (!v) return 'unknown'
      if (v === 'c++') return 'cpp'
      if (v === 'c#') return 'csharp'
      if (v === 'objective-c++' || v === 'objc++') return 'objective-cpp'
      if (v === 'objective-c' || v === 'objc' || v === 'objectivec') return 'objective-c'
      return v
    }

    const extOf = (nameOrPath: any): string | null => {
      const s = typeof nameOrPath === 'string' ? nameOrPath : ''
      if (!s) return null
      const base = s.split('/').pop() ?? s
      const idx = base.lastIndexOf('.')
      if (idx === -1 || idx === base.length - 1) return null
      return base.substring(idx + 1).toLowerCase()
    }

    const basenameOf = (nameOrPath: any): string => {
      const s = typeof nameOrPath === 'string' ? nameOrPath : ''
      const base = s.split('/').pop() ?? s
      return base.toLowerCase()
    }

    const detectLanguage = (node: any): string => {
      const provided = normalize(node?.language)
      if (provided && provided !== 'unknown') return provided
      const base = basenameOf(node?.path ?? node?.name)
      const byName = KNOWN_BASENAMES[base]
      if (byName) return normalize(byName)
      const ext = extOf(node?.path ?? node?.name)
      const byExt = ext ? EXT_LANGUAGE[ext] : undefined
      return normalize(byExt) || 'unknown'
    }

    const valueOf = (n: any): number => {
      const own = typeof n?.metrics?.loc === 'number' ? n.metrics.loc : 0
      if (Array.isArray(n?.children) && n.children.length > 0) {
        const sum = n.children.reduce((s: number, c: any) => s + valueOf(c), 0)
        return own > 0 ? own : sum
      }
      return own
    }

    const annotate = (node: any): any => {
      if (!node || typeof node !== 'object') return node
      if (Array.isArray(node.children)) {
        node.children = node.children.map(annotate)
      }
      const kind = (node.kind ?? '').toLowerCase()
      let lang = detectLanguage(node)
      if (kind === 'directory' && Array.isArray(node.children) && node.children.length > 0) {
        const weights = new Map<string, number>()
        for (const c of node.children) {
          const cl = normalize(c?.language)
          const w = valueOf(c)
          weights.set(cl, (weights.get(cl) ?? 0) + w)
        }
        if (weights.size === 1) {
          lang = Array.from(weights.keys())[0]
        } else if (weights.size > 1) {
          let best = 'unknown'
          let bestWeight = 0
          for (const [k, v] of weights.entries()) {
            if (k !== 'unknown' && v > bestWeight) { best = k; bestWeight = v }
          }
          const knownWeights = Array.from(weights.entries()).filter(([k]) => k !== 'unknown')
          if (best === 'unknown' && knownWeights.length > 0) {
            lang = 'mixed'
          } else if (knownWeights.length > 1 && bestWeight === 0) {
            lang = 'mixed'
          } else {
            lang = best
          }
        }
      }
      node.language = lang
      return node
    }

    return annotate(parsed)
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error}`)
  }
}

export function layout_treemap(tree: any, width: number, height: number): any[] {
  if (!initialized) throw new Error('WASM not initialized')

  const rects: any[] = []

  function nodeValue(n: any): number {
    return (n?.metrics?.loc ?? 0) > 0
      ? n.metrics.loc
      : (n?.children?.length ? n.children.reduce((s: number, c: any) => s + nodeValue(c), 0) : 1)
  }

  function layoutNode(node: any, x: number, y: number, w: number, h: number, depth: number = 0) {
    const metrics = node.metrics ?? { loc: nodeValue(node) }
    rects.push({
      x,
      y,
      width: w,
      height: h,
      name: node.name ?? 'node',
      path: node.path ?? '/',
      language: node.language ?? 'unknown',
      metrics,
      depth
    })

    if (!node.children || node.children.length === 0) return

    const total = node.children.reduce((sum: number, c: any) => sum + nodeValue(c), 0) || 1

    let cx = x
    let cy = y

    if (depth % 2 === 0) {
      // Slice horizontally: vary width
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        const ratio = nodeValue(child) / total
        const cw = w * ratio
        layoutNode(child, cx, cy, cw, h, depth + 1)
        cx += cw
      }
    } else {
      // Slice vertically: vary height
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        const ratio = nodeValue(child) / total
        const ch = h * ratio
        layoutNode(child, cx, cy, w, ch, depth + 1)
        cy += ch
      }
    }
  }

  layoutNode(tree, 0, 0, width, height)
  return rects
}

export function get_language_colors(): Record<string, string> {
  if (!initialized) throw new Error('WASM not initialized')

  return {
    'default': '#6b7280',
    'typescript': '#3178c6',
    'javascript': '#f1e05a',
    'rust': '#dea584',
    'python': '#3572A5',
    'java': '#b07219',
    'go': '#00ADD8',
    'cpp': '#f34b7d',
    'c': '#555555',
    'csharp': '#178600',
    'php': '#4F5D95',
    'ruby': '#701516',
    'kotlin': '#A97BFF',
    'swift': '#F05138',
    'scala': '#DC322F',
    'shell': '#89e051',
    'powershell': '#012456',
    'html': '#E34C26',
    'css': '#563d7c',
    'json': '#cccccc',
    'yaml': '#cb171e',
    'toml': '#9c4221',
    'xml': '#9cdcfe',
    'svelte': '#ff3e00',
    'objective-c': '#438eff',
    'objective-cpp': '#6866fb',
    'ocaml': '#ef7a00',
    'haskell': '#5e5086',
    'r': '#198ce7',
    'sql': '#c97b0f',
    'proto': '#b2b7f8',
    'graphql': '#e10098',
    'terraform': '#5c4ee5',
    'hcl': '#3f6',
    'nix': '#7ebae4',
    'dart': '#00B4AB',
    'elm': '#60B5CC',
    'groovy': '#e69f56',
    'gradle': '#02303A',
    'markdown': '#083fa1',
    'restructuredtext': '#4b2f20',
    'ini': '#7d8c7c',
    'batch': '#C1F12E',
    'make': '#427819',
    'docker': '#1D63ED',
    'cmake': '#0CA4C3',
    'bazel': '#006400',
    'unknown': '#cccccc',
    'mixed': '#999999'
  }
}
