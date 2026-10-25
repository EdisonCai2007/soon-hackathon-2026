// Where the scan goes so that it meets the real room. An XR camera is driven by the phone and can not be moved
// by the page, so the scan is moved instead: openspec roam-ar-view, "The placing transform is its own module".
import { unitsPerMetre, type Anchor } from './placement'
import type { Pose } from './messages'
import type { Scene } from './scene'

type Spot = { x: number; y: number; z: number }

/** Two nested groups: the inner one puts the anchor at the origin, the outer one turns and scales the scan. */
export type Placing = { inner: [number, number, number]; outer: [number, number, number]; yaw: number; scale: number }

/** The placing for an anchor, which is a taped spot in the real home or wherever a guest's view already stood. */
export const placingFor = (anchor: Anchor, scene: Scene, origin?: Pose): Placing => ({
  inner: [-anchor.x, -anchor.floor, -anchor.z],
  outer: origin ? [origin.x, origin.y, origin.z] : [0, 0, 0],
  yaw: (origin?.yaw ?? 0) - anchor.yaw,
  scale: 1 / unitsPerMetre(scene),
})

/** Where a place in the scan falls in the session's own metres: exactly the inverse of `toScanPose`, so the
 *  drawn view and the pose the phone reports cannot disagree about where the person is standing. */
export function sessionSpot(spot: Spot, { inner, outer, yaw, scale }: Placing): Spot {
  const x = (spot.x + inner[0]) * scale
  const y = (spot.y + inner[1]) * scale
  const z = (spot.z + inner[2]) * scale
  return {
    x: outer[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
    y: outer[1] + y,
    z: outer[2] + z * Math.cos(yaw) - x * Math.sin(yaw),
  }
}
