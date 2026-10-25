// The taped spots in the real home. Each is one of the scan's own camera positions, so a phone standing on one
// knows where it is and which floor it is on, and tracking that has drifted is put right by picking it again.
import { anchorAt, type Anchor } from './placement'
import type { Scene } from './scene'

export type Spot = { name: string; camera: number }

/** Named from the scan's own videos until they are taped in the real home and named by eye. */
export const SPOTS: readonly Spot[] = [
  { name: 'Upstairs, where the scan starts', camera: 0 },
  { name: 'The top of the stairs', camera: 307 },
  { name: 'The bottom of the stairs', camera: 393 },
  { name: 'The lobby', camera: 585 },
]

export type MarkedSpot = Spot & { anchor: Anchor }

/** The spots this scan knows. A spot past its cameras is left out rather than landing on the nearest one. */
export const markedSpots = (scene: Scene): MarkedSpot[] =>
  SPOTS.filter((spot) => spot.camera < scene.cameras.length)
    .map((spot) => ({ ...spot, anchor: anchorAt(scene, spot.camera) }))

/** Which floor a spot is on, counted from the bottom, for a label beside its name. */
export const floorOf = (scene: Scene, spot: MarkedSpot): number =>
  [...scene.floors ?? [scene.bounds[0][1]]].sort((one, two) => one - two).indexOf(spot.anchor.floor) + 1
