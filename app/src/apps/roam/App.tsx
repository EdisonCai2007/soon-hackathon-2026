import { useReducer } from 'react'
import { useParams } from 'react-router'
import { Loading } from '@/components/Loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { RoomViewer } from './RoomViewer'
import type { View } from './scene'
import { initialViewer, viewerReducer, type ViewerState } from './viewer-state'

const VIEWS: [View, string][] = [['room', 'Room view'], ['overview', 'Overview'], ['top', 'Top view']]
const NO_WEBGL = 'This browser can’t show 3D. Open the page in a recent Chrome, Edge, Firefox or Safari.'

const loadingLabel = (progress: number | null) =>
  progress === null ? 'Loading the room…' : `Loading the room… ${Math.round(progress * 100)}%`

function Stopped({ state, retry }: { state: Extract<ViewerState, { status: 'error' | 'no-webgl' }>; retry: () => void }) {
  return <Card className="grid justify-items-start gap-4 p-6">
    {state.status === 'error'
      ? <><p>{state.message} Check your connection, then try again.</p><Button type="button" onClick={retry}>Try again</Button></>
      : <p>{NO_WEBGL}</p>}
  </Card>
}

// ROAM's first step: the real room scan, walkable in the page. The scan and its details are this app's static
// files in app/public/apps/roam/, made by scripts/roam-ply-to-spz.mjs.
export function App() {
  const { name } = useParams()
  const [state, dispatch] = useReducer(viewerReducer, initialViewer)
  const ready = state.status === 'ready' ? state : null

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1>ROAM</h1>
        {ready && <Badge variant="secondary">{ready.scene.views} video views · {ready.scene.splats.toLocaleString('en-US')} splats</Badge>}
        <div className="ml-auto flex flex-wrap gap-2">
          {VIEWS.map(([view, label]) => (
            <Button key={label} type="button" variant="outline" disabled={!ready} onClick={() => dispatch({ type: 'go', view })}>{label}</Button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Label htmlFor="roam-camera">Camera</Label>
        <NativeSelect id="roam-camera" disabled={!ready} value={ready?.camera ?? ''} onChange={(event) => dispatch({ type: 'go', view: Number(event.target.value) })}>
          {ready?.scene.cameras.map((camera, index) => <NativeSelectOption key={camera.name} value={index}>{camera.name}</NativeSelectOption>)}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">Click the scene, then W/A/S/D to move · Q/E down and up · drag to look · Shift to go faster</p>
      </div>
      {state.status === 'error' || state.status === 'no-webgl'
        ? <Stopped state={state} retry={() => dispatch({ type: 'retry' })} />
        : <div className="relative h-[70vh] min-h-80 overflow-hidden rounded-xl border bg-[#10151c]">
          <RoomViewer sceneUrl={`/apps/${name}/scene.json`} splatUrl={`/apps/${name}/room.spz`} pose={ready?.pose ?? null} onEvent={dispatch} />
          {state.status === 'loading' && <div className="absolute inset-0">
            <Loading label={loadingLabel(state.progress)} className="h-full"><Skeleton className="h-full rounded-none" /></Loading>
          </div>}
        </div>}
    </div>
  )
}
