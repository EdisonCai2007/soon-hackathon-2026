// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { Mesh, Scene as World, Vector3, type PerspectiveCamera } from 'three'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { STEPS } from './detail'
import { figureSize, floorHeight } from './placement'
import { nextMotion, SEND_INTERVAL_MS } from './pose-feed'
import type { Peer } from './presence'
import { RoomViewer } from './RoomViewer'
import { cameraPose, displayQuaternion, parseScene, poseFor } from './scene'

// The GPU parts are stood in: a renderer that draws nothing, and a splat mesh whose loading each test finishes.
const fakes = vi.hoisted(() => ({
  renderers: [] as { domElement: HTMLCanvasElement; setSize: ReturnType<typeof vi.fn>; setAnimationLoop: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[],
  sparks: [] as { dispose: ReturnType<typeof vi.fn>; enableLod: boolean; lodSplatCount: number; lodRenderScale: number; maxStdDev: number }[],
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
    maxStdDev = 0
    enableLod = false
    lodRenderScale = 0
    lodSplatCount = 0
    lodDirty = false
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

// The filmed people load on their own; each test settles the load it is about.
const clips = vi.hoisted(() => ({
  loads: [] as { arrive: () => void; fail: (error: Error) => void; update: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[],
}))
vi.mock('./people', () => ({
  addPeople: () => new Promise((resolve, reject) => {
    const load = { update: vi.fn(), dispose: vi.fn(), arrive: () => resolve(load), fail: reject }
    clips.loads.push(load)
  }),
}))

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
  clips.loads.length = 0
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

it('plays the filmed people once they arrive, each frame, and lets them go on leaving', async () => {
  const { unmount } = show()
  await settle()
  fakes.splats[0].finish()
  await settle()
  const [clip] = clips.loads
  clip.arrive()
  await settle()
  const draw = fakes.renderers[0].setAnimationLoop.mock.calls[0][0] as (time: number) => void
  draw(1000)
  draw(1500)
  expect(clip.update.mock.calls).toEqual([[0], [0.5]])
  unmount()
  expect(clip.dispose).toHaveBeenCalled()
})

it('lets go of people that arrive after the page left, and keeps the room when they fail', async () => {
  const early = show()
  await settle()
  fakes.splats[0].finish()
  await settle()
  early.unmount()
  clips.loads[0].arrive()
  await settle()
  expect(clips.loads[0].dispose).toHaveBeenCalled()

  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { onEvent } = show()
  await settle()
  fakes.splats[1].finish()
  await settle()
  clips.loads[1].fail(new Error('missing model'))
  await settle()
  expect(console.error).toHaveBeenCalledWith(new Error('missing model'))
  expect(onEvent).toHaveBeenLastCalledWith({ type: 'ready', scene })
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

const peer = (id: string, at: { x: number; y: number; z: number }): Peer =>
  ({ member: { id, name: id, color: '#f97362', role: 'guest', pose: null }, motion: nextMotion(null, { ...at, yaw: 0 }, 0), stream: null, cast: null })

const live = async (props: Partial<ComponentProps<typeof RoomViewer>> = {}) => {
  const onEvent = vi.fn()
  const view = render(<RoomViewer sceneUrl="/apps/roam/scene.json" splatUrl="/apps/roam/room.spz" pose={null} onEvent={onEvent} {...props} />)
  await settle()
  fakes.splats[0].finish()
  await settle()
  const renderer = fakes.renderers[fakes.renderers.length - 1]
  return { ...view, onEvent, renderer, draw: renderer.setAnimationLoop.mock.calls[0][0] as (time: number) => void }
}

it('draws the people in the room, follows them, and lets go of whoever leaves', async () => {
  const props = { sceneUrl: '/apps/roam/scene.json', splatUrl: '/apps/roam/room.spz', pose: null }
  const { rerender, draw, renderer, onEvent } = await live({ peers: [peer('a1', { x: 1, y: 0, z: 2 })] })
  draw(0)
  const world = renderer.render.mock.calls[0][0] as World
  // The scan's own mesh plus one figure.
  const figures = world.children.filter((child) => child instanceof Mesh)
  expect(figures).toHaveLength(1)
  expect(figures[0].position.x).toBe(1)

  rerender(<RoomViewer {...props} onEvent={onEvent} peers={[]} />)
  expect(world.children.filter((child) => child instanceof Mesh)).toHaveLength(0)
})

it('tells the page where this person stands, ten times a second and no more', async () => {
  const onStance = vi.fn()
  const { draw } = await live({ onStance })
  draw(1000)
  draw(1000 + SEND_INTERVAL_MS / 2)
  draw(1000 + SEND_INTERVAL_MS)
  expect(onStance).toHaveBeenCalledTimes(2)
  expect(onStance.mock.calls[0][0]).toMatchObject({ x: expect.any(Number), yaw: expect.any(Number) })
})

it('tells the page where the camera is and faces, on the same gate, even walking alone', async () => {
  const onWhere = vi.fn()
  const { draw, renderer } = await live({ onWhere })
  draw(1000)
  draw(1000 + SEND_INTERVAL_MS / 2)
  const viewing = renderer.render.mock.calls[0][1] as PerspectiveCamera
  expect(onWhere).toHaveBeenCalledTimes(1)
  expect(onWhere.mock.calls[0][0]).toEqual(cameraPose(viewing))
})

it('watches the person a press lands on, and nobody where a press lands on the room', async () => {
  const onPick = vi.fn()
  const { draw, renderer } = await live({ peers: [peer('a1', { x: 0, y: 0, z: 0 })], onPick })
  const canvas = renderer.domElement
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 400 }) as DOMRect
  draw(0)
  const viewing = renderer.render.mock.calls[0][1] as PerspectiveCamera
  // Look at the figure from a few units away, so the middle of the view is on it.
  const { height } = figureSize(scene)
  viewing.position.set(0, floorHeight(scene) + height / 2, 3)
  viewing.lookAt(new Vector3(0, floorHeight(scene) + height / 2, 0))
  viewing.updateMatrixWorld()
  draw(1)

  canvas.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 200 }))
  expect(onPick).toHaveBeenCalledWith('a1', cameraPose(viewing))

  onPick.mockClear()
  canvas.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }))
  expect(onPick).not.toHaveBeenCalled()
})

