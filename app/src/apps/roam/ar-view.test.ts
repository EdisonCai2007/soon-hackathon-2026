// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Object3D, Vector3 } from 'three'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { placingFor, sessionSpot } from './ar-place'
import { makeArView } from './ar-view'
import type { XRSessionLike } from './ar-session'
import { PATIENCE_MS, PHONE_DETAIL, WARM_MS } from './detail'
import { anchorAt } from './placement'
import { parseScene } from './scene'

const fakes = vi.hoisted(() => ({
  renderers: [] as {
    domElement: HTMLCanvasElement
    setAnimationLoop: ReturnType<typeof vi.fn>
    setPixelRatio: ReturnType<typeof vi.fn>
    render: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
    xr: { enabled: boolean; setReferenceSpaceType: ReturnType<typeof vi.fn>; setSession: ReturnType<typeof vi.fn>; getCamera: () => Object3D }
  }[],
  sparks: [] as { dispose: ReturnType<typeof vi.fn>; enableLod: boolean; lodSplatCount: number; maxStdDev: number }[],
  splats: [] as { options: { url: string; lod?: boolean; onProgress: (event: { loaded: number; total: number }) => void }; finish: () => void; fail: (error: Error) => void; dispose: ReturnType<typeof vi.fn> }[],
}))

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>()
  // The camera three.js moves from the phone's own pose, which the page reads instead of asking the frame.
  const eye = new three.Object3D()
  class WebGLRenderer {
    domElement = document.createElement('canvas')
    outputColorSpace = ''
    setPixelRatio = vi.fn()
    setSize = vi.fn()
    setAnimationLoop = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
    xr = { enabled: false, setReferenceSpaceType: vi.fn(), setSession: vi.fn(async () => {}), getCamera: () => eye }
    constructor() { fakes.renderers.push(this) }
  }
  return { ...three, WebGLRenderer }
})

vi.mock('@sparkjsdev/spark', async () => {
  const { Object3D: Node } = await vi.importActual<typeof import('three')>('three')
  class SparkRenderer extends Node {
    dispose = vi.fn()
    maxStdDev = 0
    enableLod = false
    lodRenderScale = 0
    lodSplatCount = 0
    lodDirty = false
    constructor() { super(); fakes.sparks.push(this) }
  }
  class SplatMesh extends Node {
    dispose = vi.fn()
    initialized: Promise<unknown>
    finish = () => {}
    fail = (_error: Error) => {}
    options: { url: string; onProgress: (event: { loaded: number; total: number }) => void }
    constructor(options: SplatMesh['options']) {
      super()
      this.options = options
      this.initialized = new Promise((resolve, reject) => { this.finish = () => resolve(this); this.fail = reject })
      fakes.splats.push(this)
    }
  }
  return { SparkRenderer, SplatMesh }
})

const details: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8'))
const scene = parseScene(details)
const anchor = anchorAt(scene, 0)

