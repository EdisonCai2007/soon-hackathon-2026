// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { hostKeyFor, rememberHostKey, useLiveRoom } from './live-room'
import type { Member, RoomMessage } from './messages'
import { SEND_INTERVAL_MS } from './pose-feed'

type Listener = (event: unknown) => void

class FakeSocket {
  static OPEN = 1
  static last: FakeSocket | null = null
  readyState = FakeSocket.OPEN
  readonly sent: unknown[] = []
  closes = 0
  private listeners = new Map<string, Listener[]>()
  readonly url: string
  constructor(url: string) { this.url = url; FakeSocket.last = this }
  addEventListener(name: string, listener: Listener) { this.listeners.set(name, [...this.listeners.get(name) ?? [], listener]) }
  send(text: string) { this.sent.push(JSON.parse(text)) }
  close() { this.closes += 1 }
  hear(message: RoomMessage) {
    for (const listener of this.listeners.get('message') ?? []) listener({ data: JSON.stringify(message) })
  }
  break() { for (const listener of this.listeners.get('close') ?? []) listener({}) }
}

class FakeConnection {
  static instances: FakeConnection[] = []
  readonly remote: unknown[] = []
  constructor() { FakeConnection.instances.push(this) }
  addTrack() {}
  addEventListener(name: string, listener: Listener) { if (name === 'track') this.onTrack = listener }
  onTrack: Listener = () => {}
  createOffer() { return Promise.resolve({ type: 'offer' }) }
  createAnswer() { return Promise.resolve({ type: 'answer' }) }
  setLocalDescription() { return Promise.resolve() }
  setRemoteDescription(sdp: unknown) { this.remote.push(sdp); return Promise.resolve() }
  addIceCandidate() { return Promise.resolve() }
  close() {}
}

const member = (id: string, name = id): Member => ({ id, name, color: '#f97362', role: 'guest', pose: null })
const stream = () => ({ getTracks: () => [{ kind: 'video', stop: vi.fn() }] }) as unknown as MediaStream

function browser({ refuse = false } = {}) {
  FakeSocket.last = null
  FakeConnection.instances = []
  const resume = vi.fn(() => Promise.resolve())
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('RTCPeerConnection', FakeConnection)
  vi.stubGlobal('AudioContext', class { resume = resume; close = () => Promise.resolve() })
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: {
    getUserMedia: vi.fn(() => (refuse ? Promise.reject(new Error('no')) : Promise.resolve(stream()))),
  } })
  return { resume }
}

