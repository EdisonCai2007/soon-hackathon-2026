// The room's socket, thin: it parses what arrives, sends what the page asks, and says when it dropped.
// A dropped room is not reconnected behind the person's back; the page offers to rejoin.
import { readRoomMessage, type RoomMessage, type Sent } from './messages'

export type RoomSocket = { send: (message: Sent) => void; close: () => void }
export type SocketHooks = { onMessage: (message: RoomMessage) => void; onDrop: () => void }

/** The room's address: the same host as the page, over the socket scheme. */
export function socketUrl(origin: string, app: string, roomId: string, name: string, role: 'guest' | 'camera'): string {
  const url = new URL(`/apps/${app}/api/socket`, origin)
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
  url.search = new URLSearchParams({ id: roomId, name, role }).toString()
  return url.toString()
}

export function openRoom(url: string, hooks: SocketHooks): RoomSocket {
  const socket = new WebSocket(url)
  let leaving = false
  socket.addEventListener('message', (event: MessageEvent) => {
    const message = readRoomMessage(event.data)
    if (message) hooks.onMessage(message)
  })
  // Our own leaving is not a drop; anything else is.
  const dropped = () => { if (!leaving) hooks.onDrop() }
  socket.addEventListener('close', dropped)
  socket.addEventListener('error', dropped)
  return {
    send: (message) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)) },
    close: () => { leaving = true; socket.close() },
  }
}
