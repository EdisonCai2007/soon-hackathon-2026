// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CLIP_MS } from './capture'
import { Leave } from './Leave'
import { parseScene } from './scene'
import { markedSpots } from './spots'

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))
const spots = markedSpots(scene)

type Frame = (time: number, frame: { getViewerPose: () => unknown }) => void
const POSE = { transform: { position: { x: 0.5, y: 1.2, z: -0.4 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }

// The phone, stood in: AR that answers with one pose, a recorder, and a camera that shrinks to a fixed photo.
function phone({ ar = true, pose = POSE as unknown } = {}) {
  const frames: Frame[] = []
  const ends: (() => void)[] = []
  const session = {
    requestReferenceSpace: () => Promise.resolve({}),
    requestAnimationFrame: (callback: Frame) => { frames.push(callback) },
    updateRenderState: () => Promise.resolve(),
    end: () => Promise.resolve(),
    addEventListener: (name: string, listener: () => void) => { if (name === 'end') ends.push(listener) },
    domOverlayState: { type: 'screen' },
  }
  vi.stubGlobal('navigator', { ...navigator, xr: {
    isSessionSupported: () => Promise.resolve(ar),
    requestSession: () => Promise.resolve(session),
  }, mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] }) } })
  vi.stubGlobal('XRWebGLLayer', function Layer() {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    ({ makeXRCompatible: () => Promise.resolve(), drawImage: vi.fn() })) as unknown as typeof HTMLCanvasElement.prototype.getContext)
  return {
    tick: () => act(() => { frames.pop()?.(0, { getViewerPose: () => pose }) }),
    // The phone's own way out of AR, such as the back gesture.
    leaveAr: () => act(() => { for (const end of ends) end() }),
  }
}

/** A recorder that hands back one chunk whenever it is stopped, from either side. */
const recorderGiving = (chunk: Blob) => vi.stubGlobal('MediaRecorder', class {
  state = 'recording'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: chunk })
    this.onstop?.()
  }
})

const left: { body: FormData }[] = []
const answer = { ok: true, id: 'a'.repeat(16), secret: 'f'.repeat(48), fault: null as string | null }

function serving() {
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/scene.json')) return Response.json(scene)
    if (path === '/apps/roam/api/note') {
      left.push({ body: init!.body as FormData })
      return answer.fault
        ? Response.json({ error: { code: answer.fault } }, { status: 400 })
        : Response.json({ id: answer.id, secret: answer.secret })
    }
    throw new Error(`Unexpected request: ${path}`)
  }))
}

const open = async (options?: Parameters<typeof phone>[0]) => {
  const hardware = phone(options)
  serving()
  await act(async () => { render(<Leave app="roam" />) })
  return hardware
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  left.length = 0
  answer.fault = null
  localStorage.clear()
})

it('waits where the scan’s own details cannot be read, rather than offering spots against nothing', async () => {
  phone()
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
  await act(async () => { render(<Leave app="roam" />) })
  expect(screen.getByRole('status').textContent).toContain('Looking at what this phone can do')
  expect(screen.queryByRole('button', { name: /floor/ })).toBeNull()
})

it('asks for the name again where the browser keeps nothing', async () => {
  const refuse = () => { throw new Error('no storage') }
  vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse, removeItem: refuse })
  const { tick } = await open()
  expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('')
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Rafi' } })
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'Still works' } })
  await act(async () => { fireEvent.click(button('Leave it')) })
  expect(Object.fromEntries([...left[0].body]).author).toBe('Rafi')
})

it('says so where the phone refuses the session itself', async () => {
  phone()
  vi.stubGlobal('navigator', { ...navigator, xr: {
    isSessionSupported: () => Promise.resolve(true),
    requestSession: () => Promise.reject(new Error('refused')),
  } })
  serving()
  await act(async () => { render(<Leave app="roam" />) })
  await lineUp()
  expect(screen.getByText(/can’t follow you through the room/)).toBeTruthy()
})

