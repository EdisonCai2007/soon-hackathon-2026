// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { routes } from '../../router'
import type { RoomViewer } from './RoomViewer'
import { parseScene, poseFor } from './scene'

// The 3D part is stood in, so these tests drive the page through the events the viewer sends.
const viewer = vi.hoisted(() => ({ props: null as ComponentProps<typeof RoomViewer> | null, mounts: 0 }))
vi.mock('./RoomViewer', async () => {
  const { useEffect } = await import('react')
  return {
    RoomViewer: (props: ComponentProps<typeof RoomViewer>) => {
      viewer.props = props
      useEffect(() => { viewer.mounts += 1 }, [])
      return <div data-testid="viewer" />
    },
  }
})

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  viewer.props = null
  viewer.mounts = 0
})

// Each app page loads on its own, so every test waits for the one its address asks for. The wait is
// generous: the whole suite loads these pages at once, and a slow machine is not a broken page.
const heading = (name: string) => () => screen.findByRole('heading', { name }, { timeout: 5000 })

const NOTES = '/apps/roam/api/notes?place=home'

const open = async (at = '/apps/roam/', answers: Record<string, unknown> = {}, arrived = heading('ROAM')) => {
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/access/apps') return Response.json({ state: 'current', role: 'employee', revision: 1, apps: ['roam'] })
    if (path in answers) return Response.json(answers[path])
    // The place is read on every visit; a page with nothing left in it is the usual answer.
    if (path === NOTES) return Response.json({ notes: [] })
    throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
  }))
  const router = createMemoryRouter(routes, { initialEntries: [at] })
  await act(async () => {
    render(<RouterProvider router={router} />)
  })
  await arrived()
  await waitFor(() => expect(screen.queryByText('Checking phone movement…')).toBeNull())
  return router
}
const send = (event: Parameters<ComponentProps<typeof RoomViewer>['onEvent']>[0]) => act(() => viewer.props!.onEvent(event))
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const camera = () => screen.getByLabelText('Camera') as HTMLSelectElement

it('shows a placeholder while the room loads, with the views waiting for it', async () => {
  await open()
  expect(viewer.props).toMatchObject({ sceneUrl: '/apps/roam/scene.json', splatUrl: '/apps/roam/room.spz', pose: null })
  expect(screen.getByRole('status').textContent).toBe('Loading the room…')
  for (const name of ['Room view', 'Overview', 'Top view']) expect(button(name).disabled).toBe(true)
  expect(camera().disabled).toBe(true)
  expect(screen.getByText(/W\/A\/S\/D to move/)).toBeTruthy()

  send({ type: 'progress', progress: 0.42 })
  expect(screen.getByRole('status').textContent).toBe('Loading the room… 42%')
})

it('opens at Room view with the scan’s counts, and each view or camera moves the camera', async () => {
  await open()
  send({ type: 'ready', scene })
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText('665 video views · 546,977 splats')).toBeTruthy()
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'room'))
  expect(camera().options).toHaveLength(665)
  expect(camera().value).toBe('0')

  fireEvent.click(button('Overview'))
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'overview'))
  fireEvent.click(button('Top view'))
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'top'))
  fireEvent.change(camera(), { target: { value: '3' } })
  expect(viewer.props!.pose).toEqual(poseFor(scene, 3))
  expect(camera().value).toBe('3')
  fireEvent.click(button('Room view'))
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'room'))
  expect(camera().value).toBe('0')
})

it('says why the room failed and tries again', async () => {
  await open()
  send({ type: 'error', message: 'The room didn’t load.' })
  expect(screen.queryByTestId('viewer')).toBeNull()
  expect(screen.getByText('The room didn’t load. Check your connection, then try again.')).toBeTruthy()

  fireEvent.click(button('Try again'))
  expect(screen.getByTestId('viewer')).toBeTruthy()
  expect(viewer.mounts).toBe(2)
  expect(screen.getByRole('status').textContent).toBe('Loading the room…')
})

