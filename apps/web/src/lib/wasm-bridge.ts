import type { CodeTree, RectNode, LanguageColors } from '@cc/ui'

let worker: Worker | null = null
let initialized = false

type Pending = { resolve: (v: any) => void; reject: (e: any) => void }
const pending = new Map<number, Pending>()
let nextId = 1

function ensureWorker() {
  if (worker) return
  worker = new Worker(new URL('../workers/analyzer.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (ev: MessageEvent<any>) => {
    const msg = ev.data
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.ok) {
      p.resolve(msg.type === 'init' ? undefined : msg.result)
    } else {
      p.reject(new Error(msg.error))
    }
  }
  worker.onerror = (e) => {
    const errorDetails = e instanceof ErrorEvent ? e.message : 'Unknown WASM Worker error'
    console.error('WASM Worker error:', e)
    for (const [id, p] of pending) {
      p.reject(new Error(`WASM Worker error occurred: ${errorDetails}`))
    }
    pending.clear()
    initialized = false
    worker = null
  }
}

function callWorker(message: any, timeoutMs = 30000): Promise<any> {
  ensureWorker()
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`WASM Worker timed out after ${timeoutMs}ms`))
      }
    }, timeoutMs)

    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v) },
      reject: (e) => { clearTimeout(timer); reject(e) }
    })
    ;(worker as Worker).postMessage({ ...message, id })
  })
}

let initPromise: Promise<void> | null = null

export function isWasmSupported(): boolean {
  try {
    if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
      const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
      if (module instanceof WebAssembly.Module)
          return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
    }
  } catch (e) {
  }
  return false;
}

export async function initializeWasm(): Promise<void> {
  if (!isWasmSupported()) {
    throw new Error('WebAssembly is not supported in this browser.')
  }
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = callWorker({ type: 'init' })
    .then(() => {
      initialized = true
      initPromise = null
    })
    .catch((e) => {
      initPromise = null
      throw e
    })
  return initPromise
}

export async function parseCodeTree(json: string): Promise<CodeTree> {
  if (!initialized) await initializeWasm()
  return callWorker({ type: 'parse', json })
}

export async function layoutTreemap(tree: CodeTree, width: number, height: number): Promise<RectNode[]> {
  if (!initialized) await initializeWasm()
  return callWorker({ type: 'layout', tree, width, height })
}

export async function getLanguageColors(): Promise<LanguageColors> {
  if (!initialized) await initializeWasm()
  return callWorker({ type: 'colors' })
}