it('starts a note as written, whichever kind was picked before', async () => {
  const { tick } = await open()
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 10, height: 10, close: vi.fn() }))
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(((give: (one: Blob) => void) =>
    give(new Blob([new Uint8Array(16)], { type: 'image/jpeg' }))) as typeof HTMLCanvasElement.prototype.toBlob)
  const file = new File([new Uint8Array(8)], 'photo.jpg', { type: 'image/jpeg' })
  await act(async () => { fireEvent.change(screen.getByText('Photo').querySelector('input')!, { target: { files: [file] } }) })
  expect(screen.getByRole('status').textContent).toContain('Photo ready')

  // Back to writing: the photo is dropped, so the note that lands is the words.
  fireEvent.click(button('Write'))
  expect(button('Leave it').disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'Written after all' } })
  await act(async () => { fireEvent.click(button('Leave it')) })
  const sent = Object.fromEntries([...left[0].body])
  expect(sent.kind).toBe('text')
  expect(left[0].body.get('media')).toBeNull()
})

it('offers the taped spots, with the floor each one is on', async () => {
  await open()
  expect(screen.getByRole('heading', { name: 'Leave a note' })).toBeTruthy()
  for (const spot of spots) expect(screen.getByRole('button', { name: new RegExp(spot.name) })).toBeTruthy()
  expect(screen.getAllByText(/floor \d/)).toHaveLength(spots.length)
})

it('says so plainly where the phone cannot follow you, and offers the home instead', async () => {
  await open({ ar: false })
  expect(screen.getByText(/can’t follow you through the room/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Walk the home instead' }).getAttribute('href')).toBe('/apps/roam/')
  expect(screen.queryByRole('button', { name: /floor/ })).toBeNull()
})

const lineUp = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: new RegExp(spots[0].name) })) })
}

it('lines up on a spot, then leaves a written note where the phone stands', async () => {
  const { tick } = await open()
  await lineUp()
  expect(screen.getByRole('status').textContent).toContain(spots[0].name)
  tick()

  fireEvent.click(button('Leave a note here'))
  fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'The boiler resets behind this panel' } })
  await act(async () => { fireEvent.click(button('Leave it')) })

  const sent = Object.fromEntries([...left[0].body].filter(([, value]) => typeof value === 'string'))
  expect(sent.kind).toBe('text')
  expect(sent.words).toBe('The boiler resets behind this panel')
  // Where the phone stood, turned into the scan's own coordinates against the spot it lined up on.
  const spotted = JSON.parse(String(sent.spot)) as { x: number; y: number }
  expect(spotted.x).not.toBe(0.5)
  expect(Number.isFinite(spotted.y)).toBe(true)
  expect(screen.getByText('1 left')).toBeTruthy()
  expect(button('Leave a note here')).toBeTruthy()
})

it('keeps the name for next time', async () => {
  const { tick } = await open()
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Dana' } })
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'Mind the step' } })
  await act(async () => { fireEvent.click(button('Leave it')) })
  expect(Object.fromEntries([...left[0].body]).author).toBe('Dana')
  expect(localStorage.getItem('roam-author')).toBe('Dana')
})

it('will not leave an empty note, or one before the phone knows where it is', async () => {
  const { tick } = await open({ pose: null })
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  expect(screen.getByText('no tracking')).toBeTruthy()
  // Nothing written yet, so there is nothing to leave.
  expect(button('Leave it').disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'Somewhere' } })
  await act(async () => { fireEvent.click(button('Leave it')) })
  expect(left).toHaveLength(0)
  expect(screen.getByRole('alert').textContent).toContain('doesn’t know where you are')
})

it('records a few words out loud and leaves them', async () => {
  const { tick } = await open()
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))

  recorderGiving(new Blob([new Uint8Array(2048)], { type: 'audio/webm' }))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await act(async () => { fireEvent.click(button('Record')) })
  await act(async () => { fireEvent.click(button('Stop recording')) })
  expect(screen.getByRole('status').textContent).toContain('Recorded')
  // The cap's own timer comes round later and finds the clip already finished, so nothing happens twice.
  await act(async () => { await vi.advanceTimersByTimeAsync(CLIP_MS * 2) })
  expect(screen.getByRole('status').textContent).toContain('Recorded')
  vi.useRealTimers()
  await act(async () => { fireEvent.click(button('Leave it')) })
  expect(Object.fromEntries([...left[0].body]).kind).toBe('voice')
  expect(left[0].body.get('media')).toBeInstanceOf(File)
})

