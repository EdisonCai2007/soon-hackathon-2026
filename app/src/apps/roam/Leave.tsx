import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { arSupported, startAr, type ArSession } from './ar-session'
import { CannotFollow, Checking } from './PhoneStart'
import { CLIP_MS, recordVoice, shrinkPhoto, type Recording } from './capture'
import type { Pose } from './messages'
import { leaveNote, type NoteKind } from './notes'
import { toScanPose } from './placement'
import { loadScene, type Scene } from './scene'
import { floorOf, markedSpots, type MarkedSpot } from './spots'

type Step = 'checking' | 'unsupported' | 'spots' | 'walking' | 'composing'

const ADVICE = 'This phone’s browser can’t follow you through the room, so it can’t leave a note where you stand. ' +
  'Android Chrome can; on an iPhone, walk the home instead and read what others left.'
const REFUSED: Record<string, string> = {
  bad_words: 'That note is too long. Shorten it and try again.',
  too_large: 'That recording or photo is too big to leave here.',
  full: 'This home holds as many notes as it can. Take one back first.',
  offline: 'That didn’t reach the home. Try again in a moment.',
}
const NAME = 'roam-author'

const kept = (key: string) => {
  try { return localStorage.getItem(key) }
  catch { return null }
}
const keep = (key: string, value: string) => {
  try { localStorage.setItem(key, value) }
  catch { /* a browser with no storage asks for the name again next time */ }
}

/** The taped spots to pick from, and the name that goes on whatever is left here. */
function Spots({ scene, author, onAuthor, onPick }:
{ scene: Scene; author: string; onAuthor: (name: string) => void; onPick: (spot: MarkedSpot) => void }) {
  return <div className="grid w-full justify-items-start gap-4">
    <div className="grid w-full gap-2">
      <Label htmlFor="roam-author">Your name</Label>
      <Input id="roam-author" value={author} onChange={(event) => onAuthor(event.target.value)} placeholder="Dana" />
    </div>
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

type Composing = {
  kind: NoteKind; words: string; media: Blob | null; recording: boolean; busy: boolean; ready: boolean
  onWrite: () => void; onWords: (words: string) => void; onRecord: () => void; onStopRecording: () => void
  onPhoto: (file: File) => void; onSave: () => void; onCancel: () => void
}

/** The note itself: written, spoken or photographed, then left where the phone stood. */
function Compose(one: Composing) {
  return <>
    <div className="flex w-full flex-wrap gap-2">
      <Button type="button" variant={one.kind === 'text' ? 'default' : 'ghost'} onClick={one.onWrite}>Write</Button>
      <Button type="button" variant={one.kind === 'voice' ? 'default' : 'ghost'} disabled={one.recording}
        onClick={one.onRecord}>{one.media && one.kind === 'voice' ? 'Record again' : 'Record'}</Button>
      <Button type="button" variant={one.kind === 'photo' ? 'default' : 'ghost'} asChild>
        <label>
          Photo
          <input className="hidden" type="file" accept="image/*" capture="environment"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) one.onPhoto(file) }} />
        </label>
      </Button>
    </div>

    {one.kind === 'text' && <Input aria-label="The note" value={one.words} onChange={(event) => one.onWords(event.target.value)}
      placeholder="The boiler resets behind this panel" />}
    {one.kind === 'voice' && (one.recording
      ? <Button type="button" variant="outline" onClick={one.onStopRecording}>Stop recording</Button>
      : <p className="text-sm text-muted-foreground" role="status">
        {one.media ? 'Recorded. Leave it here, or record again.' : 'Press Record and say it out loud.'}</p>)}
    {one.kind === 'photo' && <p className="text-sm text-muted-foreground" role="status">
      {one.media ? 'Photo ready. Leave it here.' : 'Press Photo and take one.'}</p>}

    <div className="flex w-full flex-wrap items-center gap-2">
      <Button type="button" disabled={!one.ready || one.busy} onClick={one.onSave}>{one.busy ? 'Leaving…' : 'Leave it'}</Button>
      <Button type="button" variant="ghost" onClick={one.onCancel}>Cancel</Button>
    </div>
  </>
}

