// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Walk } from './Leave'
import { parseScene } from './scene'
import { markedSpots } from './spots'

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))
const spots = markedSpots(scene)

type Frame = (time: number, frame: { getViewerPose: () => unknown }) => void
const POSE = { transform: { position: { x: 0.5, y: 1.2, z: -0.4 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }

// The phone, stood in: AR that answers each frame with whatever pose it is handed.
function phone({ ar = true } = {}) {
  const frames: Frame[] = []
  const ends: (() => void)[] = []
  const requested = vi.fn()
  const session = {
    requestReferenceSpace: () => Promise.resolve({}),
    requestAnimationFrame: (callback: Frame) => { frames.push(callback) },
    updateRenderState: () => Promise.resolve(),
    end: vi.fn(() => Promise.resolve()),
    addEventListener: (name: string, listener: () => void) => { if (name === 'end') ends.push(listener) },
    domOverlayState: { type: 'screen' },
  }
  vi.stubGlobal('navigator', { ...navigator, xr: {
    isSessionSupported: () => Promise.resolve(ar),
    requestSession: () => { requested(); return Promise.resolve(session) },
  } })
  vi.stubGlobal('XRWebGLLayer', function Layer() {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    ({ makeXRCompatible: () => Promise.resolve() })) as unknown as typeof HTMLCanvasElement.prototype.getContext)
  return {
    requested,
    ended: session.end,
    tick: (pose: unknown = POSE) => act(() => { frames.pop()?.(0, { getViewerPose: () => pose }) }),
    // The phone's own way out of AR, such as the back gesture.
    leaveAr: () => act(() => { for (const end of ends) end() }),
  }
}

function serving() {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path.endsWith('/scene.json')) return Response.json(scene)
    throw new Error(`Unexpected request: ${path}`)
  }))
}

const open = async (options?: Parameters<typeof phone>[0]) => {
  const hardware = phone(options)
  serving()
  await act(async () => { render(<Walk app="roam" />) })
  return hardware
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const spotButton = (index: number) => screen.getByRole('button', { name: new RegExp(spots[index].name) })
const lineUp = async (index = 0) => {
  await act(async () => { fireEvent.click(spotButton(index)) })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('waits where the scan’s own details cannot be read, rather than offering spots against nothing', async () => {
  phone()
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
  await act(async () => { render(<Walk app="roam" />) })
  expect(screen.getByRole('status').textContent).toContain('Looking at what this phone can do')
  expect(screen.queryByRole('button', { name: /floor/ })).toBeNull()
})

it('offers the taped spots, with the floor each one is on, and asks for no name', async () => {
  await open()
  expect(screen.getByRole('heading', { name: 'Walk the home' })).toBeTruthy()
  for (const spot of spots) expect(screen.getByRole('button', { name: new RegExp(spot.name) })).toBeTruthy()
  expect(screen.getAllByText(/floor \d/)).toHaveLength(spots.length)
  expect(screen.queryByRole('textbox')).toBeNull()
})

it('says so plainly where the phone cannot follow you, and offers the home instead', async () => {
  await open({ ar: false })
  expect(screen.getByRole('heading', { name: 'Walk the home' })).toBeTruthy()
  expect(screen.getByText(/can’t follow you through the room/)).toBeTruthy()
  expect(screen.queryByText(/note/)).toBeNull()
  expect(screen.getByRole('link', { name: 'Walk the home instead' }).getAttribute('href')).toBe('/apps/roam/')
  expect(screen.queryByRole('button', { name: /floor/ })).toBeNull()
})

it('says so where the phone refuses the session itself', async () => {
  phone()
  vi.stubGlobal('navigator', { ...navigator, xr: {
    isSessionSupported: () => Promise.resolve(true),
    requestSession: () => Promise.reject(new Error('refused')),
  } })
  serving()
  await act(async () => { render(<Walk app="roam" />) })
  await lineUp()
  expect(screen.getByText(/can’t follow you through the room/)).toBeTruthy()
})

it('lines up on a spot and walks, with Line up again first', async () => {
  const { tick } = await open()
  await lineUp()
  tick()
  expect(screen.getByRole('status').textContent).toBe(`Lined up at ${spots[0].name}. Walk around.`)
  const [primary, stop] = screen.getAllByRole('button')
  expect(primary.textContent).toBe('Line up again')
  expect(stop.textContent).toBe('Stop')
  expect(primary.getAttribute('data-variant')).toBe('default')
  expect(stop.getAttribute('data-variant')).toBe('ghost')
  expect(screen.queryByRole('button', { name: /note/ })).toBeNull()
})

it('says when tracking is lost, and drops it once the phone knows where it is again', async () => {
  const { tick } = await open()
  await lineUp()
  tick(null)
  expect(screen.getByText('no tracking')).toBeTruthy()
  tick()
  expect(screen.queryByText('no tracking')).toBeNull()
})

it('lines up again on the running session, rather than asking the phone twice', async () => {
  const { requested } = await open()
  await lineUp()
  fireEvent.click(button('Line up again'))
  expect(spotButton(1)).toBeTruthy()
  await lineUp(1)
  expect(screen.getByRole('status').textContent).toContain(spots[1].name)
  expect(requested).toHaveBeenCalledTimes(1)
})

it('stops the session and goes back to the spots', async () => {
  const { ended } = await open()
  await lineUp()
  fireEvent.click(button('Stop'))
  expect(ended).toHaveBeenCalled()
  expect(spotButton(0)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
})

it('goes back to the spots when the phone itself leaves AR', async () => {
  const { leaveAr, requested } = await open()
  await lineUp()
  leaveAr()
  expect(spotButton(0)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
  // The ended session is gone, so the next spot starts a fresh one.
  await lineUp()
  expect(requested).toHaveBeenCalledTimes(2)
})
