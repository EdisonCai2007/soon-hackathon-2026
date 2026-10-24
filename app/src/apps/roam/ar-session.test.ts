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
function session(options: { pose?: unknown } = {}) {
  const frames: Frame[] = []
  const ends: (() => void)[] = []
  const fake = {
    asked: [] as unknown[],
    requestReferenceSpace: vi.fn((type: string) => Promise.resolve({ type })),
    requestAnimationFrame: (callback: Frame) => { frames.push(callback) },
    end: vi.fn(() => Promise.resolve()),
    addEventListener: (name: string, listener: () => void) => { if (name === 'end') ends.push(listener) },
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
  return { fake, xr }
}

const hooks = () => ({ onPose: vi.fn(), onLost: vi.fn(), onEnd: vi.fn() })

afterEach(() => vi.unstubAllGlobals())

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
  const { fake } = session({ pose })
  const listening = hooks()
  await startAr(listening)
  expect(fake.asked).toEqual([{ mode: 'immersive-ar', init: { requiredFeatures: ['local-floor'] } }])
  expect(fake.requestReferenceSpace).toHaveBeenCalledWith('local-floor')

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
