import { useCallback, useReducer, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react'
import { Loading } from '@/components/Loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useCasts, useTechniqueSounds, type Casting } from './casting'
import type { Pose as Stance } from './messages'
import type { Peer } from './presence'
import { RoomViewer } from './RoomViewer'
import type { Pose, Scene, View } from './scene'
import { useRoomAr, type RoomAr } from './use-room-ar'
import { initialViewer, viewerReducer, type ViewerEvent, type ViewerState } from './viewer-state'
import { Watch } from './Watch'

const VIEWS: [View, string][] = [['room', 'Room view'], ['overview', 'Overview'], ['top', 'Top view']]
const NO_WEBGL = 'This browser can’t show 3D. Open the page in a recent Chrome, Edge, Firefox or Safari.'

/** What a live room adds to the scan: the people in it, their voices, and where this person stands. */
export type Live = {
  peers: readonly Peer[]
  audio: AudioContext | null
  soundBlocked: boolean
  unlock: () => void
  tell: (stance: Stance) => void
  people: ReactNode
  notice?: ReactNode
  /** Hand reading for this page: off until the person asks for it. */
  casting: Casting
}

const CANNOT_READ = 'This browser can’t read your hands.'

function Hands({ casting }: { casting: Casting }) {
  const reading = casting.step === 'on' || casting.step === 'starting'
  return <>
    {casting.step === 'on' && <Badge>hands on</Badge>}
    {casting.step === 'starting' && <Badge variant="outline">reading your hands…</Badge>}
    {casting.step === 'cannot' && <Badge variant="outline">{CANNOT_READ}</Badge>}
    {casting.seen && <Badge variant="outline">{`seeing: ${casting.seen}`}</Badge>}
    <Button type="button" variant="outline" onClick={casting.turn}>{reading ? 'Hands off' : 'Hands on'}</Button>
  </>
}

const loadingLabel = (progress: number | null) =>
  progress === null ? 'Loading the room…' : `Loading the room… ${Math.round(progress * 100)}%`

function Stopped({ state, retry }: { state: Extract<ViewerState, { status: 'error' | 'no-webgl' }>; retry: () => void }) {
  return <Card className="grid justify-items-start gap-4 p-6">
    {state.status === 'error'
      ? <><p>{state.message} Check your connection, then try again.</p><Button type="button" onClick={retry}>Try again</Button></>
      : <p>{NO_WEBGL}</p>}
  </Card>
}

const fill = (box: HTMLElement | null) => {
  if (document.fullscreenElement) void document.exitFullscreen?.()
  else void box?.requestFullscreen?.().catch(() => {})
}

type Ready = Extract<ViewerState, { status: 'ready' }> | null
type Act = (event: ViewerEvent) => void

/** Walking the scan with your own feet, where the phone can follow them. It takes where the view already
 *  stands as its starting point, so it waits for the viewer to say where that is. */
function Walk({ walk, stance }: { walk: RoomAr; stance: Stance | null }) {
  if (!walk.offered || walk.walking || !stance) return null
  return <Button type="button" variant="outline" onClick={() => walk.start(stance)}>Walk it</Button>
}

function Bar({ ready, live, act, box, walk, stance }:
{ ready: Ready; live?: Live; act: Act; box: HTMLElement | null; walk: RoomAr; stance: Stance | null }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">
    <h1>ROAM</h1>
    {ready && <Badge variant="secondary">{ready.scene.views} video views · {ready.scene.splats.toLocaleString('en-US')} splats</Badge>}
    {live?.soundBlocked && <Badge variant="outline">sound off</Badge>}
    {live && <Hands casting={live.casting} />}
    <Walk walk={walk} stance={stance} />
    <div className="ml-auto flex flex-wrap gap-2">
      {VIEWS.map(([view, label]) => (
        <Button key={label} type="button" variant="outline" disabled={!ready} onClick={() => act({ type: 'go', view })}>{label}</Button>
      ))}
      <Button type="button" variant="ghost" onClick={() => fill(box)}>Full screen</Button>
    </div>
  </div>
}

function Cameras({ ready, act }: { ready: Ready; act: Act }) {
  return <div className="mb-3 flex flex-wrap items-center gap-3">
    <Label htmlFor="roam-camera">Camera</Label>
    <NativeSelect id="roam-camera" disabled={!ready} value={ready?.camera ?? ''} onChange={(event) => act({ type: 'go', view: Number(event.target.value) })}>
      {ready?.scene.cameras.map((camera, index) => <NativeSelectOption key={camera.name} value={index}>{camera.name}</NativeSelectOption>)}
    </NativeSelect>
    <p className="text-sm text-muted-foreground">Click the scene, then W/A/S/D to move · Q/E down and up · drag to look · Shift to go faster</p>
  </div>
}

type ViewProps = {
  app: string
  live?: Live
  scene: Scene | null
  pose: Pose | null
  act: Act
  onPick: NonNullable<ComponentProps<typeof RoomViewer>['onPick']>
  stance: Stance | null
  onStance: (stance: Stance) => void
  onWhere: (pose: Pose) => void
}

/** The scan itself, with the techniques running over it and where this person's own view stands. */
function View({ app, live, scene, pose, act, onPick, stance, onStance, onWhere }: ViewProps) {
  const casts = useCasts(live?.peers, live?.casting.mine, stance)
  useTechniqueSounds(live?.audio, casts, scene, stance)
  return <RoomViewer sceneUrl={`/apps/${app}/scene.json`} splatUrl={`/apps/${app}/room.spz`} pose={pose} onEvent={act}
    peers={live?.peers} audio={live?.audio} casts={casts} onPick={onPick} onStance={onStance}
    onWhere={onWhere} />
}

/** While the walk runs, the session owns the screen, so these are the page's only visible controls. */
function Walking({ walk, overlay }: { walk: RoomAr; overlay: RefObject<HTMLDivElement | null> }) {
  // The element stays in the page whether or not a session is running, so React keeps owning it.
  return <div ref={overlay} className={walk.walking ? 'fixed inset-x-0 bottom-0 z-30 grid gap-3 bg-black/70 p-4' : 'hidden'}>
    {walk.walking && <>
      <p role="status" className="text-white">You’re in the home. Turn your body to look, and walk.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={walk.carryOn}>Carry on from here</Button>
        <Button type="button" variant="outline" onClick={walk.stop}>Stop</Button>
      </div>
    </>}
  </div>
}

// Rounding -0.0001 must read 0.000, not -0.000.
const fixed = (value: number, places: number) => (Object.is(Math.round(value * 10 ** places), -0) ? 0 : value).toFixed(places)

/** Where the camera is and faces, in the scan's own coordinates: one line to paste into a chat. */
function whereText({ position, target }: Pose): string {
  const facing = target.map((value, axis) => value - position[axis])
  return `x ${fixed(position[0], 3)} y ${fixed(position[1], 3)} z ${fixed(position[2], 3)} facing ${facing.map((value) => fixed(value, 2)).join(' ')}`
}

function Where({ where }: { where: Pose | null }) {
  // Copied until the person moves: the line then reads somewhere else.
  const [copied, setCopied] = useState<string | null>(null)
  const line = useRef<HTMLElement>(null)
  if (!where) return null
  const text = whereText(where)
  // Some embedded browsers refuse the clipboard API; selecting the line and copying it the old way still works there.
  const byHand = () => {
    const range = document.createRange()
    range.selectNodeContents(line.current!)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(range)
    setCopied(document.execCommand('copy') ? text : null)
  }
  const copy = () => void (navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('no clipboard'))).then(() => setCopied(text), byHand)
  return <div className="mb-3 flex flex-wrap items-center gap-3">
    <span className="text-sm text-muted-foreground">You are at</span>
    <code ref={line} className="select-all text-sm tabular-nums" aria-label="Camera position">{text}</code>
    <Button type="button" variant="outline" size="sm" onClick={copy}>{copied === text ? 'Copied' : 'Copy'}</Button>
  </div>
}

