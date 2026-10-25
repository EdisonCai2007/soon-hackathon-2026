import { ChevronDown, Expand, VolumeX } from 'lucide-react'
import { useCallback, useReducer, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Hands, WalkIt, Walking } from './Body'
import { useCasts, useTechniqueSounds, type Casting } from './casting'
import type { Pose as Stance } from './messages'
import { Joined, Pill } from './Pill'
import { bubble } from './pill-look'
import type { Peer } from './presence'
import { RoomViewer } from './RoomViewer'
import type { Pose, Scene, View } from './scene'
import { card, Halftone, Screen, title } from './Screen'
import { toolsOn } from './invite'
import { Counts, Placing } from './Tools'
import { useRoomAr, type RoomAr } from './use-room-ar'
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
  /** Hand reading for this page: off until the person asks for it. */
  casting: Casting
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

// The middle of the bar fills red under the pointer, where the other pills fill blue.
const MAIN = 'hover:bg-roam-red hover:text-white'

/** Who is in the room, folded under one pill beside the views until it is opened. */
function WhosIn({ live, open, toggle }: { live: Live; open: boolean; toggle: () => void }) {
  return <Pill type="button" className={MAIN} aria-expanded={open} aria-controls="roam-whos-in" onClick={toggle}>
    who’s in · {live.peers.length + 1}
    <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
  </Pill>
}

type BarProps = { app: string; tools: boolean; ready: Ready; live?: Live; act: Act; box: HTMLElement | null; walk: RoomAr; stance: Stance | null }

/** The top of the room: the name at the left, the views and who's in mid, the body, sound and full screen right. */
function Bar({ app, tools, ready, live, act, box, walk, stance }: BarProps) {
  const [open, setOpen] = useState(false)
  return <>
    <div className="absolute top-6 left-6 z-20 grid justify-items-start gap-3">
      <h1><Wordmark className="h-8" /><span className="sr-only">ROAM</span></h1>
      {tools && ready && <Counts app={app} scene={ready.scene} />}
    </div>
    <div className="absolute top-6 left-1/2 z-20 flex -translate-x-1/2 items-start gap-3 max-md:top-24">
      <Joined className={ready ? undefined : 'opacity-40'}>
        {VIEWS.map(([view, label]) => (
          <Pill key={label} type="button" className={cn(MAIN, 'disabled:opacity-100')} disabled={!ready || walk.walking} onClick={() => act({ type: 'go', view })}>{label}</Pill>
        ))}
      </Joined>
      {live && <WhosIn live={live} open={open} toggle={() => setOpen(!open)} />}
    </div>
    {/* Measured against the room's own box, not the screen, so it keeps inside the frame on a phone. */}
    {live && open && <div id="roam-whos-in" className="absolute top-20 left-1/2 z-20 w-[24rem] max-w-[calc(100%-3rem)] -translate-x-1/2 max-md:top-36">
      {live.people}
    </div>}
    <div className="absolute top-6 right-6 z-20 flex max-w-[40%] flex-wrap items-center justify-end gap-2">
      {live && <Hands casting={live.casting} />}
      <WalkIt walk={walk} stance={stance} />
      {/* Only a status, so not pressable, but as big as the full screen button beside it. */}
      {live?.soundBlocked && <span role="img" aria-label="sound off" title="Sound off" className={cn(bubble('quiet', 'chip'), 'size-10')}>
        <VolumeX className="size-5" aria-hidden="true" />
      </span>}
      <Button type="button" variant="ghost" aria-label="Full screen" className={bubble()} onClick={() => fill(box)}>
        <Expand className="size-5" aria-hidden="true" />
      </Button>
    </div>
  </>
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
  onWhere?: (pose: Pose) => void
  paused: boolean
}

/** The scan itself, with the techniques running over it and where this person's own view stands. */
function View({ app, live, scene, pose, act, onPick, stance, onStance, onWhere, paused }: ViewProps) {
  const casts = useCasts(live?.peers, live?.casting.mine, stance)
  useTechniqueSounds(live?.audio, casts, scene, stance)
  return <RoomViewer sceneUrl={`/apps/${app}/scene.json`} splatUrl={`/apps/${app}/room.spz`} pose={pose} onEvent={act}
    peers={live?.peers} audio={live?.audio} casts={casts} onPick={onPick} onStance={onStance}
    onWhere={onWhere} paused={paused} />
}

/** The scanned room filling the screen: walked alone, or shared with whoever a live room holds. */
export function Scan({ app, live, before }: { app: string; live?: Live; before?: ReactNode }) {
  const [state, dispatch] = useReducer(viewerReducer, initialViewer)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [watching, setWatching] = useState<{ id: string; saved: Pose } | null>(null)
  const [stance, setStance] = useState<Stance | null>(null)
  const [where, setWhere] = useState<Pose | null>(null)
  const tools = toolsOn()
  const ready = state.status === 'ready' ? state : null
  const watched = live?.peers.find((peer) => peer.member.id === watching?.id) ?? null
  const stopped = state.status === 'error' || state.status === 'no-webgl'
  const overlay = useRef<HTMLDivElement>(null)
  const tell = live?.tell
  const walk = useRoomAr(`/apps/${app}/room.spz`, ready?.scene ?? null, {
    onStance: useCallback((here: Stance) => { setStance(here); tell?.(here) }, [tell]),
    onLeft: useCallback((pose: Pose) => dispatch({ type: 'look', pose }), []),
    overlay,
  })

  return <Screen>
    <div ref={setBox} onPointerDown={live?.unlock} className={cn('absolute inset-0 overflow-hidden', stopped ? 'grid place-items-center p-6' : 'bg-[#10151c]')}>
      {stopped
        ? <Stopped state={state} retry={() => dispatch({ type: 'retry' })} />
        : <View app={app} live={live} scene={ready?.scene ?? null} pose={ready?.pose ?? null} act={dispatch} stance={stance} paused={walk.walking}
          onStance={(here) => {
            if (!walk.acceptsView(here)) return
            setStance(here)
            tell?.(here)
          }} onWhere={tools ? setWhere : undefined}
          onPick={(id, saved) => { if (live) setWatching({ id, saved }) }} />}
      {state.status === 'loading' && <Gathering progress={state.progress} />}
      <Bar app={app} tools={tools} ready={ready} live={live} act={dispatch} box={box} walk={walk} stance={stance} />
      <div className="absolute inset-x-6 bottom-6 z-20 flex flex-wrap items-end justify-between gap-3">
        {tools && <Placing ready={ready} where={where} go={(view) => { if (!walk.walking) dispatch({ type: 'go', view }) }} />}
        <div className="grid gap-1 text-sm font-medium text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
          {walk.trouble && <p role="alert">{walk.trouble}</p>}
          <p>Click the scene, then W/A/S/D to move · Q/E down and up · drag to look · Shift to go faster</p>
        </div>
        {before}
      </div>
      {watched && watching && <Watch peer={watched} onClose={() => {
        dispatch({ type: 'look', pose: watching.saved })
        setWatching(null)
      }} />}
    </div>
    <Walking walk={walk} overlay={overlay} />
  </Screen>
}