it('gives a plain message on a browser without 3D', async () => {
  await open()
  send({ type: 'no-webgl' })
  expect(screen.getByText(/This browser can’t show 3D/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  expect(screen.queryByTestId('viewer')).toBeNull()
})

it('walks the scan alone, with nobody in it and no room in the address', async () => {
  await open()
  send({ type: 'ready', scene })
  // Nobody to draw or hear, and nobody to tell: where the walker stands is still kept, because walking the scan
  // with your own body starts from it, and a press still lands, because a note left here can be opened alone.
  expect(viewer.props).toMatchObject({ peers: undefined, audio: undefined, onStance: expect.any(Function), onPick: expect.any(Function) })
  expect(screen.queryByText('sound off')).toBeNull()
  expect(button('Start a room')).toBeTruthy()
})

it('starts a room and goes to its link', async () => {
  const router = await open('/apps/roam/', { '/apps/roam/api/room': { roomId: '0123456789abcdef0123', hostKey: 'k1' } })
  await act(async () => { fireEvent.click(button('Start a room')) })
  expect(router.state.location.pathname).toBe('/apps/roam/r/0123456789abcdef0123')
  expect(screen.getByRole('heading', { name: 'Join the room' })).toBeTruthy()
})

it("opens a shared link at the way in, and the camera link at the phone's screen", async () => {
  await open('/apps/roam/r/0123456789abcdef0123', {}, heading('Join the room'))
  cleanup()

  await open('/apps/roam/phone/0123456789abcdef0123', { '/apps/roam/scene.json': scene }, heading('Be the camera'))
  cleanup()

  await open('/apps/roam/leave', { '/apps/roam/scene.json': scene }, heading('Leave a note'))
})

const NOTE = { id: 'a'.repeat(16), kind: 'text', spot: { x: 1, y: -3.9, z: 2, yaw: 0 }, author: 'Dana',
  words: 'The boiler resets behind this panel.', media: false, createdAt: Date.UTC(2026, 9, 20) }
const CLIP = { ...NOTE, id: 'b'.repeat(16), kind: 'voice', words: '', media: true }
const left = (...notes: unknown[]) => ({ [NOTES]: { notes } })
const press = (note: { id: string }) => act(() => viewer.props!.onPick!({ kind: 'note', id: note.id }, poseFor(scene, 0)))

it('says the place holds nothing until somebody leaves something', async () => {
  await open()
  expect(screen.getByText('nothing left here yet')).toBeTruthy()
  cleanup()
  await open('/apps/roam/', left(NOTE, CLIP))
  expect(screen.getByText('2 notes left here')).toBeTruthy()
})

it('opens a note left here on a press, and closes it again', async () => {
  await open('/apps/roam/', left(NOTE))
  send({ type: 'ready', scene })
  expect(screen.getByText('1 note left here')).toBeTruthy()
  expect(viewer.props!.notes).toEqual([NOTE])

  await press(NOTE)
  expect(screen.getByText(NOTE.words)).toBeTruthy()
  expect(screen.getByText(/Dana/)).toBeTruthy()
  // Nothing to remove: this browser neither left it nor keeps the place.
  expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()

  fireEvent.click(button('Close'))
  expect(screen.queryByText(NOTE.words)).toBeNull()
})

it('shows a photo left here, and offers the keeper the way to take it back', async () => {
  localStorage.setItem('roam-keeper-home', 'k'.repeat(48))
  const photo = { ...NOTE, id: 'c'.repeat(16), kind: 'photo', words: '', media: true }
  await open('/apps/roam/', left(photo))
  send({ type: 'ready', scene })
  await press(photo)
  const shown = screen.getByAltText('Left here by Dana') as HTMLImageElement
  expect(shown.src).toContain(`/apps/roam/api/note-media?place=home&id=${photo.id}`)
  expect(button('Remove')).toBeTruthy()
  localStorage.clear()
})

it("plays a note's voice from where it was left, and stops it", async () => {
  const node = () => ({ connect: (next: unknown) => next, disconnect: vi.fn() })
  const source = { ...node(), buffer: null as unknown, start: vi.fn(), stop: vi.fn(), onended: null as unknown }
  vi.stubGlobal('AudioContext', class {
    currentTime = 0
    destination = {}
    createBufferSource = () => source
    createGain = () => ({ ...node(), gain: { setTargetAtTime: vi.fn() } })
    createPanner = () => ({ ...node(), panningModel: '', distanceModel: '', rolloffFactor: 1 })
    decodeAudioData = async () => ({ duration: 1 })
  })
  await open('/apps/roam/', { ...left(CLIP), '/apps/roam/api/note-media?place=home&id=bbbbbbbbbbbbbbbb': {} })
  send({ type: 'ready', scene })
  await press(CLIP)

  await act(async () => { fireEvent.click(button('Play from here')) })
  expect(source.start).toHaveBeenCalled()
  expect(viewer.props!.voice).not.toBeNull()

  fireEvent.click(button('Stop'))
  expect(source.stop).toHaveBeenCalled()
  expect(viewer.props!.voice).toBeNull()
  expect(button('Play from here')).toBeTruthy()
})

it('shows the note but plays nothing where the browser has no sound card, or no room loaded yet', async () => {
  await open('/apps/roam/', left(CLIP))
  await press(CLIP)
  await act(async () => { fireEvent.click(button('Play from here')) })
  expect(viewer.props!.voice).toBeNull()
  expect(button('Play from here')).toBeTruthy()
})

it('leaves the Play button alone when the clip itself cannot be fetched', async () => {
  vi.stubGlobal('AudioContext', class {
    currentTime = 0
    destination = {}
    createBufferSource = () => ({ connect: (next: unknown) => next, start: vi.fn(), stop: vi.fn() })
    createGain = () => ({ connect: (next: unknown) => next, gain: { setTargetAtTime: vi.fn() } })
    createPanner = () => ({ connect: (next: unknown) => next })
    decodeAudioData = async () => ({ duration: 1 })
  })
  await open('/apps/roam/', left(CLIP))
  send({ type: 'ready', scene })
  await press(CLIP)
  await act(async () => { fireEvent.click(button('Play from here')) })
  expect(viewer.props!.voice).toBeNull()
})

it('keeps a note that was refused a removal, and still closes the panel', async () => {
  localStorage.setItem(`roam-note-${NOTE.id}`, 'stale')
  await open('/apps/roam/', left(NOTE))
  const first = vi.mocked(fetch).getMockImplementation()!
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) =>
    path === '/apps/roam/api/note' && init?.method === 'DELETE' ? new Response('no', { status: 403 }) : first(path, init)))
  send({ type: 'ready', scene })
  await press(NOTE)
  await act(async () => { fireEvent.click(button('Remove')) })
  expect(screen.getByText('1 note left here')).toBeTruthy()
  expect(screen.queryByText(NOTE.words)).toBeNull()
  localStorage.clear()
})