it('stops a recording itself at the cap', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const { tick } = await open()
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  recorderGiving(new Blob([new Uint8Array(64)], { type: 'audio/webm' }))
  await act(async () => { fireEvent.click(button('Record')) })
  await act(async () => { await vi.advanceTimersByTimeAsync(CLIP_MS) })
  expect(screen.getByRole('status').textContent).toContain('Recorded')
  vi.useRealTimers()
})

it('takes nothing when the camera is opened and closed again', async () => {
  const { tick } = await open()
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  await act(async () => { fireEvent.change(screen.getByText('Photo').querySelector('input')!, { target: { files: [] } }) })
  // Still the written note it started as, with nothing to leave and nothing to apologise for.
  expect(screen.getByLabelText('The note')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(button('Leave it').disabled).toBe(true)
})

it('says a note was not taken when the home gives no reason it knows', async () => {
  const { tick } = await open()
  answer.fault = 'bad_media'
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'Something' } })
  await act(async () => { fireEvent.click(button('Leave it')) })
  expect(screen.getByRole('alert').textContent).toContain('wasn’t taken')
})

it('says so when the phone will not let the page listen', async () => {
  const { tick } = await open()
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: () => Promise.reject(new Error('no')) } })
  await act(async () => { fireEvent.click(button('Record')) })
  expect(screen.getByRole('alert').textContent).toContain('wouldn’t let the page listen')
})

it('shrinks a photograph the camera took, and says so when it cannot be read', async () => {
  const { tick } = await open()
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  const file = new File([new Uint8Array(8)], 'photo.jpg', { type: 'image/jpeg' })
  const shrunk = new Blob([new Uint8Array(4096)], { type: 'image/jpeg' })
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 4000, height: 3000, close: vi.fn() }))
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(((give: (one: Blob) => void) => give(shrunk)) as typeof HTMLCanvasElement.prototype.toBlob)
  const camera = () => screen.getByText('Photo').querySelector('input')!
  await act(async () => { fireEvent.change(camera(), { target: { files: [file] } }) })
  expect(screen.getByRole('status').textContent).toContain('Photo ready')
  await act(async () => { fireEvent.click(button('Leave it')) })
  expect(Object.fromEntries([...left[0].body]).kind).toBe('photo')

  vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('not a picture')))
  fireEvent.click(button('Leave a note here'))
  await act(async () => { fireEvent.change(camera(), { target: { files: [file] } }) })
  expect(screen.getByRole('alert').textContent).toContain('couldn’t be read')
})

it('says why a note was refused, and keeps what was typed', async () => {
  const { tick } = await open()
  answer.fault = 'full'
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'One more' } })
  await act(async () => { fireEvent.click(button('Leave it')) })
  expect(screen.getByRole('alert').textContent).toContain('holds as many notes as it can')
  expect((screen.getByLabelText('The note') as HTMLInputElement).value).toBe('One more')
})

it('goes back to the spots when the phone itself leaves AR', async () => {
  const { tick, leaveAr } = await open()
  await lineUp()
  tick()
  expect(button('Leave a note here')).toBeTruthy()
  leaveAr()
  expect(screen.getByRole('button', { name: new RegExp(spots[0].name) })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Leave a note here' })).toBeNull()
})

it('cancels a note, lines up again, and stops', async () => {
  const { tick } = await open()
  await lineUp()
  tick()
  fireEvent.click(button('Leave a note here'))
  fireEvent.click(button('Cancel'))
  expect(button('Leave a note here')).toBeTruthy()

  fireEvent.click(button('Line up again'))
  expect(screen.getByRole('button', { name: new RegExp(spots[1].name) })).toBeTruthy()
  // Lining up again while the session is already running keeps it, rather than asking the phone twice.
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: new RegExp(spots[1].name) })) })
  expect(screen.getByRole('status').textContent).toContain(spots[1].name)
  fireEvent.click(button('Stop'))
  expect(screen.getByRole('button', { name: new RegExp(spots[0].name) })).toBeTruthy()
})
