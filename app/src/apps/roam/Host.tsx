import { useState } from 'react'
import { CopyText } from '@/components/CopyText'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { inviteLink } from './invite'
import { rememberHostKey } from './live-room'
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
  return <div className="grid justify-items-start gap-2">
    <Button type="button" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start a room'}</Button>
    {failed && <p className="text-sm text-muted-foreground">The room couldn’t be started. Try again.</p>}
  </div>
}

/** The link to share and who is in, with the host's own power to remove somebody. */
export function RoomPeople({ app, roomId, peers, host, onRemove }:
{ app: string; roomId: string; peers: readonly Peer[]; host: boolean; onRemove: (id: string) => void }) {
  return <div className="grid gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-base font-medium">Who’s in</h2>
      <Badge variant="secondary">{peers.length + 1} {peers.length === 0 ? 'person' : 'people'}</Badge>
    </div>
    <ul className="grid gap-2">
      <li className="flex items-center gap-2 text-sm"><span aria-hidden="true">●</span>You</li>
      {peers.map((peer) => <li key={peer.member.id} className="flex items-center gap-2 text-sm">
        <span aria-hidden="true" style={{ color: peer.member.color }}>●</span>
        {peer.member.name}{peer.member.role === 'camera' && <span className="text-muted-foreground">in the room</span>}
        {host && <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(peer.member.id)}>Remove {peer.member.name}</Button>}
      </li>)}
    </ul>
    {host && <CopyText text={inviteLink(location.origin, app, roomId)} label="Copy the link" variant="default" />}
  </div>
}
