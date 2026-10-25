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

const open = async (at = '/apps/roam/', answers: Record<string, unknown> = {}, arrived = heading('ROAM')) => {
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/access/apps') return Response.json({ state: 'current', role: 'employee', revision: 1, apps: ['roam'] })
    if (path in answers) return Response.json(answers[path])
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

it('shows a placeholder while the room loads, with the views waiting for it', async () => {
  await open()
  expect(viewer.props).toMatchObject({ sceneUrl: '/apps/roam/scene.json', splatUrl: '/apps/roam/room.spz', pose: null })
  expect(screen.getByRole('status').textContent).toBe('Loading the room…')
  for (const name of ['Room view', 'Overview', 'Top view']) expect(button(name).disabled).toBe(true)
  expect(screen.getByText(/W\/A\/S\/D to move/)).toBeTruthy()

  send({ type: 'progress', progress: 0.42 })
  expect(screen.getByRole('status').textContent).toBe('Loading the room… 42%')
})

it('opens at Room view, and each view moves the camera', async () => {
  await open()
  send({ type: 'ready', scene })
  expect(screen.queryByRole('status')).toBeNull()
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'room'))

  fireEvent.click(button('Overview'))
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'overview'))
  fireEvent.click(button('Top view'))
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'top'))
  fireEvent.click(button('Room view'))
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'room'))
})

afterEach(() => history.replaceState(null, '', '/'))

it('shows no placing tools, even at an address ending ?tools', async () => {
  history.replaceState(null, '', '/apps/roam/?tools')
  await open()
  send({ type: 'ready', scene })
  expect(screen.queryByLabelText('Camera')).toBeNull()
  expect(screen.queryByText(/video views/)).toBeNull()
  expect(screen.queryByLabelText('Camera position')).toBeNull()
  expect(viewer.props!.onWhere).toBeUndefined()
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
  // with your own body starts from it, and a press still lands, though alone it watches nobody.
  expect(viewer.props).toMatchObject({ peers: undefined, audio: undefined, onStance: expect.any(Function), onPick: expect.any(Function) })
  expect(screen.queryByRole('img', { name: 'sound off' })).toBeNull()
  expect(screen.queryByText(/left here/)).toBeNull()
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

  await open('/apps/roam/leave', { '/apps/roam/scene.json': scene }, heading('Walk the home'))
})

it('does nothing when a press lands on a person while walking the place alone', async () => {
  await open()
  send({ type: 'ready', scene })
  await act(() => viewer.props!.onPick!('a1', poseFor(scene, 0)))
  expect(screen.queryByText(/up close/)).toBeNull()
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'room'))
})
