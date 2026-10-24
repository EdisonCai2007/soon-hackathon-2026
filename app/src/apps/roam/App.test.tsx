// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { routes } from '../../router'

vi.mock('./RoomViewer', () => ({ RoomViewer: ({ base }: { base: string }) => <p>viewer at {base}</p> }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('opens at /apps/roam/ with the heading and the viewer', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ state: 'current', role: 'employee', revision: 1, apps: ['roam'] })))
  const router = createMemoryRouter(routes, { initialEntries: ['/apps/roam/'] })
  await act(async () => {
    render(<RouterProvider router={router} />)
  })
  expect(await screen.findByRole('heading', { level: 1, name: 'ROAM' })).toBeTruthy()
  expect(screen.getByText('viewer at /apps/roam')).toBeTruthy()
})
