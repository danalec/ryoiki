export type MetricsSummary = {
  totals: { files: number; lines: number; code: number; comments: number }
  advanced: {
    comment_density_pct: number
    cyclomatic_total: number
    cyclomatic_density: number
    abc: { a: number; b: number; c: number; magnitude: number }
    halstead: {
      n1_ops_unique: number
      n2_operands_unique: number
      ops_total: number
      operands_total: number
      volume: number
      difficulty: number
      effort: number
    }
    maintainability_index: number
  }
}

export async function fetchMetricsSummary(): Promise<MetricsSummary | null> {
  try {
    const resp = await fetch('/ryoiki.metrics.json', { cache: 'no-cache' })
    if (!resp.ok) return null
    const data = await resp.json()
    return data as MetricsSummary
  } catch {
    return null
  }
}