const join = async (roomId = 'room-1') => {
  const view = renderHook(() => useLiveRoom('roam', roomId, 'Jo', 'guest'))
  await act(async () => { await Promise.resolve() })
  return view
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

it('opens the room on this host, carrying the name and role', async () => {
  browser()
  await join()
  expect(FakeSocket.last?.url).toBe(`ws://localhost:3000/apps/roam/api/socket?id=room-1&name=Jo&role=guest`)
})

it('goes live with whoever is already in, and draws whoever joins after', async () => {
  browser()
  const view = await join()
  await act(async () => { FakeSocket.last!.hear({ type: 'welcome', self: member('me'), members: [member('a1', 'Alex')], capacity: 6 }) })
  expect(view.result.current.status).toBe('live')
  expect(view.result.current.peers.map((peer) => peer.member.name)).toEqual(['Alex'])
  // A connection is opened for the person already in the room.
  await vi.waitFor(() => expect(FakeConnection.instances).toHaveLength(1))

  await act(async () => { FakeSocket.last!.hear({ type: 'joined', member: member('b2', 'Sam') }) })
  expect(view.result.current.peers).toHaveLength(2)
  await vi.waitFor(() => expect(FakeConnection.instances).toHaveLength(2))
})

it('lets go of the connections when the room empties', async () => {
  browser()
  const view = await join()
  await act(async () => { FakeSocket.last!.hear({ type: 'welcome', self: member('me'), members: [member('a1')], capacity: 6 }) })
  await vi.waitFor(() => expect(FakeConnection.instances).toHaveLength(1))
  await act(async () => { FakeSocket.last!.hear({ type: 'left', id: 'a1' }) })
  expect(view.result.current.peers).toEqual([])
})

it('hands a handshake to the connection it belongs to', async () => {
  browser()
  await join()
  await act(async () => { FakeSocket.last!.hear({ type: 'welcome', self: member('me'), members: [member('a1')], capacity: 6 }) })
  await vi.waitFor(() => expect(FakeConnection.instances).toHaveLength(1))
  await act(async () => { FakeSocket.last!.hear({ type: 'signal', from: 'a1', data: { sdp: { type: 'offer' } } }) })
  await vi.waitFor(() => expect(FakeConnection.instances[0].remote).toEqual([{ type: 'offer' }]))
})

it('draws a person once their video arrives', async () => {
  browser()
  const view = await join()
  await act(async () => { FakeSocket.last!.hear({ type: 'welcome', self: member('me'), members: [member('a1')], capacity: 6 }) })
  await vi.waitFor(() => expect(FakeConnection.instances).toHaveLength(1))
  const theirs = stream()
  await act(async () => { FakeConnection.instances[0].onTrack({ streams: [theirs] }) })
  expect(view.result.current.peers[0].stream).toBe(theirs)
})

it('tells the room where this person stands, ten times a second', async () => {
  browser()
  const view = await join()
  await act(async () => { FakeSocket.last!.hear({ type: 'welcome', self: member('me'), members: [], capacity: 6 }) })
  const now = vi.spyOn(performance, 'now')
  now.mockReturnValue(1000)
  act(() => view.result.current.tell({ x: 1, y: 0, z: 0, yaw: 0 }))
  now.mockReturnValue(1000 + SEND_INTERVAL_MS / 2)
  act(() => view.result.current.tell({ x: 2, y: 0, z: 0, yaw: 0 }))
  now.mockReturnValue(1000 + SEND_INTERVAL_MS)
  act(() => view.result.current.tell({ x: 3, y: 0, z: 0, yaw: 0 }))
  expect(FakeSocket.last!.sent.filter((one) => (one as { type: string }).type === 'pose')).toEqual([
    { type: 'pose', pose: { x: 1, y: 0, z: 0, yaw: 0 } },
    { type: 'pose', pose: { x: 3, y: 0, z: 0, yaw: 0 } },
  ])
  now.mockRestore()
})

it('hands the page its own camera and sends what it cast', async () => {
  browser()
  const view = await join()
  await act(async () => { FakeSocket.last!.hear({ type: 'welcome', self: member('me'), members: [], capacity: 6 }) })
  // The camera opened for this person's figure is the one their hands are read from.
  expect(view.result.current.local).not.toBeNull()
  act(() => view.result.current.cast('purple'))
  expect(FakeSocket.last!.sent.at(-1)).toEqual({ type: 'cast', technique: 'purple' })
})

it("removes somebody only with the host's own key", async () => {
  browser()
  const view = await join('room-2')
  await act(async () => { FakeSocket.last!.hear({ type: 'welcome', self: member('me'), members: [member('a1')], capacity: 6 }) })
  act(() => view.result.current.remove('a1'))
  expect(FakeSocket.last!.sent.some((one) => (one as { type: string }).type === 'remove')).toBe(false)

  rememberHostKey('room-2', 'key-1')
  act(() => view.result.current.remove('a1'))
  expect(FakeSocket.last!.sent.at(-1)).toEqual({ type: 'remove', id: 'a1', key: 'key-1' })
})

it("keeps the host's key in this browser alone, and copes where there is no storage", () => {
  rememberHostKey('room-3', 'key-3')
  expect(hostKeyFor('room-3')).toBe('key-3')
  expect(hostKeyFor('room-4')).toBeNull()
  const broken = { getItem: () => { throw new Error('no storage') }, setItem: () => { throw new Error('no storage') } }
  vi.stubGlobal('sessionStorage', broken)
  rememberHostKey('room-5', 'key-5')
  expect(hostKeyFor('room-5')).toBeNull()
})

it('starts the sound on the first press, and only once', async () => {
  const { resume } = browser()
  const view = await join()
  expect(view.result.current.soundBlocked).toBe(true)
  await act(async () => { view.result.current.unlock() })
  expect(view.result.current.soundBlocked).toBe(false)
  await act(async () => { view.result.current.unlock() })
  expect(resume).toHaveBeenCalledTimes(1)
})

it('says so when the sound card refuses to start', async () => {
  browser()
  vi.stubGlobal('AudioContext', class { resume = () => Promise.reject(new Error('no')); close = () => Promise.resolve() })
  const view = await join()
  await act(async () => { view.result.current.unlock() })
  expect(view.result.current.soundBlocked).toBe(true)
})

it('asks for the camera and says plainly when it is refused', async () => {
  browser({ refuse: true })
  const view = await join()
  expect(view.result.current.failure).toMatch(/needs your camera and microphone/)
  expect(FakeSocket.last).toBeNull()
})

it('says when the room drops', async () => {
  browser()
  const view = await join()
  await act(async () => { FakeSocket.last!.hear({ type: 'welcome', self: member('me'), members: [], capacity: 6 }) })
  await act(async () => { FakeSocket.last!.break() })
  expect(view.result.current.status).toBe('dropped')
})

it('leaves the room behind when the page goes', async () => {
  browser()
  const view = await join()
  const socket = FakeSocket.last!
  view.unmount()
  expect(socket.closes).toBe(1)
})

it('lets go of a camera that arrives after the page left', async () => {
  browser()
  const tracks = [{ kind: 'video', stop: vi.fn() }]
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: {
    getUserMedia: () => Promise.resolve({ getTracks: () => tracks } as unknown as MediaStream),
  } })
  const view = renderHook(() => useLiveRoom('roam', 'room-6', 'Jo', 'guest'))
  view.unmount()
  await act(async () => { await Promise.resolve() })
  expect(tracks[0].stop).toHaveBeenCalled()
})

it('copes with a sound card that refuses to close', async () => {
  browser()
  vi.stubGlobal('AudioContext', class { resume = () => Promise.resolve(); close = () => Promise.reject(new Error('busy')) })
  const view = await join()
  view.unmount()
  await act(async () => { await Promise.resolve() })
})

it('works where the browser has no sound card at all', async () => {
  browser()
  vi.stubGlobal('AudioContext', undefined)
  const view = await join()
  expect(view.result.current.audio).toBeNull()
  await act(async () => { view.result.current.unlock() })
  expect(view.result.current.soundBlocked).toBe(true)
})