/** The scanned room in the page: walked alone, or shared with whoever a live room holds. */
export function Scan({ app, live, before }: { app: string; live?: Live; before?: ReactNode }) {
  const [state, dispatch] = useReducer(viewerReducer, initialViewer)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [watching, setWatching] = useState<{ id: string; saved: Pose } | null>(null)
  const [stance, setStance] = useState<Stance | null>(null)
  const [where, setWhere] = useState<Pose | null>(null)
  const ready = state.status === 'ready' ? state : null
  const watched = live?.peers.find((peer) => peer.member.id === watching?.id) ?? null
  const scene = ready?.scene ?? null
  const overlay = useRef<HTMLDivElement>(null)
  const tell = live?.tell
  const walk = useRoomAr(`/apps/${app}/room.spz`, scene, {
    onStance: tell,
    onLeft: useCallback((pose: Pose) => dispatch({ type: 'look', pose }), []),
    overlay,
  })

  return (
    <div onPointerDown={live?.unlock}>
      <Bar ready={ready} live={live} act={dispatch} box={box} walk={walk} stance={stance} />
      {before}
      {walk.trouble && <p role="alert" className="mb-3 text-sm text-muted-foreground">{walk.trouble}</p>}
      <Cameras ready={ready} act={dispatch} />
      <Where where={ready && where} />
      {state.status === 'error' || state.status === 'no-webgl'
        ? <Stopped state={state} retry={() => dispatch({ type: 'retry' })} />
        : <div ref={setBox} className="relative h-[70vh] min-h-80 overflow-hidden rounded-xl border bg-[#10151c]">
          <View app={app} live={live} scene={scene} pose={ready?.pose ?? null} act={dispatch} stance={stance}
            onStance={(here) => { setStance(here); tell?.(here) }} onWhere={setWhere}
            onPick={(id, saved) => { if (live) setWatching({ id, saved }) }} />
          {state.status === 'loading' && <div className="absolute inset-0">
            <Loading label={loadingLabel(state.progress)} className="h-full"><Skeleton className="h-full rounded-none" /></Loading>
          </div>}
          {watched && watching && <Watch peer={watched} onClose={() => {
            dispatch({ type: 'look', pose: watching.saved })
            setWatching(null)
          }} />}
        </div>}
      {live && <div className="mt-4">{live.people}</div>}
      <Walking walk={walk} overlay={overlay} />
    </div>
  )
}
