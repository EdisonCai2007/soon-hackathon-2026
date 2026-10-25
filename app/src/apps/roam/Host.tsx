import { useState } from 'react'
import { CopyText } from '@/components/CopyText'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inviteLink } from './invite'
import { rememberHostKey } from './live-room'
import { Chip, Pill } from './Pill'
import type { Peer } from './presence'

type Started = { roomId: string; hostKey: string }

/** Starts a room and goes to it, keeping the host's key in this browser. */
export function StartRoom({ app, onStarted }: { app: string; onStarted: (roomId: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  async function start() {
    setBusy(true)
    setFailed(false)
    try {
      const response = await fetch(`/apps/${app}/api/room`, { method: 'POST' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const { roomId, hostKey } = await response.json() as Started
      rememberHostKey(roomId, hostKey)
      onStarted(roomId)
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }
  return <div className="grid justify-items-end gap-2">
    {failed && <p className="rounded-full border-2 border-roam-peri bg-roam-cream px-3.5 py-1 text-sm font-medium">The room couldn’t be started. Try again.</p>}
    <Pill type="button" look="loud" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start a room'}</Pill>
  </div>
}

const DOT = 'size-7 shrink-0 rounded-full border-2 border-roam-cream ring-2 ring-roam-peri/40'
// The shared copy part keeps its own button, so its look is set from here to match ROAM's loud pill.
const LOUD_COPY = '[&_button]:h-12 [&_button]:rounded-full [&_button]:bg-roam-peri [&_button]:px-6 [&_button]:font-roam-label '
  + '[&_button]:text-2xl [&_button]:font-normal [&_button]:text-roam-cream [&_button]:lowercase [&_button]:tracking-[-0.07em]'

/** The link to share and who is in, with the host's own power to remove somebody. */
export function RoomPeople({ app, roomId, peers, host, onRemove }:
{ app: string; roomId: string; peers: readonly Peer[]; host: boolean; onRemove: (id: string) => void }) {
  return <div className="grid gap-3 rounded-[32px] border-2 border-roam-peri bg-roam-cream p-6 text-roam-ink">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-roam text-[28px] font-bold lowercase">Who’s in</h2>
      <Chip icon={<Users className="size-4" />}>{peers.length + 1} {peers.length === 0 ? 'person' : 'people'}</Chip>
    </div>
    <ul className="grid gap-2.5 font-semibold">
      <li className="flex items-center gap-2.5"><span aria-hidden="true" className={cn(DOT, 'bg-roam-ink')} />You</li>
      {peers.map((peer) => <li key={peer.member.id} className="flex flex-wrap items-center gap-2.5">
        <span aria-hidden="true" className={DOT} style={{ backgroundColor: peer.member.color }} />
        {peer.member.name}{peer.member.role === 'camera' && <span className="rounded-full border-[1.5px] border-roam-peri px-2.5 text-sm font-medium">in the room</span>}
        {host && <Pill type="button" size="small" className="ml-auto" onClick={() => onRemove(peer.member.id)}>Remove {peer.member.name}</Pill>}
      </li>)}
    </ul>
    {host && <div className={LOUD_COPY}><CopyText text={inviteLink(location.origin, app, roomId)} label="Copy the link" variant="default" /></div>}
  </div>
}