const session = (): XRSessionLike & { ended: () => void } => {
  const listeners: (() => void)[] = []
  return {
    requestReferenceSpace: async () => ({}),
    requestAnimationFrame: vi.fn(),
    end: vi.fn(async () => {}),
    addEventListener: (_name: string, listener: () => void) => listeners.push(listener),
    domOverlayState: { type: 'screen' },
    ended: () => listeners.forEach((one) => one()),
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const loop = () => fakes.renderers[0].setAnimationLoop.mock.calls[0][0] as (time: number) => void

beforeEach(() => { vi.stubGlobal('devicePixelRatio', 3) })
afterEach(() => {
  vi.unstubAllGlobals()
  fakes.renderers.length = 0
  fakes.sparks.length = 0
  fakes.splats.length = 0
  document.body.replaceChildren()
})

it('hands the session to three.js and reads the pose from its own camera', async () => {
  const onPose = vi.fn()
  const view = makeArView('/apps/roam/room.spz', { onPose })
  const [renderer] = fakes.renderers
  expect(renderer.xr.enabled).toBe(true)
  expect(renderer.setPixelRatio).toHaveBeenCalledWith(PHONE_DETAIL.pixels)
  const [spark] = fakes.sparks
  expect(spark.enableLod).toBe(true)
  expect(spark.lodSplatCount).toBe(PHONE_DETAIL.splats)

  await view.take(session())
  expect(renderer.xr.setReferenceSpaceType).toHaveBeenCalledWith('local-floor')
  renderer.xr.getCamera().position.set(1, 1.5, -2)
  loop()(0)
  expect(onPose).toHaveBeenCalledWith({ x: 1, y: 1.5, z: -2, yaw: 0 })
  expect(renderer.render).toHaveBeenCalled()
  view.dispose()
})

it('places the scan against the anchor and loads it once, reporting what has arrived', async () => {
  const onProgress = vi.fn()
  const view = makeArView('/apps/roam/room.spz', { onProgress })
  await view.take(session())
  view.lineUp(anchor, scene)
  const [splats] = fakes.splats
  expect(splats.options.url).toBe('/apps/roam/room.spz')
  expect(splats.options.lod).toBe(true)
  splats.options.onProgress({ loaded: 1, total: 0 })
  splats.options.onProgress({ loaded: 1, total: 4 })
  expect(onProgress.mock.calls).toEqual([[0.25]])
  splats.finish()
  await settle()

  // Lining up again moves the scan and does not load it a second time.
  view.lineUp(anchorAt(scene, 1), scene)
  expect(fakes.splats).toHaveLength(1)
  view.dispose()
  expect(splats.dispose).toHaveBeenCalled()
})

it('puts the lined-up place where the person is standing', async () => {
  const view = makeArView('/apps/roam/room.spz')
  await view.take(session())
  view.lineUp(anchor, scene)
  fakes.splats[0].finish()
  await settle()
  loop()(0)
  const spot = sessionSpot({ x: anchor.x, y: anchor.floor, z: anchor.z }, placingFor(anchor, scene))
  const mesh = fakes.splats[0] as unknown as Object3D
  mesh.updateWorldMatrix(true, false)
  const standing = new Vector3(anchor.x, anchor.floor, anchor.z).applyMatrix4(mesh.parent!.matrixWorld)
  expect(standing.distanceTo(new Vector3(spot.x, spot.y, spot.z))).toBeLessThan(1e-6)
  view.dispose()
})

it('is turned on and off, and starts as the caller asked', async () => {
  const off = makeArView('/apps/roam/room.spz', {}, false)
  expect(off.shown()).toBe(false)
  off.show(true)
  expect(off.shown()).toBe(true)
  off.dispose()
  const on = makeArView('/apps/roam/room.spz')
  expect(on.shown()).toBe(true)
  on.dispose()
})

it('gives up the drawing when the rate cannot be held, and when the 3D view is lost', async () => {
  const onGaveUp = vi.fn()
  const view = makeArView('/apps/roam/room.spz', { onGaveUp })
  await view.take(session())
  const draw = loop()
  let time = 0
  for (let frame = 0; frame < (WARM_MS + PATIENCE_MS + 1_000) / 250; frame += 1) {
    time += 250
    draw(time)
  }
  expect(onGaveUp).toHaveBeenCalledWith('rate')
  expect(view.shown()).toBe(false)

  const lost = new Event('webglcontextlost', { cancelable: true })
  fakes.renderers[0].domElement.dispatchEvent(lost)
  expect(lost.defaultPrevented).toBe(true)
  expect(onGaveUp).toHaveBeenLastCalledWith('lost')
  view.dispose()
})

it('says nothing once it is disposed, and lets go of a scan that arrives afterwards', async () => {
  const onGaveUp = vi.fn()
  const onProgress = vi.fn()
  const view = makeArView('/apps/roam/room.spz', { onGaveUp, onProgress })
  await view.take(session())
  view.lineUp(anchor, scene)
  const [splats] = fakes.splats
  view.dispose()
  splats.options.onProgress({ loaded: 1, total: 2 })
  splats.finish()
  await settle()
  // The listener and the frame loop both go with dispose, so neither can report anything afterwards.
  fakes.renderers[0].domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(onProgress).not.toHaveBeenCalled()
  expect(onGaveUp).not.toHaveBeenCalled()
  expect(splats.dispose).toHaveBeenCalled()
  expect(fakes.renderers[0].setAnimationLoop).toHaveBeenLastCalledWith(null)
})

it('minds its own business when the page is listening for nothing', async () => {
  const view = makeArView('/apps/roam/room.spz')
  await view.take(session())
  view.lineUp(anchor, scene)
  fakes.splats[0].options.onProgress({ loaded: 1, total: 2 })
  expect(() => fakes.renderers[0].domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))).not.toThrow()
  expect(view.shown()).toBe(false)
  view.dispose()
})

it('says nothing about a scan that fails after the page has gone', async () => {
  const onGaveUp = vi.fn()
  const view = makeArView('/apps/roam/room.spz', { onGaveUp })
  await view.take(session())
  view.lineUp(anchor, scene)
  view.dispose()
  fakes.splats[0].fail(new Error('too late'))
  await settle()
  expect(onGaveUp).not.toHaveBeenCalled()
})

it('gives up when the scan itself will not load', async () => {
  const onGaveUp = vi.fn()
  const view = makeArView('/apps/roam/room.spz', { onGaveUp })
  await view.take(session())
  view.lineUp(anchor, scene)
  fakes.splats[0].fail(new Error('bad file'))
  await settle()
  expect(onGaveUp).toHaveBeenCalledWith('lost')
  view.dispose()
})
