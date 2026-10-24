// @vitest-environment jsdom

import { PerspectiveCamera } from 'three'
import { afterEach, expect, it } from 'vitest'
import { PovControls } from './pov-controls'

const live: PovControls[] = []

afterEach(() => {
  live.splice(0).forEach((controls) => controls.dispose())
  document.body.innerHTML = ''
})

const setup = () => {
  const camera = new PerspectiveCamera()
  camera.position.set(2, 3, 4)
  camera.lookAt(2, 3, 3)
  const element = document.createElement('div')
  document.body.appendChild(element)
  element.setPointerCapture = () => {}
  const controls = new PovControls(camera, element, 1)
  live.push(controls)
  const key = (type: string, code: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent(type, { code, cancelable: true, bubbles: true, ...init })
    window.dispatchEvent(event)
    return event
  }
  const pointer = (type: string, init: { id?: number; x?: number; y?: number; button?: number } = {}) => {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { pointerId: init.id ?? 1, clientX: init.x ?? 0, clientY: init.y ?? 0, button: init.button ?? 0 })
    element.dispatchEvent(event)
  }
  return { camera, element, controls, key, pointer }
}

it('looks without moving the camera', () => {
  const { camera, controls } = setup()
  const position = camera.position.clone()
  const quaternion = camera.quaternion.clone()
  controls.look(160, -60)
  expect(camera.position.equals(position)).toBe(true)
  expect(camera.quaternion.angleTo(quaternion)).toBeGreaterThan(0.1)
  controls.look(0, -1e6)
  controls.sync()
  controls.dispose()
})

it('moves forward, back, sideways and vertically', () => {
  const { camera, controls, key } = setup()
  key('keydown', 'KeyW')
  controls.update(0.1)
  key('keyup', 'KeyW')
  expect(camera.position.z).toBeCloseTo(3.9)
  expect(camera.position.y).toBe(3)
  key('keydown', 'KeyS')
  controls.update(0.1)
  key('keyup', 'KeyS')
  expect(camera.position.z).toBeCloseTo(4)
  key('keydown', 'KeyD')
  controls.update(0.1)
  key('keyup', 'KeyD')
  expect(camera.position.x).toBeCloseTo(2.1)
  key('keydown', 'KeyQ')
  controls.update(0.1)
  key('keyup', 'KeyQ')
  expect(camera.position.y).toBeCloseTo(2.9)
  controls.update(0.1)
  expect(camera.position.y).toBeCloseTo(2.9)
})

it('normalizes diagonals, boosts with Shift and stops on blur', () => {
  const { camera, controls, key } = setup()
  const start = camera.position.clone()
  key('keydown', 'KeyW')
  key('keydown', 'KeyD')
  controls.update(0.1)
  expect(camera.position.distanceTo(start)).toBeCloseTo(0.1)
  key('keydown', 'ShiftLeft')
  const before = camera.position.clone()
  controls.update(0.1)
  expect(camera.position.distanceTo(before)).toBeCloseTo(0.3)
  window.dispatchEvent(new Event('blur'))
  const stopped = camera.position.clone()
  controls.update(0.1)
  expect(camera.position.equals(stopped)).toBe(true)
})

it('ignores shortcuts, form fields and unrelated keys', () => {
  const { camera, controls, key } = setup()
  const start = camera.position.clone()
  key('keydown', 'KeyW', { metaKey: true })
  key('keydown', 'KeyX')
  const input = document.body.appendChild(document.createElement('input'))
  input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', cancelable: true }))
  expect(window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))).toBe(true)
  controls.update(0)
  expect(camera.position.equals(start)).toBe(true)
  key('keydown', 'KeyD', { ctrlKey: true })
  controls.update(0.1)
  expect(camera.position.x).toBeCloseTo(2)
  const prevented = new KeyboardEvent('keydown', { code: 'KeyD', cancelable: true })
  prevented.preventDefault()
  window.dispatchEvent(prevented)
  controls.update(0.1)
  expect(camera.position.x).toBeCloseTo(2)
})

it('turns when dragged with the main button and releases', () => {
  const { camera, element, controls, pointer } = setup()
  const quaternion = camera.quaternion.clone()
  pointer('pointermove', { x: 5 })
  pointer('pointerdown', { button: 2 })
  pointer('pointermove', { x: 5 })
  expect(camera.quaternion.equals(quaternion)).toBe(true)
  pointer('pointerdown', { x: 0, y: 0 })
  expect(element.style.cursor).toBe('grabbing')
  pointer('pointermove', { id: 2, x: 50 })
  expect(camera.quaternion.equals(quaternion)).toBe(true)
  pointer('pointermove', { x: 50, y: 10 })
  expect(camera.quaternion.angleTo(quaternion)).toBeGreaterThan(0.1)
  pointer('pointerup')
  expect(element.style.cursor).toBe('grab')
  controls.dispose()
})

it('moves along the view with the wheel', () => {
  const { camera, element, controls } = setup()
  const wheel = (deltaY: number, deltaMode: number) => {
    const event = new WheelEvent('wheel', { deltaY, deltaMode, cancelable: true })
    element.dispatchEvent(event)
    return event.defaultPrevented
  }
  expect(wheel(-100, 0)).toBe(true)
  expect(camera.position.z).toBeCloseTo(3.8)
  wheel(-1, 1)
  wheel(-1, 2)
  element.dispatchEvent(new Event('contextmenu', { cancelable: true }))
  controls.dispose()
})

it('works when the element cannot capture the pointer', () => {
  const { element, controls, pointer } = setup()
  ;(element as { setPointerCapture?: unknown }).setPointerCapture = undefined
  pointer('pointerdown')
  expect(element.style.cursor).toBe('grabbing')
  controls.dispose()
})

it('keeps moving when a drag ends or the view is re-synced while a key is held', () => {
  const { camera, controls, key, pointer } = setup()
  key('keydown', 'KeyS')
  pointer('pointerdown')
  pointer('pointerup')
  controls.sync()
  controls.update(0.1)
  expect(camera.position.z).toBeCloseTo(4.1)
  const button = document.body.appendChild(document.createElement('button'))
  button.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true, cancelable: true }))
  controls.update(0.1)
  expect(camera.position.z).toBeCloseTo(4.1)
})
