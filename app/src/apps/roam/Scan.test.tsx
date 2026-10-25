// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Casting } from './casting'
import type { RoomViewer } from './RoomViewer'
import { Scan, type Live } from './Scan'

// The 3D part is stood in: these tests are about the bar over it.
vi.mock('./RoomViewer', () => ({ RoomViewer: (_props: ComponentProps<typeof RoomViewer>) => <div data-testid="viewer" /> }))

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
