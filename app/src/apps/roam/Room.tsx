import { useState } from 'react'
import { useCasting } from './casting'
import { RoomPeople } from './Host'
import { cameraLink } from './invite'
import { Join } from './Join'
import { hostKeyFor, useLiveRoom } from './live-room'
import { Pill } from './Pill'
import { Scan } from './Scan'
import { Centered } from './Screen'
import { Wordmark } from './Wordmark'

const STOPPED: Record<string, string> = {
  full: 'This room is full. Ask whoever shared the link to start another one.',
  removed: 'You were removed from this room.',
  dropped: 'The room’s connection dropped.',
}

function Stopped({ message }: { message: string }) {
  return <Centered>
    <h1><Wordmark className="h-10" /><span className="sr-only">ROAM</span></h1>
    <p className="text-2xl font-bold">{message}</p>
    <Pill type="button" look="loud" onClick={() => location.reload()}>Try again</Pill>
  </Centered>
}

/** Inside a room: everyone is drawn in the scan, heard from where they stand, and listed beside it. */
function Live({ app, roomId, name }: { app: string; roomId: string; name: string }) {
  const room = useLiveRoom(app, roomId, name, 'guest')
  // The camera the room already opened for this person's figure is the one their hands are read from.
  const casting = useCasting(room.local, room.cast)
  const host = hostKeyFor(roomId) !== null
  const stopped = STOPPED[room.status]
  if (room.failure) return <Stopped message={room.failure} />
  if (stopped) return <Stopped message={stopped} />
  return <Scan app={app} live={{
    peers: room.peers, audio: room.audio, soundBlocked: room.soundBlocked, unlock: room.unlock, tell: room.tell, casting,
    people: <RoomPeople app={app} roomId={roomId} peers={room.peers} host={host} onRemove={room.remove} />,
  }} />
}

/** A room from a link: name yourself, then you are in it. */
export function Room({ app, roomId }: { app: string; roomId: string }) {
  const [name, setName] = useState<string | null>(null)
  if (name === null) return <Join onJoin={setName} cameraOffer={cameraLink(location.origin, app, roomId)} />
  return <Live app={app} roomId={roomId} name={name} />
}
