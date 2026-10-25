// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EVERY_MS, readHands, type Landmarker } from './hands'
import type { Hand } from './signs'

// MediaPipe itself is stood in: it loads WebAssembly, which no test environment has.
const mediapipe = vi.hoisted(() => ({ asked: [] as unknown[] }))
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: (path: string) => Promise.resolve({ path }) },
  HandLandmarker: {
    createFromOptions: (files: unknown, options: unknown) => {
      mediapipe.asked.push({ files, options })
      return Promise.resolve({ detectForVideo: () => ({ landmarks: [] }), close: () => {} })
    },
  },
}))

const HAND: Hand = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
const stream = () => ({ getTracks: () => [] }) as unknown as MediaStream

function fake(over: Partial<Landmarker> = {}) {
  const landmarker = { detectForVideo: vi.fn(() => ({ landmarks: [HAND] })), close: vi.fn(), ...over }
  return { landmarker, make: () => Promise.resolve(landmarker as Landmarker) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('reads the hands in the stream until it is stopped', async () => {
  const { landmarker, make } = fake()
  const seen: number[] = []
  const reader = await readHands(stream(), (hands) => seen.push(hands.length), make)

  vi.advanceTimersByTime(EVERY_MS * 3)
  expect(seen).toEqual([1, 1, 1])
  expect(landmarker.detectForVideo).toHaveBeenCalledTimes(3)

  reader.stop()
  vi.advanceTimersByTime(EVERY_MS * 3)
  expect(seen).toHaveLength(3)
  expect(landmarker.close).toHaveBeenCalled()
})

it('reads with the model and WebAssembly served from this app', async () => {
  const reader = await readHands(stream(), () => {})
  expect(mediapipe.asked).toEqual([{
    files: { path: '/apps/roam/hands/wasm' },
    options: expect.objectContaining({ runningMode: 'VIDEO', numHands: 2 }),
  }])
  reader.stop()
})

it('hands back the failure when the landmarker will not start here', async () => {
  await expect(readHands(stream(), () => {}, () => Promise.reject(new Error('no WebAssembly')))).rejects.toThrow('no WebAssembly')
})
