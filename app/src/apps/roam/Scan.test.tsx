// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Casting } from './casting'
import type { ArViewHooks } from './ar-view'
import type { RoomViewer } from './RoomViewer'
import { anchorAt } from './placement'
import { parseScene } from './scene'
import { Scan, type Live } from './Scan'

// The 3D part is stood in: these tests are about the bar over it, and the events the viewer sends up.
const viewer = vi.hoisted(() => ({ props: null as ComponentProps<typeof RoomViewer> | null }))
vi.mock('./RoomViewer', () => ({
  RoomViewer: (props: ComponentProps<typeof RoomViewer>) => {
    viewer.props = props
    return <div data-testid="viewer" />
  },
}))

// The phone's session and the drawing in it, stood in: a test drives the poses the view would report.
const walked = vi.hoisted(() => ({
  views: [] as { hooks: ArViewHooks; lineUp: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[],
  sessions: [] as { stop: ReturnType<typeof vi.fn> }[],
  supported: false,
}))
vi.mock('./ar-session', () => ({
  arSupported: vi.fn(async () => walked.supported),
  startAr: vi.fn(async () => {
    const session = { stop: vi.fn(), overlaid: true }
    walked.sessions.push(session)
    return session
  }),
}))
vi.mock('./ar-view', () => ({
  makeArView: vi.fn((_url: string, hooks: (typeof walked.views)[number]['hooks']) => {
    const view = { hooks, lineUp: vi.fn(), dispose: vi.fn(), show: vi.fn(), shown: () => true, take: vi.fn() }
    walked.views.push(view)
    return view
  }),
}))

const casting = (over: Partial<Casting> = {}): Casting => ({ step: 'off', seen: null, mine: null, turn: vi.fn(), ...over })

const live = (over: Partial<Live> = {}): Live => ({
  peers: [], audio: null, soundBlocked: false, unlock: () => {}, tell: () => {}, people: null, casting: casting(), ...over,
})

const open = async (over: Partial<Live> = {}) => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] })))))
  await act(async () => { render(<Scan app="roam" live={live(over)} />) })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  viewer.props = null
  walked.views.length = 0
  walked.sessions.length = 0
  walked.supported = false
})

it('offers hand reading, says when it is on, and names the sign it can see', async () => {
  await open({ casting: casting({ step: 'on', seen: 'Hollow purple' }) })
  expect(screen.getByText('hands on')).toBeTruthy()
  expect(screen.getByText('seeing: Hollow purple')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Hands off' })).toBeTruthy()
})

it('says the model is loading while the reader starts', async () => {
  await open({ casting: casting({ step: 'starting' }) })
  expect(screen.getByText('reading your hands…')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Hands off' })).toBeTruthy()
})

it('offers nothing about hands when the scan is walked alone', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] })))))
  await act(async () => { render(<Scan app="roam" />) })
  expect(screen.queryByRole('button', { name: 'Hands on' })).toBeNull()
})

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))
const spot = anchorAt(scene, 0)
const ready = () => act(() => viewer.props!.onEvent({ type: 'ready', scene }))
const stand = () => act(() => viewer.props!.onStance!({ x: spot.x, y: spot.floor + 1.2, z: spot.z, yaw: spot.yaw }))

it('offers no walk where the phone cannot follow the person', async () => {
  await open()
  ready()
  stand()
  expect(screen.queryByRole('button', { name: 'Walk it' })).toBeNull()
})

it('waits for the viewer to say where it stands before offering the walk', async () => {
  walked.supported = true
  await open()
  // The walk starts from where the view already looks from, so there is nothing to offer until it says.
  expect(screen.queryByRole('button', { name: 'Walk it' })).toBeNull()
  ready()
  stand()
  expect(screen.getByRole('button', { name: 'Walk it' })).toBeTruthy()
})

it('walks with the person, then hands the page back looking where they got to', async () => {
  walked.supported = true
  await open()
  ready()
  stand()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Walk it' })) })
  expect(screen.queryByRole('button', { name: 'Walk it' })).toBeNull()
  expect(screen.getByText(/Waiting for the phone/)).toBeTruthy()
  expect(walked.views[0].lineUp).not.toHaveBeenCalled()

  act(() => walked.views[0].hooks.onPose!({ x: 0, y: 1.2, z: 0, yaw: 0 }))
  expect(screen.getByText(/You’re in the home/)).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Carry on from here' })) })
  expect(walked.views[0].lineUp).toHaveBeenCalledTimes(2)

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })) })
  expect(walked.sessions[0].stop).toHaveBeenCalled()
  // The page carries on from the place the walk reached, rather than where it started.
  expect(viewer.props!.pose!.position[0]).toBeCloseTo(spot.x, 6)
  expect(screen.getByRole('button', { name: 'Walk it' })).toBeTruthy()
})

it('says so plainly when the phone cannot carry the walk, and offers it again', async () => {
  walked.supported = true
  await open()
  ready()
  stand()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Walk it' })) })
  act(() => walked.views[0].hooks.onGaveUp!('rate'))
  expect(screen.getByRole('alert').textContent).toMatch(/couldn’t draw the home/)
  expect(screen.getByRole('button', { name: 'Walk it' })).toBeTruthy()
})

it('ignores ordinary view poses during a walk and until the reached pose is restored', async () => {
  walked.supported = true
  const tell = vi.fn()
  await open({ tell })
  ready()
  stand()
  const ordinary = viewer.props!.onStance!
  tell.mockClear()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Walk it' })) })
  expect(viewer.props!.paused).toBe(true)
  act(() => ordinary({ x: 99, y: 99, z: 99, yaw: 1 }))
  expect(tell).not.toHaveBeenCalled()
  act(() => walked.views[0].hooks.onPose!({ x: 2, y: 1.6, z: -3, yaw: 0.9 }))
  expect(tell).toHaveBeenCalledTimes(1)
  const reached = tell.mock.calls[0][0]
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })) })
  expect(viewer.props!.paused).toBe(false)
  act(() => ordinary({ ...reached, yaw: reached.yaw + 1 }))
  expect(tell).toHaveBeenCalledTimes(1)
  act(() => viewer.props!.onStance!(reached))
  expect(tell).toHaveBeenCalledTimes(2)
})

it('shows progress and paused tracking with recenter disabled', async () => {
  walked.supported = true
  await open()
  ready()
  stand()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Walk it' })) })
  act(() => walked.views[0].hooks.onProgress!(0.4))
  expect(screen.getByText('Loading the room… 40%')).toBeTruthy()
  act(() => walked.views[0].hooks.onPose!({ x: 2, y: 1.6, z: -3, yaw: 0.9 }))
  act(() => walked.views[0].hooks.onProgress!(1))
  act(() => walked.views[0].hooks.onTracking!(false))
  expect(screen.getByText(/Tracking paused/)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Carry on from here' }) as HTMLButtonElement).disabled).toBe(true)
})
