// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RoomPeople, StartRoom } from './Host'
import { hostKeyFor } from './live-room'
import type { Member } from './messages'
import type { Peer } from './presence'

const peer = (id: string, name: string, role: Member['role'] = 'guest'): Peer =>
  ({ member: { id, name, color: '#4fb8ff', role, pose: null }, motion: null, stream: null })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

const button = (name: string | RegExp) => screen.getByRole('button', { name })

it("starts a room, keeps the host's key, and goes to it", async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ roomId: 'r1', hostKey: 'k1' }))))
  const started = vi.fn()
  render(<StartRoom app="roam" onStarted={started} />)
  await act(async () => { fireEvent.click(button('Start a room')) })
  expect(started).toHaveBeenCalledWith('r1')
  expect(hostKeyFor('r1')).toBe('k1')
})

it('says so when the room can not be started, and lets it be tried again', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('no', { status: 503 }))))
  render(<StartRoom app="roam" onStarted={vi.fn()} />)
  await act(async () => { fireEvent.click(button('Start a room')) })
  expect(screen.getByText('The room couldn’t be started. Try again.')).toBeTruthy()
  expect((button('Start a room') as HTMLButtonElement).disabled).toBe(false)
})

it('lists who is in, counting this person too', () => {
  render(<RoomPeople app="roam" roomId="r1" peers={[]} host={false} onRemove={vi.fn()} />)
  expect(screen.getByText('1 person')).toBeTruthy()
  cleanup()
  render(<RoomPeople app="roam" roomId="r1" peers={[peer('a1', 'Alex'), peer('b2', 'Sam', 'camera')]} host={false} onRemove={vi.fn()} />)
  expect(screen.getByText('3 people')).toBeTruthy()
  expect(screen.getByText('Alex')).toBeTruthy()
  // The person holding the phone in the real room is marked as such.
  expect(screen.getByText('in the room')).toBeTruthy()
})

it('gives the host the link to share and the power to remove, and a guest neither', () => {
  const removed = vi.fn()
  const { rerender } = render(<RoomPeople app="roam" roomId="r1" peers={[peer('a1', 'Alex')]} host={false} onRemove={removed} />)
  expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Copy the link' })).toBeNull()

  rerender(<RoomPeople app="roam" roomId="r1" peers={[peer('a1', 'Alex')]} host onRemove={removed} />)
  fireEvent.click(button('Remove Alex'))
  expect(removed).toHaveBeenCalledWith('a1')
  expect(screen.getByRole('button', { name: 'Copy the link' })).toBeTruthy()
  expect(screen.getByLabelText('The message to copy')).toHaveProperty('value', 'http://localhost:3000/apps/roam/r/r1')
})
