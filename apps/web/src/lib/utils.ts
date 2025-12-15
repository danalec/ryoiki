import { clsx, type ClassValue } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export const LANGUAGE_ALIASES: Record<string, string> = {
  'rs': 'rust',
  'ts': 'typescript',
  'js': 'javascript',
  'py': 'python',
  'yml': 'yaml',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'ps1': 'powershell',
  'pwsh': 'powershell',
  'cs': 'csharp',
  'c#': 'csharp',
  'cpp': 'cpp',
  'c++': 'cpp',
  'rb': 'ruby',
  'kt': 'kotlin',
  'md': 'markdown',
  'unknown': 'default',
  '': 'default'
}

export const EXTENSION_MAP: Record<string, string> = {
  'ts': 'typescript',
  'tsx': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'rs': 'rust',
  'py': 'python',
  'java': 'java',
  'go': 'go',
  'cpp': 'cpp',
  'c': 'c',
  'h': 'c',
  'hpp': 'cpp',
  'cs': 'csharp',
  'php': 'php',
  'rb': 'ruby',
  'kt': 'kotlin',
  'swift': 'swift',
  'scala': 'scala',
  'sh': 'shell',
  'ps1': 'powershell',
  'html': 'html',
  'css': 'css',
  'scss': 'css',
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'toml': 'toml',
  'xml': 'xml',
  'svelte': 'svelte',
  'md': 'markdown',
  'dockerfile': 'docker',
  'sql': 'sql'
}

export function inferLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) return 'default'
  return EXTENSION_MAP[ext] || 'default'
}

export function normalizeLanguage(lang: string | null | undefined, path: string): string {
  let normalized = (lang ?? '').toLowerCase().trim()

  if (LANGUAGE_ALIASES[normalized]) {
    normalized = LANGUAGE_ALIASES[normalized]
  }

  if (normalized === 'default') {
    return inferLanguage(path)
  }

  return normalized
}
