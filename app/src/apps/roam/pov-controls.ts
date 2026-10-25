import { Euler, Vector3, type PerspectiveCamera } from 'three'
import { STILL, type Push } from './thumb-pad'

const MOVEMENT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'])
const FIELDS = 'input,select,textarea,button,[contenteditable="true"]'
const PITCH_LIMIT = Math.PI / 2 - 0.015
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** A free first-person camera: looking turns in place and never orbits a target. W/A/S/D move on the floor plane,
 *  Q/E down and up, Shift is faster, the wheel moves forward, and `push` is the same movement from the pad. */
export class PovControls {
  private readonly keys = new Set<string>()
  private readonly euler = new Euler(0, 0, 0, 'YXZ')
  private readonly motion = new Vector3()
  private pushed = STILL
  private readonly listeners: (() => void)[] = []
  private pointer: { id: number; x: number; y: number } | null = null
  private readonly camera: PerspectiveCamera
  private readonly speed: number
  private yaw = 0
  private pitch = 0

  constructor(camera: PerspectiveCamera, element: HTMLElement, { keyboardTarget = window as EventTarget, speed = 0.85 } = {}) {
    this.camera = camera
    this.speed = speed
    this.sync()
    element.tabIndex = 0
    element.style.cursor = 'grab'
    const on = <E extends Event>(target: EventTarget, name: string, fn: (event: E) => void, options?: AddEventListenerOptions) => {
      const listener = fn as EventListener
      target.addEventListener(name, listener, options)
      this.listeners.push(() => target.removeEventListener(name, listener, options))
    }
    const release = () => {
      this.pointer = null
      element.style.cursor = 'grab'
    }
    const clear = () => {
      this.keys.clear()
      release()
    }
    on<KeyboardEvent>(keyboardTarget, 'keydown', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest(FIELDS)) return
      if (!MOVEMENT.has(event.code)) return
      event.preventDefault()
      this.keys.add(event.code)
    })
    on<KeyboardEvent>(keyboardTarget, 'keyup', (event) => this.keys.delete(event.code))
    on(keyboardTarget, 'blur', clear)
    on(element, 'blur', clear)
    on(element.ownerDocument, 'visibilitychange', clear)
    on<PointerEvent>(element, 'pointerdown', (event) => {
      if (event.button !== 0) return
      element.focus({ preventScroll: true })
      element.setPointerCapture(event.pointerId)
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
      element.style.cursor = 'grabbing'
    })
    on<PointerEvent>(element, 'pointermove', (event) => {
      const pointer = this.pointer
      if (!pointer || pointer.id !== event.pointerId) return
      this.look(event.clientX - pointer.x, event.clientY - pointer.y)
      pointer.x = event.clientX
      pointer.y = event.clientY
    })
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) on(element, name, release)
    on<WheelEvent>(element, 'wheel', (event) => {
      event.preventDefault()
      const unit = [1, 16, element.clientHeight][event.deltaMode]
      const distance = -clamp(event.deltaY * unit, -100, 100) * 0.002
      camera.getWorldDirection(this.motion)
      camera.position.addScaledVector(this.motion, distance)
    }, { passive: false })
    on(element, 'contextmenu', (event) => event.preventDefault())
  }

  /** Takes the camera's current direction as the starting yaw and pitch, after a view jump. */
  sync() {
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ')
    this.yaw = this.euler.y
    this.pitch = clamp(this.euler.x, -PITCH_LIMIT, PITCH_LIMIT)
    this.keys.clear()
    this.pushed = STILL
  }

  /** Movement from something other than the keys, for the next frame alone: the pad sets it, `update` spends it. */
  push({ forward, side }: Push) {
    this.pushed = { forward: clamp(forward, -1, 1), side: clamp(side, -1, 1) }
  }

  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0025
    this.pitch = clamp(this.pitch - dy * 0.0025, -PITCH_LIMIT, PITCH_LIMIT)
    this.camera.quaternion.setFromEuler(this.euler.set(this.pitch, this.yaw, 0, 'YXZ'))
  }

  update(dt: number) {
    const held = (code: string) => Number(this.keys.has(code))
    const forward = held('KeyW') - held('KeyS') + this.pushed.forward
    const side = held('KeyD') - held('KeyA') + this.pushed.side
    const vertical = held('KeyE') - held('KeyQ')
    const { yaw } = this
    this.pushed = STILL
    this.motion.set(
      -Math.sin(yaw) * forward + Math.cos(yaw) * side,
      vertical,
      -Math.cos(yaw) * forward - Math.sin(yaw) * side,
    )
    // A key is all or nothing, so a diagonal is full speed; a half-pulled pad walks at half speed.
    const strength = Math.min(1, this.motion.length())
    if (strength === 0) return
    const boost = held('ShiftLeft') || held('ShiftRight') ? 3 : 1
    this.camera.position.addScaledVector(this.motion.normalize(), this.speed * boost * strength * clamp(dt, 0, 0.1))
  }

  dispose() {
    this.keys.clear()
    for (const off of this.listeners.splice(0)) off()
  }
}
