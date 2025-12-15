import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import type { RectNode, BuildingData } from '@cc/ui'
import { animate, stagger } from '../anim'
import { normalizeLanguage } from '../utils'

const SaturationShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 grayColor = vec3(gray);
      gl_FragColor = vec4(mix(grayColor, color.rgb, saturation), color.a);
    }
  `
}

const OutlineShader = {
  uniforms: {
    thickness: { value: 2.0 },
    color: { value: new THREE.Color(1, 1, 1) }
  },
  vertexShader: `
    attribute mat4 instanceMatrix;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform float thickness;
    varying vec2 vUv;
    void main() {
      vec2 d = fwidth(vUv);
      float t = thickness;
      vec2 f = step(d * t, vUv) * step(d * t, 1.0 - vUv);
      float edge = 1.0 - min(f.x, f.y);
      if (edge < 0.5) discard;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.DoubleSide
}

export class Scene3D {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private composer: any = null
  private outlinePass: any = null
  private saturationPass: any = null
  private buildings: THREE.InstancedMesh | null = null
  private outlines: THREE.InstancedMesh | null = null
  private outlineMaterial: THREE.Material | null = null
  private meshes: THREE.Mesh[] = []
  private meshGroups: THREE.Object3D[] = []
  private buildingData: BuildingData[] = []
  private raycaster: THREE.Raycaster
  private mouse: THREE.Vector2
  private hoveredIndex: number = -1
  private languageColors: Record<string, string> = {}
  private useInstancing: boolean = true
  private useToon: boolean = true
  private toonGradient: THREE.Texture | null = null
  private translateMode: boolean = true
  private xrayMode: boolean = true
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  private pulseController: { stop: () => void } | null = null
  private rotateController: { stop: () => void } | null = null
  private rotateParams: { omega: number; alpha: number; delay: number }[] = []
  private rotateStart = 0
  private rotateSpeed = 1
  private pulseAmplitude = 0.15
  private rotatePaused = false
  private rotatePauseTime = 0
  private pulsePaused = false
  private pulsePauseTime = 0
  private pulseStart = 0
  private pulseDir = 1
  private basePulseScalesInstanced: number[] = []
  private basePulseScalesGroups: number[] = []
  private rotateAccel = 0
  private lastRaycastTime = 0
  private lastHovered: BuildingData | null = null
  private raycastIntervalMs = 60
  private raycastMode: 'frame' | 'mousemove' = 'frame'
  private onHoverCallback: ((b: BuildingData | null) => void) | null = null
  private directionalLight!: THREE.DirectionalLight
  private ambientLight!: THREE.AmbientLight
  private hemiLight!: THREE.HemisphereLight
  private shadowIntensity: number = 0.5
  private shadowQuality: 'high' | 'medium' | 'low' = 'medium'
  private instancingLevel: 'full' | 'partial' | 'minimal' = 'full'

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    this.setupScene(container)
    this.setupLighting()
    this.setToonMode(this.useToon)
    this.setupControls()
    this.setupResize(container)
  }

  private setupScene(container: HTMLElement) {
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setClearColor(0x0a0a0a, 1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.sortObjects = true
    container.appendChild(this.renderer.domElement)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, metalness: 0 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    this.camera.position.set(50, 50, 50)
    this.camera.lookAt(this.target)

    this.composer = new EffectComposer(this.renderer)

    const renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(renderPass)

    this.outlinePass = new OutlinePass(new THREE.Vector2(container.clientWidth, container.clientHeight), this.scene, this.camera)
    this.outlinePass.edgeStrength = 4.0
    this.outlinePass.edgeGlow = 0.0
    this.outlinePass.edgeThickness = 0.2
    this.outlinePass.visibleEdgeColor.set('#222222')
    this.outlinePass.hiddenEdgeColor.set('#0d0d0d')
    this.composer.addPass(this.outlinePass)

    this.saturationPass = new ShaderPass(SaturationShader)
    this.saturationPass.uniforms.saturation.value = 1.2
    this.composer.addPass(this.saturationPass)

    const outputPass = new OutputPass()
    this.composer.addPass(outputPass)
  }

  private createToonGradient(levels: number = 3) {
    const data = new Uint8Array(levels * 4)
    for (let i = 0; i < levels; i++) {
      const val = Math.round((i / (levels - 1)) * 255)
      data[i * 4] = val
      data[i * 4 + 1] = val
      data[i * 4 + 2] = val
      data[i * 4 + 3] = 255
    }
    const tex = new THREE.DataTexture(data, levels, 1, THREE.RGBAFormat)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.NoColorSpace
    tex.needsUpdate = true
    this.toonGradient = tex
    return tex
  }

  private getMaterial(color?: THREE.Color, mode: 'toon' | 'standard' | 'basic' = 'standard') {
    if (mode === 'toon') {
      const gradient = this.toonGradient ?? this.createToonGradient(3)
      if (color) {
        return new THREE.MeshToonMaterial({ color, gradientMap: gradient })
      }
      return new THREE.MeshToonMaterial({ gradientMap: gradient })
    }
    if (mode === 'basic') {
      if (color) return new THREE.MeshBasicMaterial({ color })
      return new THREE.MeshBasicMaterial()
    }
    if (color) return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 })
    return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 })
  }

  private setupResize(container: HTMLElement) {
    const ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      this.resize(Math.max(1, Math.floor(cr.width)), Math.max(1, Math.floor(cr.height)))
    })
    ro.observe(container)
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    this.scene.add(this.ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
    directionalLight.position.set(50, 50, 50)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 1024
    directionalLight.shadow.mapSize.height = 1024
    this.scene.add(directionalLight)
    this.directionalLight = directionalLight

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x202020, 0.35)
    this.scene.add(this.hemiLight)

    this.scene.fog = new THREE.Fog(0x0a0a0a, 80, 240)

    const gridHelper = new THREE.GridHelper(200, 100, 0x333333, 0x333333)
    this.scene.add(gridHelper)
  }

  private setupControls() {
    const controls = {
      mouseX: 0,
      mouseY: 0,
      isMouseDown: false,
      isMiddleDown: false,
      rotationX: 0,
      rotationY: 0,
      radius: this.camera.position.length()
    }

    const canvas = this.renderer.domElement

    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 1) {
        controls.isMiddleDown = true
      } else if (event.button === 0) {
        controls.isMouseDown = true
        const p = this.camera.position
        const r = this.camera.position.length()
        controls.radius = r
        controls.rotationY = Math.atan2(p.x, p.z)
        const clamp = Math.max(-1, Math.min(1, p.y / r))
        controls.rotationX = Math.asin(clamp)
      }
      controls.mouseX = event.clientX
      controls.mouseY = event.clientY
    })

    canvas.addEventListener('mouseup', (event) => {
      if (event.button === 1) {
        controls.isMiddleDown = false
      } else if (event.button === 0) {
        controls.isMouseDown = false
      }
    })

    canvas.addEventListener('mousemove', (event) => {
      if (controls.isMouseDown) {
        const deltaX = event.clientX - controls.mouseX
        const deltaY = event.clientY - controls.mouseY

        controls.rotationY += deltaX * 0.01
        controls.rotationX += deltaY * 0.01

        controls.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, controls.rotationX))

        const radius = controls.radius
        const cx = this.target.x
        const cy = this.target.y
        const cz = this.target.z
        this.camera.position.x = cx + radius * Math.sin(controls.rotationY) * Math.cos(controls.rotationX)
        this.camera.position.y = cy + radius * Math.sin(controls.rotationX)
        this.camera.position.z = cz + radius * Math.cos(controls.rotationY) * Math.cos(controls.rotationX)
        this.camera.lookAt(this.target)

        controls.mouseX = event.clientX
        controls.mouseY = event.clientY
      } else if (controls.isMiddleDown && this.translateMode) {
        const deltaX = event.clientX - controls.mouseX
        const deltaY = event.clientY - controls.mouseY
        const speed = 0.002 * controls.radius
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
        const forward = new THREE.Vector3()
        this.camera.getWorldDirection(forward)
        right.y = 0
        forward.y = 0
        right.normalize()
        forward.normalize()
        const move = new THREE.Vector3()
        move.addScaledVector(right, -deltaX * speed)
        move.addScaledVector(forward, deltaY * speed)
        this.camera.position.add(move)
        this.target.add(move)
        this.camera.lookAt(this.target)
        controls.mouseX = event.clientX
        controls.mouseY = event.clientY
      }

      const rect = canvas.getBoundingClientRect()
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      if (this.raycastMode === 'mousemove') {
        const hovered = this.getHoveredBuilding()
        if (this.onHoverCallback) this.onHoverCallback(hovered)
      }
    })

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault()
      const scale = event.deltaY > 0 ? 1.1 : 0.9
      this.camera.position.multiplyScalar(scale)
      controls.radius = this.camera.position.length()
    })

    const handleArrow = (event: KeyboardEvent) => {
      const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
      if (!arrows.includes(event.key)) return
      event.preventDefault()
      const speedBase = Math.max(0.5, controls.radius * 0.02)
      const speed = event.shiftKey ? speedBase * 2 : speedBase
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
      const forward = new THREE.Vector3()
      this.camera.getWorldDirection(forward)
      right.y = 0
      forward.y = 0
      right.normalize()
      forward.normalize()
      const move = new THREE.Vector3()
      if (event.key === 'ArrowLeft') move.addScaledVector(right, -speed)
      if (event.key === 'ArrowRight') move.addScaledVector(right, speed)
      if (event.key === 'ArrowUp') move.addScaledVector(forward, speed)
      if (event.key === 'ArrowDown') move.addScaledVector(forward, -speed)
      this.camera.position.add(move)
      this.target.add(move)
      this.camera.lookAt(this.target)
    }

    window.addEventListener('keydown', handleArrow)
  }

  setLanguageColors(colors: Record<string, string>) {
    this.languageColors = colors
  }

  createBuildings(rects: RectNode[], heightScale: number = 1) {
    if (this.buildings) {
      this.scene.remove(this.buildings)
      this.buildings = null
    }
    if (this.outlines) {
      this.scene.remove(this.outlines)
      this.outlines = null
    }
    if (this.meshes.length) {
      for (const m of this.meshes) this.scene.remove(m)
      this.meshes = []
    }
    if (this.meshGroups.length) {
      for (const g of this.meshGroups) this.scene.remove(g)
      this.meshGroups = []
    }

    const filteredRects = rects

    const maxLoc = Math.max(1, ...filteredRects.map(r => (r.metrics?.loc ?? 0)))
    const targetMaxHeight = 20
    const layoutWidth = Math.max(1, ...filteredRects.map(r => r.x + r.width))
    const layoutHeight = Math.max(1, ...filteredRects.map(r => r.y + r.height))
    const GRID_SIZE = 100
    const FOOTPRINT_SCALE = 0.42
    const MAP_TARGET_W = GRID_SIZE * FOOTPRINT_SCALE
    const MAP_TARGET_H = GRID_SIZE * FOOTPRINT_SCALE
    const sx = MAP_TARGET_W / layoutWidth
    const sz = MAP_TARGET_H / layoutHeight

    this.buildingData = filteredRects.map((rect, i) => {
      const loc = rect.metrics?.loc ?? 0
      const h = ((loc / maxLoc) * targetMaxHeight) * heightScale
      const t = maxLoc > 0 ? loc / maxLoc : 0

      let colorHex = '888888'
      const rawLang = rect.language
      const lang = normalizeLanguage(rawLang, rect.path)

      if (this.languageColors && this.languageColors[lang]) {
        colorHex = this.languageColors[lang].replace('#', '')
      } else if (this.languageColors && this.languageColors['default']) {
        colorHex = this.languageColors['default'].replace('#', '')
      } else {
        // Fallback if language not found in map
        colorHex = new THREE.Color().setHSL((1 - t) * 0.6, 0.75, 0.45).getHexString()
      }

      return {
        position: [
          (rect.x + rect.width / 2) * sx,
          h / 2,
          (rect.y + rect.height / 2) * sz
        ],
        scale: [
          Math.max(rect.width * sx, 0.5),
          Math.max(h, 0.5),
          Math.max(rect.height * sz, 0.5)
        ],
        color: `#${colorHex}`,
        metadata: rect
      }
    })

    const castShadow = this.shadowQuality !== 'low'
    const materialMode = this.instancingLevel === 'minimal' && !this.useToon ? 'basic' : (this.useToon ? 'toon' : 'standard')
    if (this.useInstancing) {
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = this.getMaterial(undefined, materialMode)
      this.buildings = new THREE.InstancedMesh(geometry, material, this.buildingData.length)
      this.buildings.castShadow = castShadow
      this.buildings.receiveShadow = false

      // Setup Outlines
      if (!this.outlineMaterial) {
        // Use LineBasicMaterial for actual wireframe edges ("corner groin")
        const mat = new THREE.LineBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.35,
          blending: THREE.MultiplyBlending,
          depthTest: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        });

        // Patch material to support instancing
        mat.onBeforeCompile = (shader) => {
          shader.vertexShader = `
            attribute mat4 instanceMatrix;
            ${shader.vertexShader}
          `.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vec4 instancePosition = instanceMatrix * vec4(transformed, 1.0);
             transformed = instancePosition.xyz;
            `
          );
        };

        this.outlineMaterial = mat as any;
      }

      // Use EdgesGeometry to get internal edges
      const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1), 0)

      const outlineMat = this.outlineMaterial as THREE.Material
      this.outlines = new THREE.InstancedMesh(outlineGeo, outlineMat, this.buildingData.length)
      // Hack to force InstancedMesh to render as LineSegments
      // @ts-ignore
      this.outlines.isMesh = false
      // @ts-ignore
      this.outlines.isLineSegments = true

      this.outlines.visible = this.useToon
      // Share the instance matrix buffer for performance and sync
      this.outlines.instanceMatrix = this.buildings.instanceMatrix

      const dummy = new THREE.Object3D()
      const color = new THREE.Color()
      for (let i = 0; i < this.buildingData.length; i++) {
        const b = this.buildingData[i]
        dummy.position.set(b.position[0], b.position[1], b.position[2])
        dummy.scale.set(b.scale[0], b.scale[1], b.scale[2])
        dummy.updateMatrix()
        this.buildings.setMatrixAt(i, dummy.matrix)
        // outlines shares the buffer, so no need to setMatrixAt

        color.set(b.color)
        this.buildings.setColorAt(i, color)
      }

      if (this.buildings.instanceMatrix) this.buildings.instanceMatrix.needsUpdate = true
      if (this.buildings.instanceColor) this.buildings.instanceColor.needsUpdate = true
      if (this.outlines.instanceMatrix) this.outlines.instanceMatrix.needsUpdate = true

      this.scene.add(this.buildings)
      this.scene.add(this.outlines)
    } else {
      for (let i = 0; i < this.buildingData.length; i++) {
        const b = this.buildingData[i]
        const geo = new THREE.BoxGeometry(b.scale[0], b.scale[1], b.scale[2])
        const mat = this.getMaterial(new THREE.Color(b.color), materialMode)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(b.position[0], b.position[1], b.position[2])
        mesh.castShadow = castShadow
        mesh.receiveShadow = false
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo, 0),
          new THREE.LineBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.35,
            blending: THREE.MultiplyBlending,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
          })
        )
        edge.position.copy(mesh.position)
        const group = new THREE.Group()
        group.add(mesh)
        group.add(edge)
        this.scene.add(group)
        this.meshes.push(mesh)
        this.meshGroups.push(group)
      }
    }

    if (this.outlinePass) {
      this.outlinePass.selectedObjects = this.buildings ? [this.buildings] : []
    }

    this.fitCameraToContent()
    this.setXRayMode(this.xrayMode)
  }

  setToonMode(toon: boolean) {
    this.useToon = toon

    if (this.outlines) {
      this.outlines.visible = toon
    }

    if (this.outlinePass) {
      this.outlinePass.enabled = toon
      this.outlinePass.selectedObjects = this.buildings ? [this.buildings] : this.meshes
    }

    if (toon) {
      this.updateLightingIntensity()
    } else {
      this.ambientLight.intensity = 0.6
      this.hemiLight.intensity = 0.35
    }

    if (this.useInstancing && this.buildings) {
      const materialMode = this.instancingLevel === 'minimal' && !this.useToon ? 'basic' : (this.useToon ? 'toon' : 'standard')
      this.buildings.material = this.getMaterial(undefined, materialMode)
      return
    }
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i]
      const color = (m.material as any).color as THREE.Color
      const materialMode = this.instancingLevel === 'minimal' && !this.useToon ? 'basic' : (this.useToon ? 'toon' : 'standard')
      m.material = this.getMaterial(color, materialMode)
    }
  }

  setTranslateMode(enabled: boolean) {
    this.translateMode = enabled
  }

  setBorderThickness(thickness: number) {
    if (this.outlinePass) {
      this.outlinePass.edgeThickness = thickness
      this.outlinePass.edgeStrength = thickness * 5
    }
    if (this.outlineMaterial && (this.outlineMaterial as any).uniforms) {
      (this.outlineMaterial as any).uniforms.thickness.value = thickness * 5.0
    }
  }

  setSaturation(value: number) {
    if (this.saturationPass) {
      this.saturationPass.uniforms.saturation.value = value
    }
  }

  setShadowIntensity(intensity: number) {
    this.shadowIntensity = intensity
    if (this.useToon) {
      this.updateLightingIntensity()
    }
  }

  private updateLightingIntensity() {
    if (!this.ambientLight || !this.hemiLight) return
    // intensity 0: low contrast (high ambient)
    // intensity 1: high contrast (low ambient)
    const i = Math.max(0, Math.min(1, this.shadowIntensity))
    this.ambientLight.intensity = 0.7 - (i * 0.6)
    this.hemiLight.intensity = 0.4 - (i * 0.35)
  }

  setXRayMode(enabled: boolean) {
    this.xrayMode = enabled
    if (this.useInstancing && this.buildings) {
      const mat = this.buildings.material as THREE.MeshStandardMaterial | THREE.MeshToonMaterial | THREE.MeshBasicMaterial
      mat.transparent = enabled
      mat.opacity = enabled ? 0.55 : 1
      mat.depthWrite = !enabled
      mat.premultipliedAlpha = enabled
      mat.blending = THREE.NormalBlending
      ;(mat as any).toneMapped = !enabled ? true : false
      if ((mat as any).gradientMap !== undefined) {
        (mat as any).gradientMap = enabled ? null : (this.toonGradient ?? this.createToonGradient(4))
      }
    }
    for (const g of this.meshGroups) {
      for (const c of g.children) {
        if ((c as any).isLineSegments) {
          const lm = (c as THREE.LineSegments).material as THREE.LineBasicMaterial
          lm.transparent = true
          lm.opacity = enabled ? 0.95 : 1
          lm.depthTest = !enabled
          c.renderOrder = enabled ? 999 : 0
        } else if ((c as any).isMesh) {
          const mm = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshToonMaterial | THREE.MeshBasicMaterial
          mm.transparent = enabled
          mm.opacity = enabled ? 0.55 : 1
          mm.depthWrite = !enabled
          mm.premultipliedAlpha = enabled
          mm.blending = THREE.NormalBlending
          ;(mm as any).toneMapped = !enabled ? true : false
          if ((mm as any).gradientMap !== undefined) {
            (mm as any).gradientMap = enabled ? null : (this.toonGradient ?? this.createToonGradient(4))
          }
        }
      }
    }
  }

  setRotateSpeed(speed: number) {
    this.rotateSpeed = Math.max(0.1, speed)
  }

  setRotateAcceleration(accel: number) {
    this.rotateAccel = Math.max(0, accel)
  }

  setPulseAmplitude(amplitude: number) {
    this.pulseAmplitude = Math.max(0, Math.min(amplitude, 1))
    if (!this.useInstancing && this.pulseController) {
      this.stopPulseAnimation()
      this.startPulseAnimation()
    }
  }

  startPulseAnimation() {
    const duration = 1250
    const ease = (t: number) => (t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * Math.pow(t - 1, 5))
    if (this.useInstancing) {
      if (this.pulseController) { this.resumePulseAnimation(); return }
      if (!this.buildings || this.buildingData.length === 0) return
      const delays = stagger(65, { from: 'center' })
      const total = this.buildingData.length
      this.basePulseScalesInstanced = this.buildingData.map(b => b.scale[1])
      const dummy = new THREE.Object3D()
      this.pulseStart = performance.now()
      this.pulseDir = 1
      let stopped = false
      const loop = () => {
        if (stopped) return
        const now = performance.now()
        if (this.pulsePaused) { requestAnimationFrame(loop); return }
        let done = 0
        for (let i = 0; i < total; i++) {
          const d = delays(i, total)
          const t = Math.max(0, Math.min(1, (now - this.pulseStart - d) / duration))
          const u = ease(this.pulseDir < 0 ? 1 - t : t)
          const b = this.buildingData[i]
          dummy.position.set(b.position[0], b.position[1], b.position[2])
          dummy.scale.set(b.scale[0], this.basePulseScalesInstanced[i] * (1 + this.pulseAmplitude * u), b.scale[2])
          dummy.updateMatrix()
          this.buildings!.setMatrixAt(i, dummy.matrix)
          // Outlines share matrix
          done += t === 1 ? 1 : 0
        }
        if (this.buildings!.instanceMatrix) this.buildings!.instanceMatrix.needsUpdate = true
        if (done === total) { this.pulseDir *= -1; this.pulseStart = now }
        requestAnimationFrame(loop)
      }
      this.pulseController = { stop: () => { stopped = true; for (let i = 0; i < total; i++) {
        const b = this.buildingData[i]
        dummy.position.set(b.position[0], b.position[1], b.position[2])
        dummy.scale.set(b.scale[0], this.basePulseScalesInstanced[i], b.scale[2])
        dummy.updateMatrix()
        this.buildings!.setMatrixAt(i, dummy.matrix)
      }
      if (this.buildings!.instanceMatrix) this.buildings!.instanceMatrix.needsUpdate = true;
      this.pulseController = null } }
      requestAnimationFrame(loop)
      return
    }
    if (this.meshGroups.length === 0) return
    if (this.pulseController) { this.resumePulseAnimation(); return }
    const delaysFn = stagger(65, { from: 'center' })
    this.basePulseScalesGroups = this.meshGroups.map(g => {
      const m = g.children.find(c => (c as any).isMesh) as THREE.Mesh
      return m ? m.scale.y : 1
    })
    this.pulseStart = performance.now()
    this.pulseDir = 1
    let stopped = false
    const total = this.meshGroups.length
    const loop = () => {
      if (stopped) return
      const now = performance.now()
      if (this.pulsePaused) { requestAnimationFrame(loop); return }
      let done = 0
      for (let i = 0; i < total; i++) {
        const d = delaysFn(i, total)
        const t = Math.max(0, Math.min(1, (now - this.pulseStart - d) / duration))
        const u = ease(this.pulseDir < 0 ? 1 - t : t)
        const baseY = this.basePulseScalesGroups[i]
        this.meshGroups[i].scale.y = baseY * (1 + this.pulseAmplitude * u)
        done += t === 1 ? 1 : 0
      }
      if (done === total) { this.pulseDir *= -1; this.pulseStart = now }
      requestAnimationFrame(loop)
    }
    this.pulseController = { stop: () => { stopped = true; for (let i = 0; i < total; i++) this.meshGroups[i].scale.y = this.basePulseScalesGroups[i]; this.pulseController = null } }
    requestAnimationFrame(loop)
  }

  stopPulseAnimation() {
    if (this.pulseController) {
      this.pulseController.stop()
      this.pulseController = null
      for (const g of this.meshGroups) g.scale.y = 1
    }
  }

  pausePulseAnimation() {
    if (!this.pulseController || this.pulsePaused) return
    this.pulsePaused = true
    this.pulsePauseTime = performance.now()
  }

  resumePulseAnimation() {
    if (!this.pulseController || !this.pulsePaused) return
    const now = performance.now()
    const pausedMs = now - this.pulsePauseTime
    this.pulseStart += pausedMs
    this.pulsePaused = false
  }

  startRotateAnimation() {
    if (this.useInstancing) {
      if (this.rotateController) { this.resumeRotateAnimation(); return }
      if (!this.buildings || this.buildingData.length === 0) return
      const delays = stagger(80, { from: 'center' })
      const total = this.buildingData.length
      const dummy = new THREE.Object3D()
      this.rotateStart = performance.now()
      this.rotateParams = new Array(total)
      for (let i = 0; i < total; i++) {
        const b = this.buildingData[i]
        const size = Math.max(0.5, (b.scale[0] + b.scale[2]) / 2)
        const omega = 0.8 / Math.max(0.75, size / 10)
        this.rotateParams[i] = { omega, alpha: 0, delay: delays(i, total) }
      }
      let stopped = false
      const baseScales = this.buildingData.map(b => ({ x: b.scale[0], y: b.scale[1], z: b.scale[2] }))
      const loop = () => {
        if (stopped) return
        const now = performance.now()
        if (this.rotatePaused) { requestAnimationFrame(loop); return }
        for (let i = 0; i < total; i++) {
          const p = this.rotateParams[i]
          const t = Math.max(0, (now - this.rotateStart - p.delay)) / 1000
          const omega0 = p.omega * this.rotateSpeed
          const alpha = this.rotateAccel * this.rotateSpeed
          const theta = (omega0 * t + 0.5 * alpha * t * t) % (Math.PI * 2)
          const b = this.buildingData[i]
          dummy.position.set(b.position[0], b.position[1], b.position[2])
          dummy.rotation.set(0, theta, 0)
          dummy.scale.set(baseScales[i].x, baseScales[i].y, baseScales[i].z)
          dummy.updateMatrix()
          this.buildings!.setMatrixAt(i, dummy.matrix)
        }
        if (this.buildings!.instanceMatrix) this.buildings!.instanceMatrix.needsUpdate = true
        requestAnimationFrame(loop)
      }
      this.rotateController = {
        stop: () => {
          stopped = true
          for (let i = 0; i < total; i++) {
            const b = this.buildingData[i]
            dummy.position.set(b.position[0], b.position[1], b.position[2])
            dummy.rotation.set(0, 0, 0)
            dummy.scale.set(baseScales[i].x, baseScales[i].y, baseScales[i].z)
            dummy.updateMatrix()
            this.buildings!.setMatrixAt(i, dummy.matrix)
          }
          if (this.buildings!.instanceMatrix) this.buildings!.instanceMatrix.needsUpdate = true
          this.rotateController = null
        }
      }
      requestAnimationFrame(loop)
      return
    }
    if (this.meshGroups.length === 0) return
    if (this.rotateController) { this.resumeRotateAnimation(); return }
    const delays = stagger(80, { from: 'center' })
    const total = this.meshGroups.length
    this.rotateStart = performance.now()
    this.rotateParams = new Array(total)
    for (let i = 0; i < total; i++) {
      const g = this.meshGroups[i]
      const m = g.children.find(c => (c as any).isMesh) as THREE.Mesh
      const s = m ? (m.scale.x + m.scale.z) / 2 : 1
      const omega = 0.8 / Math.max(0.75, s / 10)
      this.rotateParams[i] = { omega, alpha: 0, delay: delays(i, total) }
    }
    let stopped = false
    const loop = () => {
      if (stopped) return
      const now = performance.now()
      if (this.rotatePaused) { requestAnimationFrame(loop); return }
      for (let i = 0; i < total; i++) {
        const p = this.rotateParams[i]
        const t = Math.max(0, (now - this.rotateStart - p.delay)) / 1000
        const omega0 = p.omega * this.rotateSpeed
        const alpha = this.rotateAccel * this.rotateSpeed
        const theta = (omega0 * t + 0.5 * alpha * t * t) % (Math.PI * 2)
        this.meshGroups[i].rotation.y = theta
      }
      requestAnimationFrame(loop)
    }
    this.rotateController = {
      stop: () => {
        stopped = true
        for (let i = 0; i < total; i++) this.meshGroups[i].rotation.y = 0
        this.rotateController = null
      }
    }
    requestAnimationFrame(loop)
  }

  pauseRotateAnimation() {
    if (!this.rotateController || this.rotatePaused) return
    this.rotatePaused = true
    this.rotatePauseTime = performance.now()
  }

  resumeRotateAnimation() {
    if (!this.rotateController || !this.rotatePaused) return
    const now = performance.now()
    const pausedMs = now - this.rotatePauseTime
    this.rotateStart += pausedMs
    this.rotatePaused = false
  }

  stopRotateAnimation() {
    if (this.rotateController) {
      this.rotateController.stop()
      this.rotateController = null
      for (const g of this.meshGroups) g.rotation.y = 0
    }
  }

  getHoveredBuilding(): BuildingData | null {
    const now = performance.now()
    if (now - this.lastRaycastTime < this.raycastIntervalMs) return this.lastHovered
    this.lastRaycastTime = now
    let hovered: BuildingData | null = null
    if (this.useInstancing) {
      if (!this.buildings || this.buildingData.length === 0) return this.lastHovered
      this.raycaster.setFromCamera(this.mouse, this.camera)
      const intersects = this.raycaster.intersectObject(this.buildings, false)
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId
        if (instanceId !== undefined && instanceId < this.buildingData.length) {
          hovered = this.buildingData[instanceId]
        }
      }
    } else {
      if (!this.meshes.length) return this.lastHovered
      this.raycaster.setFromCamera(this.mouse, this.camera)
      const intersects = this.raycaster.intersectObjects(this.meshes, false)
      if (intersects.length > 0) {
        const i = this.meshes.indexOf(intersects[0].object as THREE.Mesh)
        if (i >= 0) hovered = this.buildingData[i]
      }
    }
    this.lastHovered = hovered
    return hovered
  }

  setRaycastOnMouseMove(enabled: boolean, callback?: (b: BuildingData | null) => void) {
    this.raycastMode = enabled ? 'mousemove' : 'frame'
    this.onHoverCallback = enabled ? (callback ?? null) : null
  }

  private setShadowQuality(level: 'high' | 'medium' | 'low') {
    this.shadowQuality = level
    const targetSize = level === 'high' ? 2048 : level === 'medium' ? 1024 : 0
    const targetIntensity = level === 'high' ? 0.9 : level === 'medium' ? 0.8 : 0.7
    if (targetSize === 0) {
      this.renderer.shadowMap.enabled = false
      this.directionalLight.castShadow = false
    } else {
      this.renderer.shadowMap.enabled = true
      this.directionalLight.castShadow = true
      this.directionalLight.shadow.mapSize.set(targetSize, targetSize)
    }
    const start = this.directionalLight.intensity
    const end = targetIntensity
    const duration = 250
    const t0 = performance.now()
    const step = () => {
      const now = performance.now()
      const u = Math.min(1, (now - t0) / duration)
      this.directionalLight.intensity = start + (end - start) * u
      if (u < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  private setInstancingLevel(level: 'full' | 'partial' | 'minimal') {
    this.instancingLevel = level
    this.useInstancing = true
    const materialMode = level === 'minimal' && !this.useToon ? 'basic' : (this.useToon ? 'toon' : 'standard')
    if (this.buildings) {
      this.buildings.material = this.getMaterial(undefined, materialMode)
      this.buildings.castShadow = this.shadowQuality !== 'low'
    }
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i]
      const color = (m.material as any).color as THREE.Color
      m.material = this.getMaterial(color, materialMode)
      m.castShadow = this.shadowQuality !== 'low'
    }
  }

  applyPerformanceProfile(total: number) {
    if (total < 1000) {
      this.setShadowQuality('high')
      this.setInstancingLevel('full')
    } else if (total < 10000) {
      this.setShadowQuality('medium')
      this.setInstancingLevel('partial')
    } else {
      this.setShadowQuality('low')
      this.setInstancingLevel('minimal')
    }
  }

  resetCamera() {
    this.fitCameraToContent()
  }

  translateCamera(dx: number, dy: number, dz: number) {
    this.camera.position.x += dx
    this.camera.position.y += dy
    this.camera.position.z += dz
  }

  focusOnNode(node: RectNode) {
    const b = this.buildingData.find(d => d.metadata === node)
    if (!b) return
    const cx = b.position[0]
    const cz = b.position[2]
    const size = Math.max(b.scale[0], b.scale[2])
    const distance = Math.max(30, size * 3)
    const pitch = Math.PI / 4
    const yaw = Math.PI / 4
    const px = cx + distance * Math.sin(yaw) * Math.cos(pitch)
    const py = distance * Math.sin(pitch)
    const pz = cz + distance * Math.cos(yaw) * Math.cos(pitch)
    this.camera.position.set(px, py, pz)
    this.target.set(cx, 0, cz)
    this.camera.lookAt(this.target)
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.composer?.setSize(width, height)
  }

  private fitCameraToContent() {
    if (!this.buildingData.length) return
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const b of this.buildingData) {
      const halfW = b.scale[0] / 2
      const halfD = b.scale[2] / 2
      const x = b.position[0]
      const z = b.position[2]
      minX = Math.min(minX, x - halfW)
      maxX = Math.max(maxX, x + halfW)
      minZ = Math.min(minZ, z - halfD)
      maxZ = Math.max(maxZ, z + halfD)
    }
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    const width = Math.max(1, maxX - minX)
    const depth = Math.max(1, maxZ - minZ)
    const radius = Math.sqrt(width * width + depth * depth) / 2
    const distance = radius * 2
    const pitch = Math.PI / 4
    const yaw = Math.PI / 4
    const cx = centerX + distance * Math.sin(yaw) * Math.cos(pitch)
    const cy = distance * Math.sin(pitch)
    const cz = centerZ + distance * Math.cos(yaw) * Math.cos(pitch)
    this.camera.position.set(cx, cy, cz)
    this.target.set(centerX, 0, centerZ)
    this.camera.lookAt(this.target)
  }

  render() {
    if (this.useToon && this.composer) {
      this.composer.render()
    } else {
      this.renderer.render(this.scene, this.camera)
    }
  }

  dispose() {
    this.renderer.dispose()
  }
}
