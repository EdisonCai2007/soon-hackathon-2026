// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { openRoom, socketUrl } from './room-socket'

// The browser's socket, stood in: it keeps its listeners and what was sent, and never opens anything.
class FakeSocket {
  static OPEN = 1
  static instances: FakeSocket[] = []
  readyState = FakeSocket.OPEN
  readonly sent: string[] = []
  closes = 0
  private listeners = new Map<string, ((event: unknown) => void)[]>()
  readonly url: string
  constructor(url: string) { this.url = url; FakeSocket.instances.push(this) }
  addEventListener(name: string, listener: (event: unknown) => void) {
    this.listeners.set(name, [...this.listeners.get(name) ?? [], listener])
  }
  send(text: string) { this.sent.push(text) }
  close() { this.closes += 1; this.fire('close') }
  fire(name: string, event: unknown = {}) { for (const listener of this.listeners.get(name) ?? []) listener(event) }
}

const hooks = () => ({ onMessage: vi.fn(), onDrop: vi.fn() })
const open = () => {
  FakeSocket.instances = []
  vi.stubGlobal('WebSocket', FakeSocket)
  const listening = hooks()
  const room = openRoom('ws://site.example/apps/roam/api/socket', listening)
  return { room, listening, socket: FakeSocket.instances[0] }
}

afterEach(() => vi.unstubAllGlobals())

it("builds the room address on the page's own host, over the socket scheme", () => {
  expect(socketUrl('https://site.example', 'roam', 'abc', 'Sam Taylor', 'guest'))
    .toBe('wss://site.example/apps/roam/api/socket?id=abc&name=Sam+Taylor&role=guest')
  expect(socketUrl('http://localhost:5173', 'roam', 'abc', '', 'camera'))
    .toBe('ws://localhost:5173/apps/roam/api/socket?id=abc&name=&role=camera')
})

it('passes on what it can read and ignores what it can not', () => {
  const { socket, listening } = open()
  socket.fire('message', { data: JSON.stringify({ type: 'left', id: 'a1' }) })
  socket.fire('message', { data: 'not json' })
  expect(listening.onMessage.mock.calls).toEqual([[{ type: 'left', id: 'a1' }]])
})

it('sends what the page asks while the socket is open, and nothing once it is not', () => {
  const { room, socket } = open()
  room.send({ type: 'pose', pose: { x: 1, y: 2, z: 3, yaw: 0 } })
  socket.readyState = 3
  room.send({ type: 'pose', pose: { x: 9, y: 9, z: 9, yaw: 0 } })
  expect(socket.sent).toEqual([JSON.stringify({ type: 'pose', pose: { x: 1, y: 2, z: 3, yaw: 0 } })])
})

it('says the room dropped when it closes or breaks by itself', () => {
  const closed = open()
  closed.socket.fire('close')
  expect(closed.listening.onDrop).toHaveBeenCalledTimes(1)
  const broken = open()
  broken.socket.fire('error')
  expect(broken.listening.onDrop).toHaveBeenCalledTimes(1)
})

it('does not call our own leaving a drop', () => {
  const { room, socket, listening } = open()
  room.close()
  expect(socket.closes).toBe(1)
  expect(listening.onDrop).not.toHaveBeenCalled()
})