/** The phone in the real home: pick the spot you are standing on, walk to the thing, and leave a note there. */
export function Leave({ app }: { app: string }) {
  const [step, setStep] = useState<Step>('checking')
  const [scene, setScene] = useState<Scene | null>(null)
  const [author, setAuthor] = useState(() => kept(NAME) ?? '')
  const [lined, setLined] = useState('')
  const [lost, setLost] = useState(false)
  const [left, setLeft] = useState(0)
  const [kind, setKind] = useState<NoteKind>('text')
  const [words, setWords] = useState('')
  const [media, setMedia] = useState<Blob | null>(null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fault, setFault] = useState<string | null>(null)
  const session = useRef<ArSession | null>(null)
  const clip = useRef<Recording | null>(null)
  const here = useRef<Pose | null>(null)
  const at = useRef<Pose | null>(null)
  // The AR session takes over the screen, so everything below goes to the browser as an overlay over the camera.
  const overlay = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void arSupported().then((yes) => setStep(yes ? 'spots' : 'unsupported'))
    void loadScene(`/apps/${app}/scene.json`).then(setScene).catch(() => setScene(null))
    return () => session.current?.stop()
  }, [app])

  async function lineUp(picked: MarkedSpot, where: Scene) {
    setLined(`Lined up at ${picked.name}.`)
    const onPose = (pose: Pose) => {
      setLost(false)
      here.current = toScanPose(pose, picked.anchor, where)
    }
    if (session.current) return setStep('walking')
    try {
      session.current = await startAr({ onPose, onLost: () => setLost(true), onEnd: () => { session.current = null; setStep('spots') } },
        overlay.current)
      setStep('walking')
    } catch { setStep('unsupported') }
  }

  function compose() {
    at.current = here.current
    setKind('text')
    setWords('')
    setMedia(null)
    setFault(null)
    setStep('composing')
  }

  async function record() {
    setKind('voice')
    setMedia(null)
    const started = await recordVoice()
    if (!started) return setFault('This phone wouldn’t let the page listen. Allow the microphone and try again.')
    clip.current = started
    setRecording(true)
    setTimeout(() => { if (clip.current === started) void finishRecording(started) }, CLIP_MS)
  }

  async function finishRecording(started: Recording) {
    clip.current = null
    setRecording(false)
    setMedia(await started.stop())
  }

  async function photograph(file: File) {
    setKind('photo')
    const shrunk = await shrinkPhoto(file)
    if (!shrunk) return setFault('That photo couldn’t be read. Try taking it again.')
    setMedia(shrunk)
  }

  async function save() {
    const spotted = at.current
    if (!spotted) return setFault('The phone doesn’t know where you are yet. Hold still for a moment.')
    setBusy(true)
    keep(NAME, author)
    const answer = await leaveNote(app, { kind, spot: spotted, author, words, media })
    setBusy(false)
    if (!answer.ok) return setFault(REFUSED[answer.fault] ?? 'That note wasn’t taken. Try again.')
    setLeft((count) => count + 1)
    setStep('walking')
  }

  if (step === 'checking' || !scene) return <Checking />
  if (step === 'unsupported') {
    return <CannotFollow title="Leave a note">
      <p>{ADVICE}</p>
      <a className="underline" href={`/apps/${app}/`}>Walk the home instead</a>
    </CannotFollow>
  }

  const ready = media !== null || (kind === 'text' && words.trim() !== '')

  return <Card className="grid justify-items-start gap-4 p-6">
    <div className="flex w-full flex-wrap items-center gap-3">
      <h1>Leave a note</h1>
      {left > 0 && <Badge variant="secondary">{left} left</Badge>}
      {lost && <Badge variant="outline">no tracking</Badge>}
    </div>

    {step === 'spots' && <Spots scene={scene} author={author} onAuthor={setAuthor} onPick={(one) => void lineUp(one, scene)} />}

    <div ref={overlay} className={step === 'spots' ? 'hidden' : 'grid w-full justify-items-start gap-4'}>
      {step === 'walking' && <>
        <p role="status">{lined} Walk to the thing you want to talk about.</p>
        <Button type="button" onClick={compose}>Leave a note here</Button>
        <Button type="button" variant="ghost" onClick={() => setStep('spots')}>Line up again</Button>
        <Button type="button" variant="ghost" onClick={() => { session.current?.stop(); session.current = null; setStep('spots') }}>Stop</Button>
      </>}

      {step === 'composing' && <Compose kind={kind} words={words} media={media} recording={recording} busy={busy} ready={ready}
        onWrite={() => { setKind('text'); setMedia(null) }} onWords={setWords} onRecord={() => void record()}
        onStopRecording={() => void finishRecording(clip.current!)} onPhoto={(file) => void photograph(file)}
        onSave={() => void save()} onCancel={() => setStep('walking')} />}

      {fault && <p className="text-sm text-muted-foreground" role="alert">{fault}</p>}
    </div>
  </Card>
}
