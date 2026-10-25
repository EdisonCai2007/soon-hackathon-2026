// Walking the scan with your own body, from a room joined anywhere. The session and the drawing are owned here
// so the screen holds buttons and nothing else: openspec roam-ar-view, "The guest's walk".
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { arSupported, startAr, type ArSession } from './ar-session'
import { makeArView, type ArView } from './ar-view'
import type { Pose as Stance } from './messages'
import { floorHeight, fromOrigin, toScanPose, type Anchor } from './placement'
import { dueToSend } from './pose-feed'
import { poseFacing, type Pose, type Scene } from './scene'

const TROUBLE: Record<string, string> = {
  rate: 'This phone couldn’t draw the home while you walked, so you’re back in the room view.',
  lost: 'The 3D view stopped, so you’re back in the room view.',
  refused: 'This phone wouldn’t start the walk, so you’re back in the room view.',
}

export type RoomAr = {
  /** Whether this browser can tell where the phone is at all. An iPhone cannot, and is offered nothing. */
  offered: boolean
  walking: boolean
  /** Why the walk ended, where it ended badly. */
  trouble: string | null
  /** Starts the walk from where the view already stands. */
  start: (from: Stance) => void
  /** Keeps the place reached and makes where the phone now stands the new starting point. */
  carryOn: () => void
  stop: () => void
}

type Walk = { view: ArView; session: ArSession | null }

export type RoomArHooks = {
  /** Told where the walker is, ten times a second, as the room expects. */
  onStance?: (stance: Stance) => void
  /** Given the view to come back to when the walk ends, so the page carries on from where they got to. */
  onLeft?: (pose: Pose) => void
  /** The page's own controls, which the session draws over its camera view: without one there are no buttons. */
  overlay?: RefObject<HTMLElement | null>
}

export function useRoomAr(splatUrl: string, scene: Scene | null, { onStance, onLeft, overlay }: RoomArHooks = {}): RoomAr {
  const [offered, setOffered] = useState(false)
  const [walking, setWalking] = useState(false)
  const [trouble, setTrouble] = useState<string | null>(null)
  const walk = useRef<Walk | null>(null)
  const anchor = useRef<Anchor | null>(null)
  // Where the phone was when it was last anchored, and where it is now: carrying on moves the first to the second.
  const origin = useRef<Stance | null>(null)
  const raw = useRef<Stance | null>(null)
  const here = useRef<Stance | null>(null)
  const told = useRef<number | null>(null)
  const latest = useRef({ onStance, onLeft })
  useEffect(() => { latest.current = { onStance, onLeft } })

  const end = useCallback((why: string | null) => {
    const going = walk.current
    walk.current = null
    going?.view.dispose()
    going?.session?.stop()
    setWalking(false)
    setTrouble(why === null ? null : TROUBLE[why])
    if (here.current) latest.current.onLeft?.(poseFacing(here.current))
  }, [])

  useEffect(() => {
    void arSupported().then(setOffered)
    return () => end(null)
  }, [end])

  const start = useCallback((from: Stance) => {
    if (!scene || walk.current) return
    setTrouble(null)
    anchor.current = { x: from.x, z: from.z, yaw: from.yaw, floor: floorHeight(scene, from.y) }
    origin.current = null
    here.current = from
    const view = makeArView(splatUrl, {
      onPose: (pose) => {
        raw.current = pose
        origin.current ??= pose
        const walked = toScanPose(fromOrigin(pose, origin.current), anchor.current!, scene)
        here.current = walked
        const now = performance.now()
        if (!dueToSend(told.current, now)) return
        told.current = now
        latest.current.onStance?.(walked)
      },
      onGaveUp: (why) => end(why),
    })
    walk.current = { view, session: null }
    setWalking(true)
    void (async () => {
      try {
        const session = await startAr({ onPose: () => {}, onLost: () => {}, onEnd: () => end(null) },
          overlay?.current, view)
        if (!walk.current) return session.stop()
        walk.current.session = session
        view.lineUp(anchor.current!, scene)
      } catch { end('refused') }
    })()
  }, [end, overlay, scene, splatUrl])

  const carryOn = useCallback(() => {
    const going = walk.current
    if (!going || !scene || !here.current) return
    anchor.current = { x: here.current.x, z: here.current.z, yaw: here.current.yaw, floor: floorHeight(scene, here.current.y) }
    origin.current = raw.current
    going.view.lineUp(anchor.current, scene)
  }, [scene])

  return { offered, walking, trouble, start, carryOn, stop: () => end(null) }
}
