// @vitest-environment jsdom
import { PerspectiveCamera } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { PovControls } from './pov-controls'

const made: PovControls[] = []
afterEach(() => {
  made.splice(0).forEach((controls) => controls.dispose())
  document.body.replaceChildren()
})

const setup = () => {
  const camera = new PerspectiveCamera()
  camera.position.set(2, 3, 4)
  camera.lookAt(2, 3, 3)
  const canvas = document.createElement('canvas')
  canvas.setPointerCapture = vi.fn()
  Object.defineProperty(canvas, 'clientHeight', { value: 400 })
  document.body.append(canvas)
  const controls = new PovControls(camera, canvas, { speed: 1 })
  made.push(controls)
  const key = (type: string, code: string, init: KeyboardEventInit = {}, target: EventTarget = window) =>
    target.dispatchEvent(new KeyboardEvent(type, { code, cancelable: true, bubbles: true, ...init }))
  const pointer = (type: string, init: { pointerId?: number; button?: number; clientX?: number; clientY?: number }) =>
    canvas.dispatchEvent(Object.assign(new MouseEvent(type, { button: init.button ?? 0, clientX: init.clientX, clientY: init.clientY }), { pointerId: init.pointerId ?? 1 }))
  const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 6)
  return { camera, canvas, controls, key, pointer, near }
}

it('looking changes direction without moving the camera', () => {
  const { camera, controls } = setup()
  const position = camera.position.clone()
  const turn = camera.quaternion.clone()
  controls.look(160, -60)
  expect(camera.position.equals(position)).toBe(true)
  expect(camera.quaternion.angleTo(turn)).toBeGreaterThan(0.1)
})

it('W moves forward horizontally and S reverses it', () => {
  const { camera, controls, key, near } = setup()
  key('keydown', 'KeyW')
  controls.update(0.1)
  key('keyup', 'KeyW')
  near(camera.position.z, 3.9)
  expect(camera.position.y).toBe(3)
  key('keydown', 'KeyS')
  controls.update(0.1)
  near(camera.position.z, 4)
})

it('A/D strafe and Q/E move down and up', () => {
  const { camera, controls, key, near } = setup()
  const step = (code: string) => {
    key('keydown', code)
    controls.update(0.1)
    key('keyup', code)
  }
  step('KeyD')
  near(camera.position.x, 2.1)
  step('KeyA')
  near(camera.position.x, 2)
  step('KeyQ')
  near(camera.position.y, 2.9)
  step('KeyE')
  near(camera.position.y, 3)
})

it('normalizes diagonal motion, goes three times faster with Shift, and caps a long frame', () => {
  const { camera, controls, key, near } = setup()
  const start = camera.position.clone()
  key('keydown', 'KeyW')
  key('keydown', 'KeyD')
  controls.update(0.1)
  near(camera.position.distanceTo(start), 0.1)
  key('keyup', 'KeyD')
  for (const shift of ['ShiftLeft', 'ShiftRight']) {
    key('keydown', shift)
    const before = camera.position.z
    controls.update(5)
    near(before - camera.position.z, 0.3)
    key('keyup', shift)
  }
})

it('stops on blur, a hidden page, or a blurred scene', () => {
  const { camera, canvas, controls, key } = setup()
  for (const stop of [() => window.dispatchEvent(new Event('blur')), () => document.dispatchEvent(new Event('visibilitychange')), () => canvas.dispatchEvent(new Event('blur'))]) {
    key('keydown', 'KeyW')
    stop()
    const stopped = camera.position.clone()
    controls.update(0.1)
    expect(camera.position.equals(stopped)).toBe(true)
  }
})

