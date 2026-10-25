// The glue: one socket, one direct connection per person, and the room's picture in a reducer. Everything
// it decides lives in presence.ts, mesh.ts and pose-feed.ts; this opens and closes things in the right order.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Pose, Sent } from './messages'
import { openMesh, type PeerMesh } from './peer-media'
import { initialPresence, peerIds, presenceReducer, type PresenceState } from './presence'
import { dueToSend } from './pose-feed'
import { openRoom, socketUrl, type RoomSocket } from './room-socket'
import type { TechniqueName } from './techniques'

export type Role = 'guest' | 'camera'
export type LiveRoom = PresenceState & {
  audio: AudioContext | null
  soundBlocked: boolean
  unlock: () => void
  tell: (pose: Pose) => void
  remove: (id: string) => void
  /** This page's own camera, already open for its figure, so the hand reader needs no second one. */
  local: MediaStream | null
  cast: (technique: TechniqueName) => void
  failure: string | null
}

const KEY = (roomId: string) => `roam-host-${roomId}`

/** The host's key for a room, kept in this browser alone: it is what tells the host apart. */
export const hostKeyFor = (roomId: string): string | null => {
  try { return sessionStorage.getItem(KEY(roomId)) }
  catch { return null }
}
export const rememberHostKey = (roomId: string, key: string): void => {
  try { sessionStorage.setItem(KEY(roomId), key) }
  catch { /* a browser with no storage still hosts, it just forgets after a reload */ }
}

const CAMERA = { video: { facingMode: 'user' }, audio: true }

/** Joins the room and keeps this page in it until it is left. */
export function useLiveRoom(app: string, roomId: string, name: string, role: Role): LiveRoom {
  const [state, dispatch] = useReducer(presenceReducer, initialPresence)
  const [failure, setFailure] = useState<string | null>(null)
  const [sound, setSound] = useState<'blocked' | 'running'>('blocked')
  const [camera, setCamera] = useState<MediaStream | null>(null)
  const audio = useMemo(() => (typeof AudioContext === 'undefined' ? null : new AudioContext()), [])
  const room = useRef<RoomSocket | null>(null)
  const mesh = useRef<PeerMesh | null>(null)
  const told = useRef<number | null>(null)

  useEffect(() => {
    let left = false
    const send = (message: Sent) => room.current?.send(message)
    void (async () => {
      let local: MediaStream
      try { local = await navigator.mediaDevices.getUserMedia(CAMERA) }
      catch { setFailure('This page needs your camera and microphone to put you in the room.'); return }
      if (left) {
        for (const track of local.getTracks()) track.stop()
        return
      }
      setCamera(local)
      const socket = openRoom(socketUrl(location.origin, app, roomId, name, role), {
        onMessage: (message) => {
          if (message.type === 'welcome') mesh.current = openMesh(local, message.self.id, {
            onStream: (id, stream) => dispatch({ type: 'stream', id, stream }),
            onSignal: (to, data) => send({ type: 'signal', to, data }),
          })
          if (message.type === 'signal') void mesh.current?.accept(message.from, message.data)
          dispatch({ type: 'message', message, at: performance.now() })
        },
        onDrop: () => dispatch({ type: 'dropped' }),
      })
      room.current = socket
    })()
    return () => {
      left = true
      mesh.current?.close()
      mesh.current = null
      room.current?.close()
      room.current = null
      setCamera(null)
    }
  }, [app, roomId, name, role])

  // Whoever is in the room is who this page should be connected to.
  const ids = peerIds(state).join(',')
  useEffect(() => { mesh.current?.sync(ids === '' ? [] : ids.split(',')) }, [ids])

  const tell = useCallback((pose: Pose) => {
    const now = performance.now()
    if (!dueToSend(told.current, now)) return
    told.current = now
    room.current?.send({ type: 'pose', pose })
  }, [])

  const cast = useCallback((technique: TechniqueName) => room.current?.send({ type: 'cast', technique }), [])

  const remove = useCallback((id: string) => {
    const key = hostKeyFor(roomId)
    if (key) room.current?.send({ type: 'remove', id, key })
  }, [roomId])

  // Browsers hold sound until the person acts, so the first press on the page starts it.
  const unlock = useCallback(() => {
    if (!audio || sound === 'running') return
    void audio.resume().then(() => setSound('running')).catch(() => setSound('blocked'))
  }, [audio, sound])

  useEffect(() => () => { void audio?.close().catch(() => {}) }, [audio])

  return { ...state, audio, soundBlocked: sound === 'blocked', unlock, tell, remove, local: camera, cast, failure }
}
