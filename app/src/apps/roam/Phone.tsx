import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loading } from '@/components/Loading'
import { Skeleton } from '@/components/ui/skeleton'
import { arSupported, startAr, type ArSession } from './ar-session'
import { inviteLink } from './invite'
import { useLiveRoom } from './live-room'
import type { Pose } from './messages'
import { anchorAt, toScanPose } from './placement'
import { parseScene, type Scene } from './scene'

// The taped spot is the room's first filmed camera: it is on the route the scan looks best along.
const SPOT = 0

type Step = 'checking' | 'unsupported' | 'ready' | 'live'

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
    return <Loading label="Looking at what this phone can do…" className="grid gap-4"><Skeleton className="h-40 rounded-xl" /></Loading>
  }
  if (step === 'unsupported') {
    return <Card className="grid justify-items-start gap-4 p-6">
      <h1>Be the camera</h1>
      <p>{ADVICE}</p>
      <a className="underline" href={inviteLink(location.origin, app, roomId)}>Join as a guest</a>
    </Card>
  }
  return <Card className="grid justify-items-start gap-4 p-6">
    <h1>Be the camera</h1>
    {step === 'ready'
      ? <>
        <p className="text-muted-foreground">Stand on the marked spot, facing the arrow, and hold the phone up.</p>
        <Button type="button" onClick={() => void lineUp(scene)}>I’m here</Button>
      </>
      : <>
        <p role="status">You’re live. Walk the room normally — people watching see you where you are.</p>
        {lost && <p className="text-sm text-muted-foreground">Hold still for a moment: the phone has lost track of the room.</p>}
        <Button type="button" variant="outline" onClick={() => { session.current?.stop(); setStep('ready') }}>Stop</Button>
      </>}
    {room.failure && <p className="text-sm text-muted-foreground">{room.failure}</p>}
  </Card>
}
