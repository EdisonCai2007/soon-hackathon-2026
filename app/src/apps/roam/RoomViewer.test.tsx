// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, render } from '@testing-library/react'
import type { PerspectiveCamera } from 'three'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RoomViewer } from './RoomViewer'
import { displayQuaternion, parseScene, poseFor } from './scene'

// The GPU parts are stood in: a renderer that draws nothing, and a splat mesh whose loading each test finishes.
const fakes = vi.hoisted(() => ({
  renderers: [] as { domElement: HTMLCanvasElement; setSize: ReturnType<typeof vi.fn>; setAnimationLoop: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[],
  sparks: [] as { dispose: ReturnType<typeof vi.fn> }[],
  splats: [] as { options: { url: string; onProgress: (event: { loaded: number; total: number }) => void }; finish: () => void; fail: (error: Error) => void; dispose: ReturnType<typeof vi.fn>; quaternion: { toArray: () => number[] }; position: { toArray: () => number[] } }[],
}))

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    domElement = document.createElement('canvas')
    outputColorSpace = ''
    setPixelRatio = vi.fn()
    setClearColor = vi.fn()
    setSize = vi.fn()
    setAnimationLoop = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
    constructor() { fakes.renderers.push(this) }
  }
  return { ...three, WebGLRenderer }
})

vi.mock('@sparkjsdev/spark', async () => {
  const { Object3D } = await vi.importActual<typeof import('three')>('three')
  class SparkRenderer extends Object3D {
    dispose = vi.fn()
    constructor() { super(); fakes.sparks.push(this) }
  }
  class SplatMesh extends Object3D {
    dispose = vi.fn()
    initialized: Promise<unknown>
    finish = () => {}
    fail = (_error: Error) => {}
    options: { url: string; onProgress: (event: { loaded: number; total: number }) => void }
    constructor(options: SplatMesh['options']) {
      super()
      this.options = options
      this.initialized = new Promise((resolve, reject) => {
        this.finish = () => resolve(this)
        this.fail = reject
      })
      fakes.splats.push(this)
    }
  }
  return { SparkRenderer, SplatMesh }
})

const details: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8'))
const scene = parseScene(details)
let resized: () => void = () => {}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(details)))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  fakes.renderers.length = 0
  fakes.sparks.length = 0
  fakes.splats.length = 0
})

const show = (onEvent = vi.fn()) => {
  const view = render(<RoomViewer sceneUrl="/apps/roam/scene.json" splatUrl="/apps/roam/room.spz" pose={null} onEvent={onEvent} />)
  return { ...view, onEvent }
}
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

it('tells the page when the browser has no 3D, and draws nothing', () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
  const { container, onEvent } = show()
  expect(onEvent).toHaveBeenCalledWith({ type: 'no-webgl' })
  expect(container.querySelector('canvas')).toBeNull()
  expect(fakes.renderers).toHaveLength(0)
})

it('loads the scan upright, reports progress, then draws each frame', async () => {
  const { container, onEvent } = show()
  const [renderer] = fakes.renderers
  expect(container.firstElementChild!.contains(renderer.domElement)).toBe(true)
  expect(renderer.setSize).toHaveBeenCalledWith(800, 400)
  await settle()
  expect(fetch).toHaveBeenCalledWith('/apps/roam/scene.json')
  const [splats] = fakes.splats
  expect(splats.options.url).toBe('/apps/roam/room.spz')
  expect(splats.quaternion.toArray()).toEqual(displayQuaternion(scene).toArray())
  expect(splats.position.toArray()).toEqual(scene.translation)
  splats.options.onProgress({ loaded: 5, total: 0 })
  splats.options.onProgress({ loaded: 5, total: 10 })
  expect(onEvent.mock.calls).toEqual([[{ type: 'progress', progress: 0.5 }]])

  splats.finish()
  await settle()
  expect(onEvent).toHaveBeenLastCalledWith({ type: 'ready', scene })
  const draw = renderer.setAnimationLoop.mock.calls[0][0] as (time: number) => void
  draw(1000)
  draw(1050)
  expect(renderer.render).toHaveBeenCalledTimes(2)
})

it('fits the drawing to its box, skipping a box with no size', () => {
  show()
  const [renderer] = fakes.renderers
  vi.mocked(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')!.get!).mockReturnValue(0)
  resized()
  expect(renderer.setSize).toHaveBeenCalledTimes(1)
  vi.mocked(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')!.get!).mockReturnValue(600)
  resized()
  expect(renderer.setSize).toHaveBeenLastCalledWith(600, 400)
})

it('moves the camera to each new pose once the scan is in', async () => {
  const onEvent = vi.fn()
  const { rerender } = show(onEvent)
  const props = { sceneUrl: '/apps/roam/scene.json', splatUrl: '/apps/roam/room.spz', onEvent }
  rerender(<RoomViewer {...props} pose={poseFor(scene, 'top')} />)
  await settle()
  fakes.splats[0].finish()
  await settle()
  const [renderer] = fakes.renderers
  rerender(<RoomViewer {...props} pose={poseFor(scene, 3)} />)
  ;(renderer.setAnimationLoop.mock.calls[0][0] as (time: number) => void)(0)
  const camera = renderer.render.mock.calls[0][1] as PerspectiveCamera
  expect(camera.position.toArray()).toEqual(scene.cameras[3].eye)
  expect(camera.fov).toBe(scene.cameras[3].fov_y)
})

it('says the room did not load when its details or the scan fail', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(fetch).mockResolvedValueOnce(new Response('missing', { status: 404 }))
  const first = show()
  await settle()
  expect(first.onEvent).toHaveBeenCalledWith({ type: 'error', message: 'The room didn’t load.' })
  first.unmount()

  const second = show()
  await settle()
  fakes.splats[0].fail(new Error('bad file'))
  await settle()
  expect(second.onEvent).toHaveBeenCalledWith({ type: 'error', message: 'The room didn’t load.' })
})

it('says the 3D view stopped when the browser drops it', () => {
  const { onEvent } = show()
  const lost = new Event('webglcontextlost', { cancelable: true })
  fakes.renderers[0].domElement.dispatchEvent(lost)
  expect(lost.defaultPrevented).toBe(true)
  expect(onEvent).toHaveBeenCalledWith({ type: 'error', message: 'The 3D view stopped.' })
})

it('lets go of everything when it leaves the page, and reports nothing after', async () => {
  const early = show()
  early.unmount()
  await settle()
  expect(fakes.splats).toHaveLength(0)
  expect(fakes.renderers[0].dispose).toHaveBeenCalled()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
  const offline = show()
  offline.unmount()
  await settle()
  expect(offline.onEvent).not.toHaveBeenCalled()

  const late = show()
  await settle()
  const splats = fakes.splats[0]
  const renderer = fakes.renderers[2]
  late.unmount()
  splats.options.onProgress({ loaded: 1, total: 2 })
  splats.finish()
  renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  await settle()
  expect(late.onEvent).not.toHaveBeenCalled()
  expect(renderer.setAnimationLoop).toHaveBeenCalledWith(null)
  expect(splats.dispose).toHaveBeenCalled()
  expect(fakes.sparks[2].dispose).toHaveBeenCalled()
  expect(renderer.domElement.isConnected).toBe(false)
})