it('does nothing when a press lands on a person while walking the place alone', async () => {
  await open()
  send({ type: 'ready', scene })
  await act(() => viewer.props!.onPick!({ kind: 'peer', id: 'a1' }, poseFor(scene, 0)))
  expect(screen.queryByText(/up close/)).toBeNull()
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'room'))
})

it('lets whoever left a note take it back, and forgets it afterwards', async () => {
  localStorage.setItem(`roam-note-${NOTE.id}`, 'f'.repeat(48))
  const removals: RequestInit[] = []
  await open('/apps/roam/', left(NOTE))
  const first = vi.mocked(fetch).getMockImplementation()!
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/apps/roam/api/note' && init?.method === 'DELETE') {
      removals.push(init)
      return Response.json({ removed: NOTE.id })
    }
    if (path === NOTES && removals.length > 0) return Response.json({ notes: [] })
    return first(path, init)
  }))
  send({ type: 'ready', scene })
  await press(NOTE)

  await act(async () => { fireEvent.click(button('Remove')) })
  expect(JSON.parse(String(removals[0].body))).toEqual({ place: 'home', id: NOTE.id, secret: 'f'.repeat(48) })
  expect(screen.getByText('nothing left here yet')).toBeTruthy()
  expect(screen.queryByText(NOTE.words)).toBeNull()
  expect(localStorage.getItem(`roam-note-${NOTE.id}`)).toBeNull()
})
