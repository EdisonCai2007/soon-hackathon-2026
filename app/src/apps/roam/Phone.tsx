import { useEffect, useRef, useState } from 'react'
import { Loading } from '@/components/Loading'
import { cn } from '@/lib/utils'
import { arSupported, startAr, type ArSession } from './ar-session'
import { inviteLink } from './invite'
import { useLiveRoom } from './live-room'
import type { Pose } from './messages'
import { anchorAt, toScanPose } from './placement'
import { Pill } from './Pill'
import { pill } from './pill-look'
import { parseScene, type Scene } from './scene'
import { card, Centered, Halftone, Screen, title } from './Screen'

// The taped spot is the room's first filmed camera: it is on the route the scan looks best along.
const SPOT = 0

type Step = 'checking' | 'unsupported' | 'ready' | 'live'

// A phone-width column, the phone being where these screens are read.
const COLUMN = 'max-w-md text-[17px]'

const ADVICE = 'This phone’s browser can’t follow you through the room. Android Chrome can; on an iPhone, join as a guest instead.'

/** The phone in the real room: line up once on the taped spot, then walk and forget the screen. */
export function Phone({ app, roomId }: { app: string; roomId: string }) {
  const [step, setStep] = useState<Step>('checking')
  const [scene, setScene] = useState<Scene | null>(null)
  const [lost, setLost] = useState(false)
  const session = useRef<ArSession | null>(null)
  const room = useLiveRoom(app, roomId, 'Camera', 'camera')
  const { tell } = room

  useEffect(() => {
    void arSupported().then((yes) => setStep(yes ? 'ready' : 'unsupported'))
    void fetch(`/apps/${app}/scene.json`).then((response) => response.json()).then((data: unknown) => setScene(parseScene(data))).catch(() => setScene(null))
    return () => session.current?.stop()
  }, [app])

  // The spot is read once, here, so every pose after it is placed against the same one.
  async function lineUp(here: Scene) {
    const anchor = anchorAt(here, SPOT)
    const onPose = (pose: Pose) => {
      setLost(false)
      tell(toScanPose(pose, anchor, here))
    }
    try {
      session.current = await startAr({ onPose, onLost: () => setLost(true), onEnd: () => setStep('ready') })
      setStep('live')
    } catch { setStep('unsupported') }
  }

  if (step === 'checking' || !scene) {
    return <Screen className="grid place-items-center p-6">
      <Loading label="Looking at what this phone can do…" className="contents">
        <Halftone />
        <p className={cn(card, 'relative text-2xl font-bold')}>Looking at what this phone can do…</p>
      </Loading>
    </Screen>
  }
  if (step === 'unsupported') {
    return <Centered className={COLUMN}>
      <h1 className={title}>Be the camera</h1>
      <p>{ADVICE}</p>
      <a className={cn(pill('loud'), 'inline-flex items-center no-underline')} href={inviteLink(location.origin, app, roomId)}>Join as a guest</a>
    </Centered>
  }
  return <Centered className={COLUMN}>
      <h1 className={title}>Be the camera</h1>
      {step === 'ready'
        ? <>
          <p>Stand on the marked spot, facing the arrow, and hold the phone up.</p>
          <Pill type="button" look="loud" onClick={() => void lineUp(scene)}>I’m here</Pill>
        </>
        : <>
          <p role="status">You’re live. Walk the room normally — people watching see you where you are.</p>
          {lost && <p className="rounded-3xl border-2 border-roam-red px-4 py-3 font-semibold">Hold still for a moment: the phone has lost track of the room.</p>}
          <Pill type="button" onClick={() => { session.current?.stop(); setStep('ready') }}>Stop</Pill>
        </>}
      {room.failure && <p className="rounded-full border-2 border-roam-peri px-3.5 py-1 text-sm font-medium">{room.failure}</p>}
  </Centered>
}
