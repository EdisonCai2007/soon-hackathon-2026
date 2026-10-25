// @vitest-environment jsdom
import { Euler, Quaternion } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { arSupported, startAr } from './ar-session'

type Frame = (time: number, frame: { getViewerPose: () => unknown }) => void

const orientation = (yaw: number) => {
  const { x, y, z, w } = new Quaternion().setFromEuler(new Euler(0, yaw, 0, 'YXZ'))
  return { x, y, z, w }
}

// The browser's AR session, stood in: a test hands it one frame at a time.
function session(options: { pose?: unknown; overlay?: boolean; gl?: boolean } = {}) {
  const frames: Frame[] = []
  const ends: (() => void)[] = []
  const fake = {
    asked: [] as unknown[],
    states: [] as object[],
    requestReferenceSpace: vi.fn((type: string) => Promise.resolve({ type })),
    requestAnimationFrame: (callback: Frame) => { frames.push(callback) },
    updateRenderState: vi.fn((state: object) => { fake.states.push(state); return Promise.resolve() }),
    end: vi.fn(() => Promise.resolve()),
    addEventListener: (name: string, listener: () => void) => { if (name === 'end') ends.push(listener) },
    domOverlayState: options.overlay === false ? null : { type: 'screen' },
    tick: (pose: unknown = options.pose) => {
      const next = frames.pop()
      next?.(0, { getViewerPose: () => pose })
    },
    finish: () => { for (const end of ends) end() },
  }
  const xr = {
    isSessionSupported: vi.fn(() => Promise.resolve(true)),
    requestSession: vi.fn((mode: string, init?: object) => { fake.asked.push({ mode, init }); return Promise.resolve(fake) }),
  }
  vi.stubGlobal('navigator', { ...navigator, xr })
  // The layer the session needs before it answers with any pose at all, and the context it is built from.
  const makeXRCompatible = vi.fn(() => Promise.resolve())
  vi.stubGlobal('XRWebGLLayer', class { constructor(session: unknown, gl: unknown) { Object.assign(this, { session, gl }) } })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
    kind === 'webgl' && options.gl !== false ? { makeXRCompatible } : null) as typeof HTMLCanvasElement.prototype.getContext)
  return { fake, xr, makeXRCompatible }
}

const hooks = () => ({ onPose: vi.fn(), onLost: vi.fn(), onEnd: vi.fn() })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('says whether this browser can follow the phone through the room', async () => {
  const { xr } = session()
  expect(await arSupported()).toBe(true)
  expect(xr.isSessionSupported).toHaveBeenCalledWith('immersive-ar')

  vi.stubGlobal('navigator', { ...navigator, xr: { isSessionSupported: () => Promise.reject(new Error('no')) } })
  expect(await arSupported()).toBe(false)

  vi.stubGlobal('navigator', { ...navigator, xr: undefined })
  expect(await arSupported()).toBe(false)
})

it('reports where the phone is, in metres and the way it faces', async () => {
  const pose = { transform: { position: { x: 1, y: 1.5, z: -2 }, orientation: orientation(Math.PI / 2) } }
  const { fake, makeXRCompatible } = session({ pose })
  const listening = hooks()
  await startAr(listening)
  expect(fake.asked).toEqual([{ mode: 'immersive-ar', init: { requiredFeatures: ['local-floor'] } }])
  expect(fake.requestReferenceSpace).toHaveBeenCalledWith('local-floor')
  // Checked on a real phone: with no layer, 823 frames in a row answered with no pose at all.
  expect(makeXRCompatible).toHaveBeenCalled()
  expect(fake.states).toEqual([{ baseLayer: expect.any(Object) }])

  fake.tick()
  expect(listening.onPose).toHaveBeenCalledTimes(1)
  const reported = listening.onPose.mock.calls[0][0] as { x: number; yaw: number }
  expect(reported.x).toBe(1)
  expect(reported.yaw).toBeCloseTo(Math.PI / 2)
  // It keeps asking for frames, so the next one is reported too.
  fake.tick()
  expect(listening.onPose).toHaveBeenCalledTimes(2)
})

