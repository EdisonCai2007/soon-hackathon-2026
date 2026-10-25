// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { CLIP_MS, fitWithin, PHOTO_SIDE, recordVoice, shrinkPhoto } from './capture'

type Recorder = {
  state: string
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null
  onstop: (() => void) | null
  start: () => void
  stop: () => void
}

const tracks = () => [{ stop: vi.fn() }, { stop: vi.fn() }]

function phone({ audio = true, recorder = true } = {}) {
  const stopped = tracks()
  const stream = { getTracks: () => stopped } as unknown as MediaStream
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: {
    getUserMedia: vi.fn(() => (audio ? Promise.resolve(stream) : Promise.reject(new Error('no microphone')))),
  } })
  const made: Recorder[] = []
  vi.stubGlobal('MediaRecorder', class {
    state = 'recording'
    mimeType = 'audio/webm;codecs=opus'
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    constructor() {
      if (!recorder) throw new Error('no recorder on this phone')
      made.push(this as unknown as Recorder)
    }
    start() { this.state = 'recording' }
    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob([new Uint8Array(1024)], { type: this.mimeType }) })
      this.onstop?.()
    }
  })
  return { made, stopped }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('records what the phone hears and hands back the clip', async () => {
  const { made, stopped } = phone()
  const started = await recordVoice()
  expect(started).not.toBeNull()
  expect(made).toHaveLength(1)
  const clip = await started!.stop()
  expect(clip!.type).toBe('audio/webm;codecs=opus')
  expect(clip!.size).toBe(1024)
  // The microphone is let go of, or the phone keeps its recording light on.
  for (const track of stopped) expect(track.stop).toHaveBeenCalled()
})

it('stops itself at the cap, and a second stop asks for nothing more', async () => {
  vi.useFakeTimers()
  const { made } = phone()
  const started = await recordVoice()
  vi.advanceTimersByTime(CLIP_MS)
  expect(made[0].state).toBe('inactive')
  expect((await started!.stop())!.size).toBe(1024)
})

it('asks for nothing more at the cap where the recording has already stopped itself', async () => {
  vi.useFakeTimers()
  const { made } = phone()
  await recordVoice()
  // Stopped from the recorder's own side, so the cap's timer still runs and finds it already inactive.
  made[0].stop()
  const stops = vi.spyOn(made[0], 'stop')
  vi.advanceTimersByTime(CLIP_MS * 2)
  expect(stops).not.toHaveBeenCalled()
})

it('records nothing where the phone refuses the microphone or has no recorder', async () => {
  phone({ audio: false })
  expect(await recordVoice()).toBeNull()
  const { stopped } = phone({ recorder: false })
  expect(await recordVoice()).toBeNull()
  for (const track of stopped) expect(track.stop).toHaveBeenCalled()
})

it('hands back nothing where a recording holds no sound', async () => {
  const { made } = phone()
  const started = await recordVoice()
  made[0].ondataavailable = null
  made[0].stop()
  expect(await started!.stop()).toBeNull()
})

it('keeps a small picture and shrinks a big one to fit', () => {
  expect(fitWithin(800, 600, PHOTO_SIDE)).toEqual({ width: 800, height: 600 })
  expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 })
  expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 })
  // Nothing ever shrinks to nothing.
  expect(fitWithin(0, 0, 1280)).toEqual({ width: 1, height: 1 })
})

const picture = (width: number, height: number) => ({ width, height, close: vi.fn() })

it('shrinks a photograph the camera took', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve(picture(4000, 3000))))
  const drawImage = vi.fn()
  const blob = new Blob([new Uint8Array(2048)], { type: 'image/jpeg' })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(((give: (one: Blob) => void) => give(blob)) as typeof HTMLCanvasElement.prototype.toBlob)
  const shrunk = await shrinkPhoto(new Blob())
  expect(shrunk).toBe(blob)
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 960)
})

it('shrinks nothing the browser cannot read or draw', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.reject(new Error('not a picture'))))
  expect(await shrinkPhoto(new Blob())).toBeNull()

  vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve(picture(100, 100))))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  expect(await shrinkPhoto(new Blob())).toBeNull()
})
