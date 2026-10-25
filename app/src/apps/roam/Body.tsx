import { Hand } from 'lucide-react'
import type { RefObject } from 'react'
import type { Casting } from './casting'
import type { Pose as Stance } from './messages'
import { Chip, Pill } from './Pill'
import type { RoomAr } from './use-room-ar'

const CANNOT_READ = 'This browser can’t read your hands.'

/** Hand reading for this page: its state, what it sees, and the switch. */
export function Hands({ casting }: { casting: Casting }) {
  const reading = casting.step === 'on' || casting.step === 'starting'
  return <>
    {casting.step === 'on' && <Chip icon={<Hand className="size-4" />}>hands on</Chip>}
    {casting.step === 'starting' && <Chip icon={<Hand className="size-4" />}>reading your hands…</Chip>}
    {casting.step === 'cannot' && <Chip icon={<Hand className="size-4" />}>{CANNOT_READ}</Chip>}
    {casting.seen && <Chip icon={<Hand className="size-4" />}>{`seeing: ${casting.seen}`}</Chip>}
    <Pill type="button" size="small" onClick={casting.turn}>{reading ? 'Hands off' : 'Hands on'}</Pill>
  </>
}

/** Walking the scan with your own feet, where the phone can follow them. It takes where the view already
 *  stands as its starting point, so it waits for the viewer to say where that is. */
export function WalkIt({ walk, stance }: { walk: RoomAr; stance: Stance | null }) {
  if (!walk.offered || walk.walking || !stance) return null
  return <Pill type="button" size="small" onClick={() => walk.start(stance)}>Walk it</Pill>
}

/** While the walk runs, the session owns the screen, so these are the page's only visible controls. */
export function Walking({ walk, overlay }: { walk: RoomAr; overlay: RefObject<HTMLDivElement | null> }) {
  // The element stays in the page whether or not a session is running, so React keeps owning it.
  return <div ref={overlay} className={walk.walking ? 'fixed inset-x-0 bottom-0 z-30 grid gap-3 bg-roam-ink/70 p-4' : 'hidden'}>
    {walk.walking && <>
      <p role="status" className="text-white">{walk.phase === 'starting'
        ? 'Waiting for the phone to find its position…'
        : walk.phase === 'lost' ? 'Tracking paused. Hold still while the phone finds its position.'
          : 'You’re in the home. Turn your body to look, and walk.'}
        {walk.progress !== 1 && ` Loading the room…${walk.progress === null ? '' : ` ${Math.round(walk.progress * 100)}%`}`}</p>
      <div className="flex flex-wrap gap-2">
        <Pill type="button" look="loud" disabled={walk.phase !== 'walking'} onClick={walk.carryOn}>Carry on from here</Pill>
        <Pill type="button" onClick={walk.stop}>Stop</Pill>
      </div>
    </>}
  </div>
}