it('ignores form fields, shortcuts, handled keys, and keys that are not movement', () => {
  const { camera, controls, key } = setup()
  const start = camera.position.clone()
  const field = document.createElement('input')
  document.body.append(field)
  key('keydown', 'KeyE', {}, field)
  key('keydown', 'KeyW', { metaKey: true })
  key('keydown', 'KeyW', { ctrlKey: true })
  key('keydown', 'KeyW', { altKey: true })
  key('keydown', 'KeyX')
  const handled = new KeyboardEvent('keydown', { code: 'KeyW', cancelable: true })
  handled.preventDefault()
  window.dispatchEvent(handled)
  controls.update(0.1)
  expect(camera.position.equals(start)).toBe(true)
})

it('drags with the main button to look, and lets go on release', () => {
  const { camera, canvas, pointer } = setup()
  const start = camera.position.clone()
  let turn = camera.quaternion.clone()
  pointer('pointerdown', { button: 2 })
  pointer('pointermove', { clientX: 50, clientY: 0 })
  expect(camera.quaternion.equals(turn)).toBe(true)

  pointer('pointerdown', { clientX: 0, clientY: 0 })
  expect(canvas.setPointerCapture).toHaveBeenCalledWith(1)
  expect(canvas.style.cursor).toBe('grabbing')
  pointer('pointermove', { pointerId: 2, clientX: 50, clientY: 0 })
  expect(camera.quaternion.equals(turn)).toBe(true)
  pointer('pointermove', { clientX: 80, clientY: 20 })
  expect(camera.quaternion.angleTo(turn)).toBeGreaterThan(0.1)
  expect(camera.position.equals(start)).toBe(true)

  for (const release of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    pointer('pointerdown', {})
    pointer(release, {})
    expect(canvas.style.cursor).toBe('grab')
    turn = camera.quaternion.clone()
    pointer('pointermove', { clientX: 300, clientY: 0 })
    expect(camera.quaternion.equals(turn)).toBe(true)
  }
})

it('scrolls forward and back by lines, pages or pixels, and keeps the menu away', () => {
  const { camera, canvas, near } = setup()
  const wheel = (deltaY: number, deltaMode: number) => {
    const before = camera.position.z
    const event = new WheelEvent('wheel', { deltaY, deltaMode, cancelable: true })
    canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    return camera.position.z - before
  }
  near(wheel(-50, 0), -0.1)
  near(wheel(2, 1), 0.064)
  near(wheel(1, 2), 0.2)
  const menu = new MouseEvent('contextmenu', { cancelable: true })
  canvas.dispatchEvent(menu)
  expect(menu.defaultPrevented).toBe(true)
})

it('walks on a push from the pad, at the strength it was pulled, for that frame alone', () => {
  const { camera, controls, near } = setup()
  controls.push({ forward: 1, side: 0 })
  controls.update(0.1)
  near(camera.position.z, 3.9)

  controls.push({ forward: 0.5, side: 0 })
  controls.update(0.1)
  near(camera.position.z, 3.85)

  // Nothing is pushed for the next frame, so the camera stops without anybody letting go.
  const resting = camera.position.clone()
  controls.update(0.1)
  expect(camera.position.equals(resting)).toBe(true)
})

it('adds a push to the keys, clamps a wild one, and drops it on a view jump', () => {
  const { camera, controls, key, near } = setup()
  key('keydown', 'KeyD')
  controls.push({ forward: 0, side: 9 })
  controls.update(0.1)
  key('keyup', 'KeyD')
  near(camera.position.x, 2.1)

  controls.push({ forward: 1, side: 0 })
  controls.sync()
  const jumped = camera.position.clone()
  controls.update(0.1)
  expect(camera.position.equals(jumped)).toBe(true)
})

it('takes up the camera’s new direction after a jump, and stops listening once disposed', () => {
  const { camera, controls, key } = setup()
  camera.lookAt(3, 3, 4)
  controls.sync()
  key('keydown', 'KeyW')
  controls.update(0.1)
  expect(camera.position.x).toBeCloseTo(2.1, 6)
  controls.dispose()
  const stopped = camera.position.clone()
  key('keydown', 'KeyW')
  controls.update(0.1)
  expect(camera.position.equals(stopped)).toBe(true)
})
