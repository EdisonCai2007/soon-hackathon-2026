import { RoomViewer } from './RoomViewer'

/** ROAM's first step: the scanned room, opened in the browser and walkable. */
export function App() {
  return (
    <div>
      <h1 className="mb-3">ROAM</h1>
      <p className="mb-6 text-muted-foreground">Walk through a 3D scan of a real room. Unseen surfaces may be incomplete.</p>
      <RoomViewer base="/apps/roam" />
    </div>
  )
}
