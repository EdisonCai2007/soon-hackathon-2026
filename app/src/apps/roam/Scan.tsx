import { useReducer, useState, type ReactNode } from 'react'
import { Loading } from '@/components/Loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import type { Pose as Stance } from './messages'
import type { Peer } from './presence'
import { RoomViewer } from './RoomViewer'
import type { Pose, View } from './scene'
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

function Bar({ ready, live, act, box }: { ready: Ready; live?: Live; act: Act; box: HTMLElement | null }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">
    <h1>ROAM</h1>
    {ready && <Badge variant="secondary">{ready.scene.views} video views · {ready.scene.splats.toLocaleString('en-US')} splats</Badge>}
    {live?.soundBlocked && <Badge variant="outline">sound off</Badge>}
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

/** The scanned room in the page: walked alone, or shared with whoever a live room holds. */
export function Scan({ app, live, before }: { app: string; live?: Live; before?: ReactNode }) {
  const [state, dispatch] = useReducer(viewerReducer, initialViewer)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [watching, setWatching] = useState<{ id: string; saved: Pose } | null>(null)
  const ready = state.status === 'ready' ? state : null
  const watched = live?.peers.find((peer) => peer.member.id === watching?.id) ?? null

  return (
    <div onPointerDown={live?.unlock}>
      <Bar ready={ready} live={live} act={dispatch} box={box} />
      {before}
      <Cameras ready={ready} act={dispatch} />
      {state.status === 'error' || state.status === 'no-webgl'
        ? <Stopped state={state} retry={() => dispatch({ type: 'retry' })} />
        : <div ref={setBox} className="relative h-[70vh] min-h-80 overflow-hidden rounded-xl border bg-[#10151c]">
          <RoomViewer sceneUrl={`/apps/${app}/scene.json`} splatUrl={`/apps/${app}/room.spz`} pose={ready?.pose ?? null} onEvent={dispatch}
            peers={live?.peers} audio={live?.audio} onStance={live?.tell}
            onPick={live && ((id, saved) => setWatching({ id, saved }))} />
          {state.status === 'loading' && <div className="absolute inset-0">
            <Loading label={loadingLabel(state.progress)} className="h-full"><Skeleton className="h-full rounded-none" /></Loading>
          </div>}
          {watched && watching && <Watch peer={watched} onClose={() => {
            dispatch({ type: 'look', pose: watching.saved })
            setWatching(null)
          }} />}
        </div>}
      {live && <div className="mt-4">{live.people}</div>}
    </div>
  )
}
