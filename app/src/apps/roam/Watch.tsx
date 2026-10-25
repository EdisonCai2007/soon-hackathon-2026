import { Users, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Chip, IconPill } from './Pill'
import { playNow } from './play'
import type { Peer } from './presence'
import { card } from './Screen'

/** Somebody's video filling the view. Their own element is already decoding, so this one shares the stream. */
export function Watch({ peer, onClose }: { peer: Peer; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const element = video.current
    if (!element || !peer.stream) return
    element.srcObject = peer.stream
    playNow(element)
    return () => { element.srcObject = null }
  }, [peer.stream])

  return <div className="absolute inset-0 z-30 grid grid-rows-[1fr_auto] gap-4 bg-roam-ink/60 p-6">
    <div className="grid min-h-0 place-items-center">
      {peer.stream
        ? <video ref={video} className="max-h-full max-w-full rounded-[40px] border-[3px] border-roam-cream" playsInline muted aria-label={`${peer.member.name} up close`} />
        : <p className={cn(card, 'text-2xl font-bold')}>{peer.member.name} has no camera on.</p>}
    </div>
    <div className="flex flex-wrap items-center justify-center gap-3">
      <IconPill type="button" look="loud" icon={<X className="size-5" aria-hidden="true" />} onClick={onClose}>Close</IconPill>
      <Chip icon={<Users className="size-4" />}>{peer.member.name}</Chip>
    </div>
  </div>
}
