type EasingFn = (t: number) => number

const easings: Record<string, EasingFn> = {
  linear: t => t,
  inOutQuint: t => (t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * Math.pow(t - 1, 5)),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
}

export function stagger(step: number, opts?: { from?: 'center' | number }) {
  return (i: number, total: number) => {
    if (opts?.from === 'center') {
      const c = (total - 1) / 2
      return Math.abs(i - c) * step
    }
    if (typeof opts?.from === 'number') {
      return Math.abs(i - opts.from) * step
    }
    return i * step
  }
}

type PV = number | { from?: number; to?: number }

type AnimateProps = {
  position?: { x?: PV; y?: PV; z?: PV }
  rotation?: { x?: PV; y?: PV; z?: PV }
  scale?: { x?: PV; y?: PV; z?: PV }
  duration?: number
  delay?: number | ((i: number, total: number) => number)
  ease?: string | EasingFn
  loop?: boolean
  alternate?: boolean
}

function resolve(val: PV, current: number) {
  if (typeof val === 'number') return { from: current, to: val }
  const f = val?.from ?? current
  const t = val?.to ?? current
  return { from: f, to: t }
}

export function animate(targets: any[], props: AnimateProps) {
  const total = targets.length
  const duration = props.duration ?? 1000
  const ease: EasingFn = typeof props.ease === 'function' ? props.ease : easings[props.ease ?? 'linear']
  const delays = targets.map((_, i) => (typeof props.delay === 'function' ? props.delay(i, total) : props.delay ?? 0))
  const start = performance.now()
  let dir = 1
  let stopped = false

  const fromTo = targets.map(t => {
    const p = t.position
    const r = t.rotation
    const s = t.scale
    return {
      position: {
        x: props.position?.x ? resolve(props.position.x, p.x) : undefined,
        y: props.position?.y ? resolve(props.position.y, p.y) : undefined,
        z: props.position?.z ? resolve(props.position.z, p.z) : undefined
      },
      rotation: {
        x: props.rotation?.x ? resolve(props.rotation.x, r.x) : undefined,
        y: props.rotation?.y ? resolve(props.rotation.y, r.y) : undefined,
        z: props.rotation?.z ? resolve(props.rotation.z, r.z) : undefined
      },
      scale: {
        x: props.scale?.x ? resolve(props.scale.x, s.x) : undefined,
        y: props.scale?.y ? resolve(props.scale.y, s.y) : undefined,
        z: props.scale?.z ? resolve(props.scale.z, s.z) : undefined
      }
    }
  })

  function setVal(obj: any, key: string, cfg: { from: number; to: number }, u: number) {
    const v = cfg.from + (cfg.to - cfg.from) * u
    obj[key] = v
  }

  function frame(now: number) {
    if (stopped) return
    let done = 0
    for (let i = 0; i < targets.length; i++) {
      const d = delays[i]
      const t = Math.max(0, Math.min(1, (now - start - d) / duration))
      const u = ease(props.alternate && dir < 0 ? 1 - t : t)
      const cfg = fromTo[i]
      const targ = targets[i]
      if (cfg.position?.x) setVal(targ.position, 'x', cfg.position.x, u)
      if (cfg.position?.y) setVal(targ.position, 'y', cfg.position.y, u)
      if (cfg.position?.z) setVal(targ.position, 'z', cfg.position.z, u)
      if (cfg.rotation?.x) setVal(targ.rotation, 'x', cfg.rotation.x, u)
      if (cfg.rotation?.y) setVal(targ.rotation, 'y', cfg.rotation.y, u)
      if (cfg.rotation?.z) setVal(targ.rotation, 'z', cfg.rotation.z, u)
      if (cfg.scale?.x) setVal(targ.scale, 'x', cfg.scale.x, u)
      if (cfg.scale?.y) setVal(targ.scale, 'y', cfg.scale.y, u)
      if (cfg.scale?.z) setVal(targ.scale, 'z', cfg.scale.z, u)
      if (t === 1) done++
    }
    if (done === targets.length) {
      if (props.alternate) dir *= -1
      if (props.loop || props.alternate) {
        for (let i = 0; i < targets.length; i++) delays[i] += duration
        requestAnimationFrame(frame)
      }
    } else {
      requestAnimationFrame(frame)
    }
  }

  requestAnimationFrame(frame)

  return {
    stop() {
      stopped = true
    }
  }
}