it('places the voices on the sound card the page hands it', async () => {
  const createMediaStreamSource = vi.fn(() => ({ connect: (next: unknown) => next, disconnect: vi.fn() }))
  const node = () => ({ connect: (next: unknown) => next, disconnect: vi.fn(), gain: { setTargetAtTime: vi.fn() } })
  const audio = {
    currentTime: 0, destination: {}, listener: { setPosition: vi.fn() },
    createGain: vi.fn(node), createPanner: vi.fn(() => ({ ...node(), panningModel: '', distanceModel: '', rolloffFactor: 1 })),
    createMediaStreamSource,
  } as unknown as AudioContext
  const stream = { getTracks: () => [] } as unknown as MediaStream
  const { draw } = await live({ peers: [{ ...peer('a1', { x: 0, y: 0, z: 0 }), stream }], audio })
  draw(0)
  expect(createMediaStreamSource).toHaveBeenCalledWith(stream)
  expect(audio.listener.setPosition).toHaveBeenCalled()
})

it('draws everything while the rate holds, and gives up detail where it cannot', async () => {
  const { draw } = await live()
  const spark = fakes.sparks[fakes.sparks.length - 1]
  expect(spark.enableLod).toBe(false)
  // Two seconds of warm-up, then two and a half at four frames a second: too slow, for long enough to matter.
  let time = 0
  for (let frame = 0; frame < 18; frame += 1) {
    time += 250
    draw(time)
  }
  expect(spark.enableLod).toBe(true)
  expect(spark.lodSplatCount).toBe(STEPS[1].splats)
  expect(spark.maxStdDev).toBe(STEPS[1].stdDev)
})

const pointer = (target: Element, type: string, init: { pointerType?: string; clientX?: number; clientY?: number } = {}) =>
  target.dispatchEvent(Object.assign(
    new MouseEvent(type, { bubbles: true, clientX: init.clientX ?? 0, clientY: init.clientY ?? 0 }),
    { pointerId: 1, pointerType: init.pointerType ?? 'mouse' },
  ))

it('gives a touched view a pad to walk with, and a press on the pad reaches nobody', async () => {
  const onPick = vi.fn()
  const { container, draw, renderer } = await live({ peers: [peer('a1', { x: 0, y: 0, z: 0 })], onPick })
  const label = '[aria-label="Move through the room"]'
  const box = container.firstElementChild!
  act(() => { pointer(box, 'pointerdown') })
  expect(container.querySelector(label)).toBeNull()
  act(() => { pointer(box, 'pointerdown', { pointerType: 'touch' }) })
  const pad = container.querySelector(label)!
  pad.setPointerCapture = vi.fn()

  draw(0)
  const camera = renderer.render.mock.calls[0][1] as PerspectiveCamera
  const standing = camera.position.clone()
  act(() => {
    pointer(pad, 'pointerdown', { clientX: 100, clientY: 100 })
    pointer(pad, 'pointermove', { clientX: 100, clientY: 20 })
  })
  draw(100)
  expect(camera.position.distanceTo(standing)).toBeGreaterThan(0)

  act(() => { pointer(pad, 'pointerup', { clientX: 100, clientY: 20 }) })
  const resting = camera.position.clone()
  // A second finger's drag, and a drag after letting go, both belong to nobody: the camera stays put.
  act(() => {
    pad.dispatchEvent(Object.assign(new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 20 }), { pointerId: 2 }))
    pointer(pad, 'pointermove', { clientX: 100, clientY: 20 })
  })
  draw(200)
  draw(300)
  expect(camera.position.equals(resting)).toBe(true)
  expect(onPick).not.toHaveBeenCalled()
})

it('ignores a press on the room when the page is not listening for one', async () => {
  const { renderer } = await live({ peers: [peer('a1', { x: 0, y: 0, z: 0 })] })
  renderer.domElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 400 }) as DOMRect
  // No onPick: the press is simply the one that takes the keyboard, as it was before rooms existed.
  expect(() => renderer.domElement.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 200 }))).not.toThrow()
})
