import { useCallback, useEffect, useReducer, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Loading } from '@/components/Loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useCasts, useTechniqueSounds, type Casting } from './casting'
import type { Pose as Stance } from './messages'
import { NoteCount, NotePanel } from './NotePanel'
import { mediaUrl, readNotes, removeNote, type Note } from './notes'
import { playNote, type NoteVoice } from './note-sound'
import type { Peer } from './presence'
import { RoomViewer } from './RoomViewer'
import type { Pose, Scene, View } from './scene'
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

function Bar({ ready, live, act, box, notes }: { ready: Ready; live?: Live; act: Act; box: HTMLElement | null; notes: readonly Note[] }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">
    <h1>ROAM</h1>
    {ready && <Badge variant="secondary">{ready.scene.views} video views · {ready.scene.splats.toLocaleString('en-US')} splats</Badge>}
    <NoteCount notes={notes} />
    {live?.soundBlocked && <Badge variant="outline">sound off</Badge>}
    {live && <Hands casting={live.casting} />}
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

/** Plays one note's clip at a time, placed where it was left, and hands the viewer what to tell each frame. */
function useNoteVoice(app: string, scene: Scene | null) {
  const card = useRef<AudioContext | null>(null)
  const [voice, setVoice] = useState<NoteVoice | null>(null)

  const stop = useCallback(() => {
    setVoice((playing) => {
      playing?.stop()
      return null
    })
  }, [])

  const play = useCallback(async (note: Note) => {
    if (!scene || typeof AudioContext === 'undefined') return
    stop()
    // The press that opened the clip is the gesture a browser waits for, so the card starts here and is kept.
    card.current ??= new AudioContext()
    const started = await playNote(card.current, mediaUrl(app, note.id), note.spot, scene, stop)
    if (started) setVoice(started)
  }, [app, scene, stop])

  useEffect(() => () => stop(), [stop])
  return { voice, play, stop }
}

type ViewProps = {
  app: string
  live?: Live
  scene: Scene | null
  pose: Pose | null
  act: Act
  notes: readonly Note[]
  voice: NoteVoice | null
  onPick: NonNullable<ComponentProps<typeof RoomViewer>['onPick']>
}

/** The scan itself, with the techniques running over it and where this person's own view stands. */
function View({ app, live, scene, pose, act, notes, voice, onPick }: ViewProps) {
  const [stance, setStance] = useState<Stance | null>(null)
  const casts = useCasts(live?.peers, live?.casting.mine, stance)
  useTechniqueSounds(live?.audio, casts, scene, stance)
  return <RoomViewer sceneUrl={`/apps/${app}/scene.json`} splatUrl={`/apps/${app}/room.spz`} pose={pose} onEvent={act}
    peers={live?.peers} notes={notes} audio={live?.audio} voice={voice} casts={casts} onPick={onPick}
    onStance={live && ((here) => { setStance(here); live.tell(here) })} />
}

/** The scanned room in the page: walked alone, or shared with whoever a live room holds. */
export function Scan({ app, live, before }: { app: string; live?: Live; before?: ReactNode }) {
  const [state, dispatch] = useReducer(viewerReducer, initialViewer)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [watching, setWatching] = useState<{ id: string; saved: Pose } | null>(null)
  const [notes, setNotes] = useState<readonly Note[]>([])
  const [opened, setOpened] = useState<string | null>(null)
  const ready = state.status === 'ready' ? state : null
  const watched = live?.peers.find((peer) => peer.member.id === watching?.id) ?? null
  const note = notes.find((one) => one.id === opened) ?? null
  const { voice, play, stop } = useNoteVoice(app, ready?.scene ?? null)

  const refresh = useCallback(() => readNotes(app).then(setNotes), [app])
  useEffect(() => { void refresh() }, [refresh])

  const close = () => {
    stop()
    setOpened(null)
  }

  const remove = async () => {
    if (note && await removeNote(app, note.id)) await refresh()
    close()
  }

  return (
    <div onPointerDown={live?.unlock}>
      <Bar ready={ready} live={live} act={dispatch} box={box} notes={notes} />
      {before}
      <Cameras ready={ready} act={dispatch} />
      {state.status === 'error' || state.status === 'no-webgl'
        ? <Stopped state={state} retry={() => dispatch({ type: 'retry' })} />
        : <div ref={setBox} className="relative h-[70vh] min-h-80 overflow-hidden rounded-xl border bg-[#10151c]">
          <View app={app} live={live} scene={ready?.scene ?? null} pose={ready?.pose ?? null} act={dispatch} notes={notes}
            voice={voice}
            onPick={(picked, saved) => {
              if (picked.kind === 'note') return setOpened(picked.id)
              if (live) setWatching({ id: picked.id, saved })
            }} />
          {state.status === 'loading' && <div className="absolute inset-0">
            <Loading label={loadingLabel(state.progress)} className="h-full"><Skeleton className="h-full rounded-none" /></Loading>
          </div>}
          {note && <NotePanel app={app} note={note} playing={voice !== null} onPlay={() => void play(note)} onStop={stop}
            onRemove={() => void remove()} onClose={close} />}
          {watched && watching && <Watch peer={watched} onClose={() => {
            dispatch({ type: 'look', pose: watching.saved })
            setWatching(null)
          }} />}
        </div>}
      {live && <div className="mt-4">{live.people}</div>}
    </div>
  )
}