it('says when the phone has lost track of the room', async () => {
  const { fake } = session()
  const listening = hooks()
  await startAr(listening)
  fake.tick(null)
  expect(listening.onLost).toHaveBeenCalledTimes(1)
  expect(listening.onPose).not.toHaveBeenCalled()
})

it('stops when the page stops it, and reports a session the phone itself ended', async () => {
  const pose = { transform: { position: { x: 0, y: 0, z: 0 }, orientation: orientation(0) } }
  const stopped = session({ pose })
  const listening = hooks()
  const running = await startAr(listening)
  running.stop()
  expect(stopped.fake.end).toHaveBeenCalled()
  // Nothing is reported after stopping, even if a frame was already in flight.
  stopped.fake.tick()
  expect(listening.onPose).not.toHaveBeenCalled()

  const ended = session({ pose })
  const second = hooks()
  await startAr(second)
  ended.fake.finish()
  expect(second.onEnd).toHaveBeenCalledTimes(1)
  ended.fake.tick()
  expect(second.onPose).not.toHaveBeenCalled()
})

it('copes with a session that refuses to end', async () => {
  const pose = { transform: { position: { x: 0, y: 0, z: 0 }, orientation: orientation(0) } }
  const { fake } = session({ pose })
  fake.end.mockImplementation(() => Promise.reject(new Error('already gone')))
  const running = await startAr(hooks())
  expect(() => running.stop()).not.toThrow()
  await Promise.resolve()
})

it('refuses to start where the browser has no AR at all', async () => {
  vi.stubGlobal('navigator', { ...navigator, xr: undefined })
  await expect(startAr(hooks())).rejects.toThrow('This browser has no AR.')
})

it('asks for the page’s own controls over the camera view, and says whether it got them', async () => {
  const pose = { transform: { position: { x: 0, y: 1.2, z: 0 }, orientation: orientation(0) } }
  const root = document.createElement('div')
  const { fake } = session({ pose })
  const running = await startAr(hooks(), root)
  expect(fake.asked).toEqual([{ mode: 'immersive-ar', init: { requiredFeatures: ['local-floor'],
    optionalFeatures: ['dom-overlay'], domOverlay: { root } } }])
  expect(running.overlaid).toBe(true)

  const bare = session({ pose, overlay: false })
  expect((await startAr(hooks(), root)).overlaid).toBe(false)
  expect(bare.fake.asked).toHaveLength(1)
})

it('hands the session to a drawing instead of reading frames itself', async () => {
  const pose = { transform: { position: { x: 0, y: 1, z: 0 }, orientation: orientation(0) } }
  const { fake, makeXRCompatible } = session({ pose })
  const listening = hooks()
  const drawing = { take: vi.fn(async () => {}) }
  const running = await startAr(listening, null, drawing)
  expect(drawing.take).toHaveBeenCalledWith(fake)
  // The drawing attaches a real layer of its own, so neither the dummy one nor a second pose reader is made.
  expect(makeXRCompatible).not.toHaveBeenCalled()
  expect(fake.states).toEqual([])
  expect(fake.requestReferenceSpace).not.toHaveBeenCalled()
  expect(running.overlaid).toBe(true)

  running.stop()
  expect(fake.end).toHaveBeenCalled()
  fake.finish()
  expect(listening.onEnd).toHaveBeenCalledTimes(1)
})

it('starts anyway where there is no layer to attach, so one phone’s quirk is not a dead end', async () => {
  const pose = { transform: { position: { x: 0, y: 1, z: 0 }, orientation: orientation(0) } }
  const { fake } = session({ pose, gl: false })
  const listening = hooks()
  await startAr(listening)
  expect(fake.states).toEqual([])
  fake.tick()
  expect(listening.onPose).toHaveBeenCalledTimes(1)

  // A browser with no XRWebGLLayer at all, such as an older Chrome.
  const older = session({ pose })
  vi.stubGlobal('XRWebGLLayer', undefined)
  await startAr(hooks())
  expect(older.fake.states).toEqual([])
})

it('ends the session when its drawing fails to initialize', async () => {
  const { fake } = session()
  const drawing = { take: vi.fn(async () => { throw new Error('no renderer') }) }
  await expect(startAr(hooks(), null, drawing)).rejects.toThrow('no renderer')
  expect(fake.end).toHaveBeenCalledTimes(1)
})
