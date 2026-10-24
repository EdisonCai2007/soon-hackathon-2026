import { expect, it } from 'vitest'
import type { Member, RoomMessage } from './messages'
import { initialPresence, peerIds, presenceReducer, type PresenceState } from './presence'
import { SEND_INTERVAL_MS } from './pose-feed'

const member = (id: string, name: string, pose: Member['pose'] = null): Member =>
  ({ id, name, color: '#f97362', role: 'guest', pose })
const pose = { x: 1, y: 0, z: 2, yaw: 0 }

const heard = (state: PresenceState, message: RoomMessage, at = 1000) => presenceReducer(state, { type: 'message', message, at })
const live = (members: Member[] = []) => heard(initialPresence, { type: 'welcome', self: member('me', 'Me'), members, capacity: 6 })

it('starts out joining, with nobody in the room', () => {
  expect(initialPresence).toEqual({ status: 'joining', self: null, peers: [], capacity: 0 })
})

it('goes live on the welcome, holding who was already there in a settled order', () => {
  const state = live([member('b2', 'Sam'), member('a1', 'Alex', pose)])
  expect(state.status).toBe('live')
  expect(state.self?.name).toBe('Me')
  expect(state.capacity).toBe(6)
  expect(state.peers.map((peer) => peer.member.name)).toEqual(['Alex', 'Sam'])
  // Somebody already standing somewhere is drawn there, not at the room's origin.
  expect(state.peers[0].motion?.to).toEqual(pose)
  expect(state.peers[1].motion).toBeNull()
})

it('keeps two people with the same name in a settled order', () => {
  const state = live([member('b2', 'Sam'), member('a1', 'Sam')])
  expect(state.peers.map((peer) => peer.member.id)).toEqual(['a1', 'b2'])
})

it('adds whoever joins and drops whoever leaves', () => {
  const joined = heard(live(), { type: 'joined', member: member('a1', 'Alex') })
  expect(peerIds(joined)).toEqual(['a1'])
  // The same person twice is still one person.
  const again = heard(joined, { type: 'joined', member: member('a1', 'Alex', pose) })
  expect(peerIds(again)).toEqual(['a1'])
  expect(peerIds(heard(again, { type: 'left', id: 'a1' }))).toEqual([])
  expect(peerIds(heard(again, { type: 'left', id: 'nobody' }))).toEqual(['a1'])
})

it('moves a person as their positions arrive, and ignores one for a stranger', () => {
  const joined = heard(live(), { type: 'joined', member: member('a1', 'Alex') })
  const moved = heard(joined, { type: 'pose', id: 'a1', pose }, 1000)
  expect(moved.peers[0].motion).toEqual({ from: pose, to: pose, at: 1000 })
  const next = { ...pose, x: 3 }
  const again = heard(moved, { type: 'pose', id: 'a1', pose: next }, 1000 + SEND_INTERVAL_MS)
  expect(again.peers[0].motion).toMatchObject({ from: pose, to: next })
  expect(heard(moved, { type: 'pose', id: 'nobody', pose: next }).peers[0].motion).toEqual(moved.peers[0].motion)
})

it('holds a person video once it arrives, and ignores one for a stranger', () => {
  const stream = {} as MediaStream
  const joined = heard(live(), { type: 'joined', member: member('a1', 'Alex') })
  expect(presenceReducer(joined, { type: 'stream', id: 'a1', stream }).peers[0].stream).toBe(stream)
  expect(presenceReducer(joined, { type: 'stream', id: 'nobody', stream }).peers[0].stream).toBeNull()
})

it('says when the room was full and when this person was removed', () => {
  const joined = heard(live(), { type: 'joined', member: member('a1', 'Alex') })
  expect(heard(joined, { type: 'closed', reason: 'full' })).toMatchObject({ status: 'full', peers: [] })
  expect(heard(joined, { type: 'closed', reason: 'removed' })).toMatchObject({ status: 'removed', peers: [] })
})

it("leaves the room's picture alone for a handshake", () => {
  const state = live([member('a1', 'Alex')])
  expect(heard(state, { type: 'signal', from: 'a1', data: { sdp: 'v=0' } })).toBe(state)
})

it('says when the connection dropped, but never argues with being removed', () => {
  const state = live([member('a1', 'Alex')])
  expect(presenceReducer(state, { type: 'dropped' })).toMatchObject({ status: 'dropped', peers: [] })
  expect(presenceReducer(initialPresence, { type: 'dropped' })).toMatchObject({ status: 'dropped' })
  const removed = heard(state, { type: 'closed', reason: 'removed' })
  expect(presenceReducer(removed, { type: 'dropped' })).toBe(removed)
})
