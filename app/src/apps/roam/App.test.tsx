// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

const open = async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path === '/api/access/apps') return Response.json({ state: 'current', role: 'employee', revision: 1, apps: ['roam'] })
    throw new Error(`Unexpected request: ${path}`)
  }))
  const router = createMemoryRouter(routes, { initialEntries: ['/apps/roam/'] })
  await act(async () => {
    render(<RouterProvider router={router} />)
  })
  await screen.findByRole('heading', { level: 1, name: 'ROAM' })
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
  expect(screen.getByText('22 video views · 173,224 splats')).toBeTruthy()
  expect(viewer.props!.pose).toEqual(poseFor(scene, 'room'))
  expect(camera().options).toHaveLength(22)
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
