import { Euler, Vector3, type PerspectiveCamera } from 'three'

const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'])
const PITCH_LIMIT = Math.PI / 2 - 0.015
const clampPitch = (pitch: number) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch))
const IGNORED_TARGET = 'input,select,textarea,[contenteditable="true"]'

/** A free camera: looking never moves it, and W/A/S/D, Q/E and the wheel only translate it. */
export class PovControls {
  private yaw = 0
  private pitch = 0
  private keys = new Set<string>()
  private pointer: { id: number; x: number; y: number } | null = null
  private euler = new Euler(0, 0, 0, 'YXZ')
  private motion = new Vector3()
  private off: Array<() => void> = []

  private camera: PerspectiveCamera
  private speed: number

  constructor(camera: PerspectiveCamera, element: HTMLElement, speed = 0.85) {
    this.camera = camera
    this.speed = speed
    this.sync()
    element.tabIndex = 0
    element.style.cursor = 'grab'
    const doc = element.ownerDocument
    const on = <T extends Event>(target: EventTarget, name: string, fn: (event: T) => void, options?: AddEventListenerOptions) => {
      target.addEventListener(name, fn as EventListener, options)
      this.off.push(() => target.removeEventListener(name, fn as EventListener, options))
    }
    const clear = () => {
      this.keys.clear()
      this.pointer = null
      element.style.cursor = 'grab'
    }
    on<KeyboardEvent>(window, 'keydown', (e) => {
      const target = e.target as Element | null
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || target?.closest?.(IGNORED_TARGET)) return
      if (KEYS.has(e.code)) {
        e.preventDefault()
        this.keys.add(e.code)
      }
    })
    on<KeyboardEvent>(window, 'keyup', (e) => this.keys.delete(e.code))
    on(window, 'blur', clear)
    on(element, 'blur', clear)
    on(doc, 'visibilitychange', clear)
    on<PointerEvent>(element, 'pointerdown', (e) => {
      if (e.button !== 0) return
      element.focus({ preventScroll: true })
      element.setPointerCapture?.(e.pointerId)
      this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY }
      element.style.cursor = 'grabbing'
    })
    on<PointerEvent>(element, 'pointermove', (e) => {
      const pointer = this.pointer
      if (!pointer || pointer.id !== e.pointerId) return
      this.look(e.clientX - pointer.x, e.clientY - pointer.y)
      pointer.x = e.clientX
      pointer.y = e.clientY
    })
    const release = () => {
      this.pointer = null
      element.style.cursor = 'grab'
    }
    on(element, 'pointerup', release)
    on(element, 'pointercancel', release)
    on(element, 'lostpointercapture', release)
    on<WheelEvent>(element, 'wheel', (e) => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? element.clientHeight : 1
      const distance = -Math.max(-100, Math.min(100, e.deltaY * unit)) * 0.002
      camera.getWorldDirection(this.motion)
      camera.position.addScaledVector(this.motion, distance)
    }, { passive: false })
    on(element, 'contextmenu', (e) => e.preventDefault())
  }

  /** Re-read the camera's orientation after something else moved it, such as a view button. */
  sync() {
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ')
    this.yaw = this.euler.y
    this.pitch = clampPitch(this.euler.x)
  }

  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0025
    this.pitch = clampPitch(this.pitch - dy * 0.0025)
    this.camera.quaternion.setFromEuler(this.euler.set(this.pitch, this.yaw, 0, 'YXZ'))
  }

  update(dt: number) {
    const k = this.keys
    const forward = Number(k.has('KeyW')) - Number(k.has('KeyS'))
    const side = Number(k.has('KeyD')) - Number(k.has('KeyA'))
    const vertical = Number(k.has('KeyE')) - Number(k.has('KeyQ'))
    this.motion.set(
      -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side,
      vertical,
      -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side,
    )
    if (this.motion.lengthSq() === 0) return
    const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1
    this.camera.position.addScaledVector(this.motion.normalize(), this.speed * boost * Math.max(0, Math.min(dt, 0.1)))
  }

  dispose() {
    this.keys.clear()
    this.off.forEach((off) => off())
    this.off = []
  }
}
