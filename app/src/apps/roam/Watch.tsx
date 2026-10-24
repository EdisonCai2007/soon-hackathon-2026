import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { playNow } from './play'
import type { Peer } from './presence'

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

  return <div className="absolute inset-0 z-10 grid grid-rows-[1fr_auto] bg-black/80 p-4">
    <div className="grid min-h-0 place-items-center">
      {peer.stream
        ? <video ref={video} className="max-h-full max-w-full rounded-xl" playsInline muted aria-label={`${peer.member.name} up close`} />
        : <p className="text-white">{peer.member.name} has no camera on.</p>}
    </div>
    <div className="flex items-center gap-3 pt-3">
      <Button type="button" onClick={onClose}>Close</Button>
      <span className="text-sm text-white/80">{peer.member.name}</span>
    </div>
  </div>
}
