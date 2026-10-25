// Walking the scan with your own body, from a room joined anywhere. The session and the drawing are owned here
// so the screen holds buttons and nothing else: openspec roam-ar-view, "The guest's walk".
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { arSupported, startAr, type ArSession } from './ar-session'
import { makeArView, type ArView } from './ar-view'
import type { Pose as Stance } from './messages'
import { fromOrigin, toScanPose, type Anchor } from './placement'
import { dueToSend } from './pose-feed'
import { poseFacing, type Pose, type Scene } from './scene'

const TROUBLE: Record<string, string> = {
  rate: 'This phone couldn’t draw the home while you walked, so you’re back in the room view.',
  lost: 'The 3D view stopped, so you’re back in the room view.',
  refused: 'This phone wouldn’t start the walk, so you’re back in the room view.',
  tracking: 'The phone lost its position. You’re back at your last tracked place; try the walk again.',
  overlay: 'This browser couldn’t show the walking controls. Use touch controls or try again.',
}

type Phase = 'idle' | 'starting' | 'walking' | 'lost'
const TRACKING_WAIT_MS = 10_000

export type RoomAr = {
  /** Whether this browser can tell where the phone is at all. An iPhone cannot, and is offered nothing. */
  offered: boolean
  checking: boolean
  phase: Phase
  progress: number | null
  acceptsView: (stance: Stance) => boolean
  walking: boolean
  /** Why the walk ended, where it ended badly. */
  trouble: string | null
  /** Starts the walk from where the view already stands. */
  start: (from: Stance) => void
  /** Keeps the place reached and makes where the phone now stands the new starting point. */
  carryOn: () => void
  stop: () => void
}

type Walk = { view: ArView | null; session: ArSession | null }

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
  const [checking, setChecking] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<number | null>(null)
  const [trouble, setTrouble] = useState<string | null>(null)
  const walk = useRef<Walk | null>(null)
  const anchor = useRef<Anchor | null>(null)
  // Where the phone was when it was last anchored, and where it is now: carrying on moves the first to the second.
  const origin = useRef<Stance | null>(null)
  const raw = useRef<Stance | null>(null)
  const here = useRef<Stance | null>(null)
  const told = useRef<number | null>(null)
  const handoff = useRef<Stance | null>(null)
  const tracked = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ onStance, onLeft })
  useEffect(() => { latest.current = { onStance, onLeft } })

  const end = useCallback((why: string | null) => {
    const going = walk.current
    if (!going) return
    walk.current = null
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    going.view?.dispose()
    going.session?.stop()
    setPhase('idle')
    setTrouble(why === null ? null : TROUBLE[why])
    handoff.current = here.current
    if (here.current) latest.current.onLeft?.(poseFacing({ ...here.current, yaw: here.current.yaw + Math.PI }))
  }, [])

  useEffect(() => {
    let active = true
    void arSupported().then((supported) => {
      if (!active) return
      setOffered(supported)
      setChecking(false)
    })
    const hidden = () => { if (document.hidden) end('tracking') }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', hidden)
      end(null)
    }
  }, [end])

  const start = useCallback((from: Stance) => {
    if (!scene || !offered || walk.current) return
    setTrouble(null)
    setProgress(null)
    anchor.current = { x: from.x, z: from.z, yaw: from.yaw, floor: from.y }
    origin.current = null
    raw.current = null
    told.current = null
    tracked.current = false
    handoff.current = null
    here.current = from
    const going: Walk = { view: null, session: null }
    walk.current = going
    setPhase('starting')
    const waiting = () => {
      timer.current ??= setTimeout(() => end('tracking'), TRACKING_WAIT_MS)
    }
    try {
      const view = makeArView(splatUrl, {
        onProgress: (fraction) => { if (walk.current === going) setProgress(fraction) },
        onTracking: (valid) => {
          if (walk.current !== going) return
          tracked.current = valid
          if (valid) {
            if (timer.current !== null) clearTimeout(timer.current)
            timer.current = null
            setPhase('walking')
          } else {
            setPhase(origin.current ? 'lost' : 'starting')
            waiting()
          }
        },
        onPose: (pose) => {
          if (walk.current !== going) return
          tracked.current = true
          setPhase('walking')
          if (timer.current !== null) clearTimeout(timer.current)
          timer.current = null
          raw.current = pose
          if (!origin.current) {
            origin.current = pose
            view.lineUp(anchor.current!, scene, pose)
          }
          const walked = toScanPose(fromOrigin(pose, origin.current), anchor.current!, scene)
          here.current = walked
          const now = performance.now()
          if (!dueToSend(told.current, now)) return
          told.current = now
          latest.current.onStance?.(walked)
        },
        onGaveUp: (why) => { if (walk.current === going) end(why) },
      })
      going.view = view
      void (async () => {
        try {
          const session = await startAr({ onPose: () => {}, onLost: () => {}, onEnd: () => {
            if (walk.current === going) end(null)
          } }, overlay?.current, view)
          if (walk.current !== going) return session.stop()
          going.session = session
          if (!session.overlaid) return end('overlay')
          if (!tracked.current) waiting()
        } catch { if (walk.current === going) end('refused') }
      })()
    } catch { end('refused') }
  }, [end, offered, overlay, scene, splatUrl])

  const carryOn = useCallback(() => {
    const going = walk.current
    if (!going || !scene || !here.current || !raw.current || !tracked.current) return
    anchor.current = { x: here.current.x, z: here.current.z, yaw: here.current.yaw, floor: here.current.y }
    origin.current = raw.current
    going.view!.lineUp(anchor.current, scene, origin.current)
  }, [scene])

  const acceptsView = useCallback((stance: Stance) => {
    if (walk.current) return false
    const pending = handoff.current
    if (pending && (Math.hypot(stance.x - pending.x, stance.y - pending.y, stance.z - pending.z) > 1e-5 ||
      Math.abs(Math.sin((stance.yaw - pending.yaw) / 2)) > 1e-5)) return false
    handoff.current = null
    return true
  }, [])

  return { offered, checking, walking: phase !== 'idle', phase, progress, acceptsView, trouble, start, carryOn, stop: () => end(null) }
}
