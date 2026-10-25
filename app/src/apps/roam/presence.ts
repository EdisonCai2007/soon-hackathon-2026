// Who is in the room, where they are, and whether this page is still in it. One pure reducer, so the
// screens and the viewer read the same room and the rules are tested without a socket.
import type { Member, Pose, RoomMessage } from './messages'
import { nextMotion, type Motion } from './pose-feed'
import type { TechniqueName } from './techniques'

/** What somebody cast and when, so the viewer can draw it from its own clock. */
type Casting = { technique: TechniqueName; at: number }
export type Peer = { member: Member; motion: Motion | null; stream: MediaStream | null; cast: Casting | null }
type RoomStatus = 'joining' | 'live' | 'full' | 'removed' | 'dropped'

export type PresenceState = {
  status: RoomStatus
  self: Member | null
  peers: Peer[]
  capacity: number
}

export type PresenceEvent =
  | { type: 'message'; message: RoomMessage; at: number }
  | { type: 'stream'; id: string; stream: MediaStream }
  | { type: 'dropped' }

export const initialPresence: PresenceState = { status: 'joining', self: null, peers: [], capacity: 0 }

// The room reports members in no particular order, so the page keeps one: by name, then by id for two
// people with the same name.
const ordered = (peers: Peer[]): Peer[] =>
  [...peers].sort((one, two) => one.member.name.localeCompare(two.member.name) || one.member.id.localeCompare(two.member.id))

const asPeer = (member: Member, at: number): Peer =>
  ({ member, motion: member.pose ? nextMotion(null, member.pose, at) : null, stream: null, cast: null })

const casting = (peers: Peer[], id: string, technique: TechniqueName, at: number): Peer[] =>
  peers.map((peer) => (peer.member.id === id ? { ...peer, cast: { technique, at } } : peer))

const withPeer = (peers: Peer[], member: Member, at: number): Peer[] =>
  ordered([...peers.filter((peer) => peer.member.id !== member.id), asPeer(member, at)])

const moved = (peers: Peer[], id: string, pose: Pose, at: number): Peer[] =>
  peers.map((peer) => (peer.member.id === id ? { ...peer, motion: nextMotion(peer.motion, pose, at) } : peer))

function fromRoom(state: PresenceState, message: RoomMessage, at: number): PresenceState {
  switch (message.type) {
    case 'welcome':
      return { status: 'live', self: message.self, capacity: message.capacity,
        peers: ordered(message.members.map((member) => asPeer(member, at))) }
    case 'joined':
      return { ...state, peers: withPeer(state.peers, message.member, at) }
    case 'left':
      return { ...state, peers: state.peers.filter((peer) => peer.member.id !== message.id) }
    case 'pose':
      return { ...state, peers: moved(state.peers, message.id, message.pose, at) }
    case 'cast':
      return { ...state, peers: casting(state.peers, message.id, message.technique, at) }
    case 'closed':
      return { ...state, status: message.reason === 'full' ? 'full' : 'removed', peers: [] }
    // A handshake is the connections' business, not the room's picture.
    case 'signal':
      return state
  }
}

/** The room as the page knows it. A message about somebody who is not here changes nothing. */
export function presenceReducer(state: PresenceState, event: PresenceEvent): PresenceState {
  if (event.type === 'dropped') return state.status === 'live' || state.status === 'joining' ? { ...state, status: 'dropped', peers: [] } : state
  if (event.type === 'stream') {
    return { ...state, peers: state.peers.map((peer) => (peer.member.id === event.id ? { ...peer, stream: event.stream } : peer)) }
  }
  return fromRoom(state, event.message, event.at)
}

/** Everyone whose video and voice this page should be connected to. */
export const peerIds = (state: PresenceState): string[] => state.peers.map((peer) => peer.member.id)
