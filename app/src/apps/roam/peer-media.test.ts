// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { openMesh } from './peer-media'

type Listener = (event: unknown) => void

// A connection, stood in: it records what was asked of it and lets a test fire its events.
class FakeConnection {
  static instances: FakeConnection[] = []
  readonly tracks: MediaStreamTrack[] = []
  readonly local: RTCSessionDescriptionInit[] = []
  readonly remote: RTCSessionDescriptionInit[] = []
  readonly candidates: RTCIceCandidateInit[] = []
  closed = 0
  private listeners = new Map<string, Listener[]>()
  readonly config: RTCConfiguration
  constructor(config: RTCConfiguration) { this.config = config; FakeConnection.instances.push(this) }
  addTrack(track: MediaStreamTrack) { this.tracks.push(track) }
  addEventListener(name: string, listener: Listener) { this.listeners.set(name, [...this.listeners.get(name) ?? [], listener]) }
  createOffer() { return Promise.resolve({ type: 'offer', sdp: 'offer-sdp' } as RTCSessionDescriptionInit) }
  createAnswer() { return Promise.resolve({ type: 'answer', sdp: 'answer-sdp' } as RTCSessionDescriptionInit) }
  setLocalDescription(sdp: RTCSessionDescriptionInit) { this.local.push(sdp); return Promise.resolve() }
  setRemoteDescription(sdp: RTCSessionDescriptionInit) { this.remote.push(sdp); return Promise.resolve() }
  addIceCandidate(candidate: RTCIceCandidateInit) { this.candidates.push(candidate); return Promise.resolve() }
  close() { this.closed += 1 }
  fire(name: string, event: unknown) { for (const listener of this.listeners.get(name) ?? []) listener(event) }
}

const track = (kind: string) => ({ kind, stop: vi.fn() }) as unknown as MediaStreamTrack
const stream = (tracks: MediaStreamTrack[] = [track('video'), track('audio')]) =>
  ({ getTracks: () => tracks }) as unknown as MediaStream

const mesh = (selfId = 'a1') => {
  FakeConnection.instances = []
  vi.stubGlobal('RTCPeerConnection', FakeConnection)
  const hooks = { onStream: vi.fn(), onSignal: vi.fn() }
  const local = stream()
  return { open: openMesh(local, selfId, hooks), hooks, local }
}

afterEach(() => vi.unstubAllGlobals())

it('offers to whoever it should, and waits to be offered to by the rest', async () => {
  const { open, hooks } = mesh('a1')
  open.sync(['b2'])
  await vi.waitFor(() => expect(hooks.onSignal).toHaveBeenCalled())
  expect(hooks.onSignal.mock.calls[0]).toEqual(['b2', { sdp: { type: 'offer', sdp: 'offer-sdp' } }])
  expect(FakeConnection.instances[0].local).toEqual([{ type: 'offer', sdp: 'offer-sdp' }])
  // Its own camera and microphone go to the connection.
  expect(FakeConnection.instances[0].tracks).toHaveLength(2)

  const waiting = mesh('z9')
  waiting.open.sync(['b2'])
  await Promise.resolve()
  expect(waiting.hooks.onSignal).not.toHaveBeenCalled()
})

it('answers an offer, and sends nothing back for an answer', async () => {
  const { open, hooks } = mesh('z9')
  open.sync(['b2'])
  await open.accept('b2', { sdp: { type: 'offer', sdp: 'theirs' } })
  expect(FakeConnection.instances[0].remote).toEqual([{ type: 'offer', sdp: 'theirs' }])
  expect(hooks.onSignal.mock.calls).toEqual([['b2', { sdp: { type: 'answer', sdp: 'answer-sdp' } }]])

  await open.accept('b2', { sdp: { type: 'answer', sdp: 'theirs' } })
  expect(hooks.onSignal).toHaveBeenCalledTimes(1)
})

it('takes a handshake for somebody it has no connection to yet', async () => {
  const { open } = mesh('z9')
  await open.accept('b2', { sdp: { type: 'offer', sdp: 'theirs' } })
  expect(FakeConnection.instances).toHaveLength(1)
})

it('passes on the ways it can be reached, and ignores the end of them', () => {
  const { open, hooks } = mesh()
  open.sync(['b2'])
  const candidate = { candidate: 'candidate:1', toJSON: () => ({ candidate: 'candidate:1' }) }
  FakeConnection.instances[0].fire('icecandidate', { candidate })
  FakeConnection.instances[0].fire('icecandidate', { candidate: null })
  expect(hooks.onSignal.mock.calls.filter(([, data]) => 'candidate' in (data as object)))
    .toEqual([['b2', { candidate: { candidate: 'candidate:1' } }]])
})

it('takes a handshake message that is not a handshake at all', async () => {
  const { open, hooks } = mesh('z9')
  open.sync(['b2'])
  await open.accept('b2', 'nonsense')
  await open.accept('b2', null)
  expect(hooks.onSignal).not.toHaveBeenCalled()
})

it("hands a person's video up, playing it silently so the sound card lets it through", () => {
  const { open, hooks } = mesh()
  open.sync(['b2'])
  const theirs = stream()
  FakeConnection.instances[0].fire('track', { streams: [theirs] })
  expect(hooks.onStream.mock.calls).toEqual([['b2', theirs]])
  const audio = document.querySelector('audio')
  expect(audio?.muted).toBe(true)
  // Letting go of that person takes their silent element with them.
  open.sync([])
  expect(document.querySelector('audio')).toBeNull()
})

it('takes a way to be reached for a connection it already has', async () => {
  const { open } = mesh('z9')
  open.sync(['b2'])
  await open.accept('b2', { candidate: { candidate: 'candidate:2' } })
  expect(FakeConnection.instances[0].candidates).toEqual([{ candidate: 'candidate:2' }])
})

it('lets go of whoever left, and of everything on the way out', () => {
  const local = [track('video'), track('audio')]
  FakeConnection.instances = []
  vi.stubGlobal('RTCPeerConnection', FakeConnection)
  const open = openMesh(stream(local), 'a1', { onStream: vi.fn(), onSignal: vi.fn() })
  open.sync(['b2', 'c3'])
  expect(FakeConnection.instances).toHaveLength(2)
  open.sync(['c3'])
  expect(FakeConnection.instances[0].closed).toBe(1)
  // Syncing the same room again opens nothing new.
  open.sync(['c3'])
  expect(FakeConnection.instances).toHaveLength(2)
  open.close()
  expect(FakeConnection.instances[1].closed).toBe(1)
  expect(local.every((one) => (one.stop as unknown as { mock: { calls: unknown[] } }).mock.calls.length === 1)).toBe(true)
  // Closing twice over is harmless: there is nobody left to let go of.
  open.close()
})
