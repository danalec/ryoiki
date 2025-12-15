import init, { parse_cc_json, layout_treemap, get_language_colors } from '@cc/analyzer'

let initialized = false

async function ensureInit() {
  if (initialized) return
  try {
    await init()
    initialized = true
  } catch (e) {
    console.error('[WASM Worker] Failed to initialize WASM module:', e)
    throw e
  }
}

type RequestMessage =
  | { id: number; type: 'init' }
  | { id: number; type: 'parse'; json: string }
  | { id: number; type: 'layout'; tree: any; width: number; height: number }
  | { id: number; type: 'colors' }

type ResponseMessage =
  | { id: number; ok: true; type: 'init' }
  | { id: number; ok: true; type: 'parse'; result: any }
  | { id: number; ok: true; type: 'layout'; result: any[] }
  | { id: number; ok: true; type: 'colors'; result: Record<string, string> }
  | { id: number; ok: false; error: string }

self.onmessage = async (ev: MessageEvent<RequestMessage>) => {
  const msg = ev.data
  try {
    if (msg.type !== 'init') await ensureInit()
    switch (msg.type) {
      case 'init': {
        await ensureInit()
        console.log('[WASM Worker] Initialized successfully')
        const resp: ResponseMessage = { id: msg.id, ok: true, type: 'init' }
        ;(self as any).postMessage(resp)
        break
      }
      case 'parse': {
        const tree = parse_cc_json(msg.json)
        const resp: ResponseMessage = { id: msg.id, ok: true, type: 'parse', result: tree }
        ;(self as any).postMessage(resp)
        break
      }
      case 'layout': {
        const rects = layout_treemap(msg.tree, msg.width, msg.height)
        const resp: ResponseMessage = { id: msg.id, ok: true, type: 'layout', result: rects }
        ;(self as any).postMessage(resp)
        break
      }
      case 'colors': {
        const colors = get_language_colors()
        const result = colors instanceof Map ? Object.fromEntries(colors) : colors
        const resp: ResponseMessage = { id: msg.id, ok: true, type: 'colors', result }
        ;(self as any).postMessage(resp)
        break
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    const resp: ResponseMessage = { id: msg.id, ok: false, error: err }
    ;(self as any).postMessage(resp)
  }
}
