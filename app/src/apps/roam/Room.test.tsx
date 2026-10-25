// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join as joinPath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { LiveRoom } from './live-room'
import type { Member } from './messages'
import { nextMotion } from './pose-feed'
import type { Peer } from './presence'
import { Room } from './Room'
import type { RoomViewer } from './RoomViewer'
import { parseScene, poseFor } from './scene'

const scene = parseScene(JSON.parse(readFileSync(joinPath(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))

// The 3D part and the room's plumbing are stood in, so these tests drive the page.
const viewer = vi.hoisted(() => ({ props: null as ComponentProps<typeof RoomViewer> | null }))
vi.mock('./RoomViewer', () => ({
  RoomViewer: (props: ComponentProps<typeof RoomViewer>) => {
    viewer.props = props
    return <div data-testid="viewer" />
  },
}))

const fakes = vi.hoisted(() => ({ room: null as LiveRoom | null, unlocks: 0, removed: [] as string[], host: false }))
vi.mock('./live-room', () => ({
  hostKeyFor: () => (fakes.host ? 'key-1' : null),
  rememberHostKey: () => {},
  useLiveRoom: () => fakes.room,
}))

const member = (id: string, name: string): Member => ({ id, name, color: '#4fb8ff', role: 'guest', pose: null })
const peer = (id: string, name: string, stream: MediaStream | null = null): Peer =>
  ({ member: member(id, name), motion: null, stream, cast: null })

const live = (over: Partial<LiveRoom> = {}): LiveRoom => ({
  status: 'live', self: member('me', 'Me'), peers: [], capacity: 6, audio: null, soundBlocked: true,
  unlock: () => { fakes.unlocks += 1 }, tell: () => {}, remove: (id) => fakes.removed.push(id),
  local: null, cast: () => {}, failure: null, ...over,
})

afterEach(() => {
  cleanup()
  Object.assign(fakes, { room: null, unlocks: 0, removed: [], host: false })
  viewer.props = null
})

const open = async (over: Partial<LiveRoom> = {}) => {
  fakes.room = live(over)
  let view!: ReturnType<typeof render>
  await act(async () => { view = render(<Room app="roam" roomId="r1" />) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Go live' })) })
  // The room changes underneath the page; a fresh render is how a test plays that back.
  return (next: Partial<LiveRoom>) => {
    fakes.room = live({ ...over, ...next })
    return act(() => { view.rerender(<Room app="roam" roomId="r1" />) })
  }
}
const ready = () => act(() => viewer.props!.onEvent({ type: 'ready', scene }))

it('asks who you are before putting you in the room', async () => {
  fakes.room = live()
  await act(async () => { render(<Room app="roam" roomId="r1" />) })
  expect(screen.getByRole('heading', { name: 'Join the room' })).toBeTruthy()
  expect(screen.queryByTestId('viewer')).toBeNull()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Go live' })) })
  expect(screen.getByTestId('viewer')).toBeTruthy()
})

it('draws the people in the room and lists them beside it', async () => {
  await open({ peers: [peer('a1', 'Alex'), peer('b2', 'Sam')] })
  await ready()
  expect(viewer.props!.peers).toHaveLength(2)
  expect(screen.getByText('3 people')).toBeTruthy()
  expect(screen.getByText('Alex')).toBeTruthy()
})

it('says sound is off until the first press on the page starts it', async () => {
  await open()
  expect(screen.getByText('sound off')).toBeTruthy()
  fireEvent.pointerDown(screen.getByText('ROAM'))
  expect(fakes.unlocks).toBe(1)
  cleanup()
  await open({ soundBlocked: false })
  expect(screen.queryByText('sound off')).toBeNull()
})

it('keeps hands off until it is asked, and says so when they can not be read', async () => {
  await open()
  expect(screen.queryByText('hands on')).toBeNull()
  // With no camera behind the page there is nothing to read, and the bar says so rather than failing quietly.
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Hands on' })) })
  expect(screen.getByText('This browser can’t read your hands.')).toBeTruthy()
})

it('draws a cast where the person who made it is standing', async () => {
  const motion = nextMotion(null, { x: 1, y: -3.9, z: 2, yaw: 0 }, 1000)
  const casting = { ...peer('a1', 'Alex'), motion, cast: { technique: 'purple' as const, at: 500 } }
  const sent: unknown[] = []
  await open({ peers: [casting], tell: (stance) => sent.push(stance) })
  await ready()
  expect(viewer.props!.casts).toEqual([{ id: 'a1', technique: 'purple', at: 500, where: { x: 1, y: -3.9, z: 2, yaw: 0 } }])
  // Where this page stands goes to the room and is kept, so its own cast has somewhere to be drawn.
  const here = { x: 0, y: -3.9, z: 0, yaw: 1 }
  await act(async () => { viewer.props!.onStance!(here) })
  expect(sent).toEqual([here])
})

it('watches a person up close and comes back to the same spot', async () => {
  const stream = {} as MediaStream
  await open({ peers: [peer('a1', 'Alex', stream)] })
  await ready()
  const saved = poseFor(scene, 7)
  act(() => viewer.props!.onPick!({ kind: 'peer', id: 'a1' }, saved))
  expect(screen.getByLabelText('Alex up close')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByLabelText('Alex up close')).toBeNull()
  expect(viewer.props!.pose).toEqual(saved)
})

it('says so when the person being watched has no camera on', async () => {
  await open({ peers: [peer('a1', 'Alex')] })
  await ready()
  act(() => viewer.props!.onPick!({ kind: 'peer', id: 'a1' }, poseFor(scene, 0)))
  expect(screen.getByText('Alex has no camera on.')).toBeTruthy()
})

it('closes the view of somebody who leaves while being watched', async () => {
  const stream = {} as MediaStream
  const change = await open({ peers: [peer('a1', 'Alex', stream)] })
  await ready()
  act(() => viewer.props!.onPick!({ kind: 'peer', id: 'a1' }, poseFor(scene, 0)))
  expect(screen.getByLabelText('Alex up close')).toBeTruthy()
  await change({ peers: [] })
  expect(screen.queryByLabelText('Alex up close')).toBeNull()
})

it('lets the host remove somebody', async () => {
  fakes.host = true
  await open({ peers: [peer('a1', 'Alex')] })
  fireEvent.click(screen.getByRole('button', { name: 'Remove Alex' }))
  expect(fakes.removed).toEqual(['a1'])
})

it('fills the screen with the room, and leaves it again', async () => {
  await open()
  const box = screen.getByTestId('viewer').parentElement!
  const request = vi.fn(() => Promise.resolve())
  box.requestFullscreen = request
  fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
  expect(request).toHaveBeenCalled()

  // A browser that refuses to fill the screen is not an error on the page.
  box.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')))
  fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
  await act(async () => { await Promise.resolve() })

  const exit = vi.fn(() => Promise.resolve())
  Object.defineProperty(document, 'fullscreenElement', { value: box, configurable: true })
  document.exitFullscreen = exit
  fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
  expect(exit).toHaveBeenCalled()
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
})

it('says plainly when the room is full, this person was removed, or the connection dropped', async () => {
  for (const [status, words] of [['full', /room is full/], ['removed', /were removed/], ['dropped', /connection dropped/]] as const) {
    await open({ status })
    expect(screen.getByText(words)).toBeTruthy()
    expect(screen.queryByTestId('viewer')).toBeNull()
    cleanup()
  }
})

it('offers to try the room again', async () => {
  const reload = vi.fn()
  vi.stubGlobal('location', { ...location, origin: 'http://localhost:3000', reload })
  await open({ status: 'dropped' })
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(reload).toHaveBeenCalled()
  vi.unstubAllGlobals()
})

it('says plainly when the camera was refused', async () => {
  await open({ failure: 'This page needs your camera and microphone to put you in the room.' })
  expect(screen.getByText(/needs your camera and microphone/)).toBeTruthy()
})
