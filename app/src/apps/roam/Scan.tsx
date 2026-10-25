import { Expand, MapPin, Video, VolumeX } from 'lucide-react'
import { useReducer, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import type { Pose as Stance } from './messages'
import { Chip, Joined, Pill } from './Pill'
import { bubble, pill } from './pill-look'
import type { Peer } from './presence'
import { RoomViewer } from './RoomViewer'
import type { Pose, View } from './scene'
import { card, Halftone, Screen, title } from './Screen'
import { initialViewer, viewerReducer, type ViewerEvent, type ViewerState } from './viewer-state'
import { Watch } from './Watch'
import { Wordmark } from './Wordmark'

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
}

const loadingLabel = (progress: number | null) =>
  progress === null ? 'Loading the room…' : `Loading the room… ${Math.round(progress * 100)}%`

function Stopped({ state, retry }: { state: Extract<ViewerState, { status: 'error' | 'no-webgl' }>; retry: () => void }) {
  return <div className={cn(card, 'max-w-xl text-[17px]')}>
    {state.status === 'error'
      ? <><p>{state.message} Check your connection, then try again.</p><Pill look="loud" onClick={retry}>Try again</Pill></>
      : <p>{NO_WEBGL}</p>}
  </div>
}

/** The cover's yellow dots and a count, over the room while it loads. */
function Gathering({ progress }: { progress: number | null }) {
  return <div className="absolute inset-0 z-10 grid place-items-center bg-roam-cream p-6">
    <Halftone />
    <div className={cn(card, 'relative w-full max-w-md justify-items-stretch')}>
      <p role="status" className={cn(title, 'text-center')}>{loadingLabel(progress)}</p>
      <div aria-hidden="true" className="h-4 overflow-hidden rounded-full border-2 border-roam-peri">
        <div className="h-full bg-roam-peri" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
      </div>
    </div>
  </div>
}

const fill = (box: HTMLElement | null) => {
  if (document.fullscreenElement) void document.exitFullscreen?.()
  else void box?.requestFullscreen?.().catch(() => {})
}

type Ready = Extract<ViewerState, { status: 'ready' }> | null
type Act = (event: ViewerEvent) => void

/** The top of the room: the name and counts at the left, the views in the middle, full screen at the right. */
function Bar({ ready, live, act, box }: { ready: Ready; live?: Live; act: Act; box: HTMLElement | null }) {
  return <>
    <div className="absolute top-6 left-6 z-20 grid justify-items-start gap-3">
      <h1 className={cn(pill(), 'inline-flex h-12 items-center px-5')}><Wordmark className="h-[26px]" /><span className="sr-only">ROAM</span></h1>
      <div className="flex flex-wrap gap-2">
        {ready && <Chip icon={<Video className="size-4" />}>{ready.scene.views} video views · {ready.scene.splats.toLocaleString('en-US')} splats</Chip>}
        {live?.soundBlocked && <Chip icon={<VolumeX className="size-4" />}>sound off</Chip>}
      </div>
    </div>
    <div className="absolute top-6 left-1/2 z-20 -translate-x-1/2 max-md:top-24">
      <Joined className={ready ? undefined : 'opacity-40'}>
        {VIEWS.map(([view, label]) => (
          <Pill key={label} type="button" className="disabled:opacity-100" disabled={!ready} onClick={() => act({ type: 'go', view })}>{label}</Pill>
        ))}
      </Joined>
    </div>
    <Button type="button" variant="ghost" aria-label="Full screen" className={cn(bubble(), 'absolute top-6 right-6 z-20')} onClick={() => fill(box)}>
      <Expand className="size-5" aria-hidden="true" />
    </Button>
  </>
}

function Cameras({ ready, act }: { ready: Ready; act: Act }) {
  return <div className={cn(pill('quiet', 'small'), 'inline-flex items-center gap-1 pr-1 normal-case', !ready && 'opacity-40')}>
    <Label htmlFor="roam-camera" className="font-roam-label text-[15px] font-normal text-roam-peri lowercase">Camera</Label>
    <NativeSelect id="roam-camera" className="h-8 border-0 bg-transparent font-roam text-[15px] text-roam-ink shadow-none dark:bg-transparent" disabled={!ready}
      value={ready?.camera ?? ''} onChange={(event) => act({ type: 'go', view: Number(event.target.value) })}>
      {ready?.scene.cameras.map((camera, index) => <NativeSelectOption key={camera.name} value={index}>{camera.name}</NativeSelectOption>)}
    </NativeSelect>
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
  return <div className="flex flex-wrap items-center gap-1.5">
    <Chip icon={<MapPin className="size-4" />}>
      <span className="mr-1.5">You are at</span>
      <code ref={line} className="select-all font-roam tabular-nums" aria-label="Camera position">{text}</code>
    </Chip>
    <Pill type="button" size="small" onClick={copy}>{copied === text ? 'Copied' : 'Copy'}</Pill>
  </div>
}

/** The scanned room filling the screen: walked alone, or shared with whoever a live room holds. */
export function Scan({ app, live, before }: { app: string; live?: Live; before?: ReactNode }) {
  const [state, dispatch] = useReducer(viewerReducer, initialViewer)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [watching, setWatching] = useState<{ id: string; saved: Pose } | null>(null)
  const [where, setWhere] = useState<Pose | null>(null)
  const ready = state.status === 'ready' ? state : null
  const watched = live?.peers.find((peer) => peer.member.id === watching?.id) ?? null
  const stopped = state.status === 'error' || state.status === 'no-webgl'

  return <Screen>
    <div ref={setBox} onPointerDown={live?.unlock} className={cn('absolute inset-0 overflow-hidden', stopped ? 'grid place-items-center p-6' : 'bg-[#10151c]')}>
      {state.status === 'error' || state.status === 'no-webgl'
        ? <Stopped state={state} retry={() => dispatch({ type: 'retry' })} />
        : <RoomViewer sceneUrl={`/apps/${app}/scene.json`} splatUrl={`/apps/${app}/room.spz`} pose={ready?.pose ?? null} onEvent={dispatch}
          peers={live?.peers} audio={live?.audio} onStance={live?.tell} onWhere={setWhere}
          onPick={live && ((id, saved) => setWatching({ id, saved }))} />}
      {state.status === 'loading' && <Gathering progress={state.progress} />}
      <Bar ready={ready} live={live} act={dispatch} box={box} />
      <div className="absolute inset-x-6 bottom-6 z-20 flex flex-wrap items-end justify-between gap-3">
        <div className="grid justify-items-start gap-2.5">
          <Where where={ready && where} />
          <Cameras ready={ready} act={dispatch} />
        </div>
        <p className="rounded-full border-2 border-roam-peri bg-roam-cream px-3.5 py-1 text-sm font-medium text-roam-ink">
          Click the scene, then W/A/S/D to move · Q/E down and up · drag to look · Shift to go faster
        </p>
        {before}
      </div>
      {live && <div className="absolute top-24 right-6 z-20 w-[24rem] max-w-[calc(100%-3rem)]">{live.people}</div>}
      {watched && watching && <Watch peer={watched} onClose={() => {
        dispatch({ type: 'look', pose: watching.saved })
        setWatching(null)
      }} />}
    </div>
  </Screen>
}
