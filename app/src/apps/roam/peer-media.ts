// One direct connection per person: this page's camera and microphone go straight to each of theirs, and
// the room only carries the handshake. mesh.ts settles who offers; this holds the connections open.
import { connectionConfig, shouldOffer } from './mesh'
import { playNow } from './play'

export type MeshHooks = { onStream: (id: string, stream: MediaStream) => void; onSignal: (to: string, data: unknown) => void }
type Handshake = { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
type Peer = { connection: RTCPeerConnection; audio?: HTMLAudioElement }
export type PeerMesh = {
  sync: (present: readonly string[]) => void
  accept: (from: string, data: unknown) => Promise<void>
  close: () => void
}

/** Chrome will not let Web Audio pull from a remote stream until an element in the page is playing it.
 *  Silent and hidden: the voice the room hears is the placed one, built on the sound card. */
function attach(stream: MediaStream): HTMLAudioElement {
  const element = document.createElement('audio')
  element.srcObject = stream
  element.muted = true
  element.autoplay = true
  element.hidden = true
  document.body.append(element)
  playNow(element)
  return element
}

const describes = (data: unknown): Handshake => (typeof data === 'object' && data !== null ? data as Handshake : {})

export function openMesh(local: MediaStream, selfId: string, hooks: MeshHooks): PeerMesh {
  const peers = new Map<string, Peer>()

  const connect = (id: string) => {
    const connection = new RTCPeerConnection(connectionConfig)
    const peer: Peer = { connection }
    peers.set(id, peer)
    for (const track of local.getTracks()) connection.addTrack(track, local)
    connection.addEventListener('track', (event: RTCTrackEvent) => {
      const [stream] = event.streams
      peer.audio = attach(stream)
      hooks.onStream(id, stream)
    })
    connection.addEventListener('icecandidate', (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) hooks.onSignal(id, { candidate: event.candidate.toJSON() })
    })
    return peer
  }

  const offer = async (id: string, connection: RTCPeerConnection) => {
    const sdp = await connection.createOffer()
    await connection.setLocalDescription(sdp)
    hooks.onSignal(id, { sdp })
  }

  const drop = (id: string, peer: Peer) => {
    peer.connection.close()
    peer.audio?.remove()
    peers.delete(id)
  }

  return {
    sync(present) {
      for (const [id, peer] of [...peers]) if (!present.includes(id)) drop(id, peer)
      for (const id of present) {
        if (peers.has(id)) continue
        const { connection } = connect(id)
        // Only one side offers, so the other waits for it instead of both talking at once.
        if (shouldOffer(selfId, id)) void offer(id, connection)
      }
    },
    async accept(from, data) {
      const { sdp, candidate } = describes(data)
      const { connection } = peers.get(from) ?? connect(from)
      if (candidate) return connection.addIceCandidate(candidate)
      if (!sdp) return
      await connection.setRemoteDescription(sdp)
      if (sdp.type !== 'offer') return
      const answer = await connection.createAnswer()
      await connection.setLocalDescription(answer)
      hooks.onSignal(from, { sdp: answer })
    },
    close() {
      for (const [id, peer] of [...peers]) drop(id, peer)
      for (const track of local.getTracks()) track.stop()
    },
  }
}
