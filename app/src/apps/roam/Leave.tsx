import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { arSupported, startAr, type ArSession } from './ar-session'
import { CannotFollow, Checking } from './PhoneStart'
import { loadScene, type Scene } from './scene'
import { floorOf, markedSpots, type MarkedSpot } from './spots'

type Step = 'checking' | 'unsupported' | 'spots' | 'walking'

const TITLE = 'Walk the home'
const ADVICE = 'This phone’s browser can’t follow you through the room. ' +
  'Android Chrome can; on an iPhone, walk the home on the screen instead.'

/** The taped spots to pick from: each one is where the phone lines up. */
function Spots({ scene, onPick }: { scene: Scene; onPick: (spot: MarkedSpot) => void }) {
  return <div className="grid w-full justify-items-start gap-4">
    <p className="text-muted-foreground">Stand on one of the taped spots, facing its arrow, and press it.</p>
    <div className="grid w-full gap-2">
      {markedSpots(scene).map((one) => (
        <Button key={one.name} type="button" variant="outline" className="justify-start" onClick={() => onPick(one)}>
          {one.name} <span className="ml-auto text-muted-foreground">floor {floorOf(scene, one)}</span>
        </Button>
      ))}
    </div>
  </div>
}

/** The phone in the real home: pick the spot you are standing on, line up, and walk. */
export function Walk({ app }: { app: string }) {
  const [step, setStep] = useState<Step>('checking')
  const [scene, setScene] = useState<Scene | null>(null)
  const [lined, setLined] = useState('')
  const [lost, setLost] = useState(false)
  const session = useRef<ArSession | null>(null)
  // The AR session takes over the screen, so everything below goes to the browser as an overlay over the camera.
  const overlay = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void arSupported().then((yes) => setStep(yes ? 'spots' : 'unsupported'))
    void loadScene(`/apps/${app}/scene.json`).then(setScene).catch(() => setScene(null))
    return () => session.current?.stop()
  }, [app])

  async function lineUp(picked: MarkedSpot) {
    setLined(`Lined up at ${picked.name}.`)
    if (session.current) return setStep('walking')
    try {
      session.current = await startAr({ onPose: () => setLost(false), onLost: () => setLost(true),
        onEnd: () => { session.current = null; setStep('spots') } }, overlay.current)
      setStep('walking')
    } catch { setStep('unsupported') }
  }

  if (step === 'checking' || !scene) return <Checking />
  if (step === 'unsupported') {
    return <CannotFollow title={TITLE}>
      <p>{ADVICE}</p>
      <a className="underline" href={`/apps/${app}/`}>Walk the home instead</a>
    </CannotFollow>
  }

  return <Card className="grid justify-items-start gap-4 p-6">
    <div className="flex w-full flex-wrap items-center gap-3">
      <h1>{TITLE}</h1>
      {lost && <Badge variant="outline">no tracking</Badge>}
    </div>

    {step === 'spots' && <Spots scene={scene} onPick={(one) => void lineUp(one)} />}

    <div ref={overlay} className={step === 'spots' ? 'hidden' : 'grid w-full justify-items-start gap-4'}>
      {step === 'walking' && <>
        <p role="status">{lined} Walk around.</p>
        <Button type="button" onClick={() => setStep('spots')}>Line up again</Button>
        <Button type="button" variant="ghost" onClick={() => { session.current?.stop(); session.current = null; setStep('spots') }}>Stop</Button>
      </>}
    </div>
  </Card>
}
