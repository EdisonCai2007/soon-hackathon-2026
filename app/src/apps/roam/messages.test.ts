import { expect, it } from 'vitest'
import { readRoomMessage } from './messages'

const pose = { x: 1, y: 2, z: 3, yaw: 0.5 }
const member = { id: 'a1', name: 'Jo', color: '#f97362', role: 'guest', pose: null }
const read = (body: unknown) => readRoomMessage(JSON.stringify(body))

it('reads every message the room sends', () => {
  expect(read({ type: 'welcome', self: member, members: [{ ...member, id: 'b2', pose }], capacity: 6 }))
    .toEqual({ type: 'welcome', self: member, members: [{ ...member, id: 'b2', pose }], capacity: 6 })
  expect(read({ type: 'joined', member })).toEqual({ type: 'joined', member })
  expect(read({ type: 'left', id: 'a1' })).toEqual({ type: 'left', id: 'a1' })
  expect(read({ type: 'pose', id: 'a1', pose })).toEqual({ type: 'pose', id: 'a1', pose })
  expect(read({ type: 'signal', from: 'a1', data: { sdp: 'v=0' } })).toEqual({ type: 'signal', from: 'a1', data: { sdp: 'v=0' } })
  expect(read({ type: 'cast', id: 'a1', technique: 'purple' })).toEqual({ type: 'cast', id: 'a1', technique: 'purple' })
  expect(read({ type: 'closed', reason: 'full' })).toEqual({ type: 'closed', reason: 'full' })
  expect(read({ type: 'closed', reason: 'removed' })).toEqual({ type: 'closed', reason: 'removed' })
})

it('refuses anything it can not act on', () => {
  expect(readRoomMessage(new Blob())).toBeNull()
  expect(readRoomMessage('not json')).toBeNull()
  expect(read({ type: 'shout' })).toBeNull()
  expect(read({ type: 'left' })).toBeNull()
  expect(read({ type: 'pose', id: 'a1', pose: { x: 1, y: 2, z: 3 } })).toBeNull()
  expect(read({ type: 'joined', member: { ...member, role: 'owner' } })).toBeNull()
  expect(read({ type: 'welcome', self: member, members: [], capacity: 0 })).toBeNull()
  expect(read({ type: 'closed', reason: 'bored' })).toBeNull()
  expect(read({ type: 'cast', id: 'a1', technique: 'fireball' })).toBeNull()
})
