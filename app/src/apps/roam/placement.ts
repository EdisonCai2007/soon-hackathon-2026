// Where a person stands in the scan. The scan's units are not metres and no file says what they are, so
// one constant carries the scale and everything else is derived from it: openspec design, "the scan's units".
import type { Pose } from './messages'
import type { Scene } from './scene'

/** How high above the floor a phone is held while filming. The one number the scale rests on. */
export const PHONE_HEIGHT_M = 1.5

const median = (values: number[]): number => {
  const sorted = [...values].sort((one, two) => one - two)
  const middle = sorted.length / 2
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[Math.floor(middle)]
}

/** The floor the figures stand on: the lowest the scan goes. */
export const floorHeight = (scene: Scene): number => scene.bounds[0][1]

const eyeHeight = (scene: Scene): number => median(scene.cameras.map((camera) => camera.eye[1])) - floorHeight(scene)

/** Scan units to the metre, from the height the scan was filmed at. Tune PHONE_HEIGHT_M, not this. */
export const unitsPerMetre = (scene: Scene): number => eyeHeight(scene) / PHONE_HEIGHT_M

/** A figure is as tall as the camera was high, and about a third as wide. */
export const figureSize = (scene: Scene): { height: number; width: number } => {
  const height = eyeHeight(scene)
  return { height, width: height * 0.38 }
}

export const sceneExtent = ({ bounds: [low, high] }: Scene): number => Math.max(high[0] - low[0], high[2] - low[2])

/** The spot in the real room that is taped on the floor, taken from one of the scan's own cameras. */
export type Anchor = { x: number; z: number; yaw: number }

export function anchorAt(scene: Scene, index: number): Anchor {
  const { eye, target } = scene.cameras[Math.min(Math.max(index, 0), scene.cameras.length - 1)]
  return { x: eye[0], z: eye[2], yaw: Math.atan2(target[0] - eye[0], target[2] - eye[2]) }
}

/** A phone's own tracking, in metres from where it was lined up, turned into a place in the scan. */
export function toScanPose(ar: Pose, anchor: Anchor, scene: Scene): Pose {
  const scale = unitsPerMetre(scene)
  const sin = Math.sin(anchor.yaw)
  const cos = Math.cos(anchor.yaw)
  return {
    x: anchor.x + (ar.x * cos + ar.z * sin) * scale,
    y: floorHeight(scene) + ar.y * scale,
    z: anchor.z + (ar.z * cos - ar.x * sin) * scale,
    yaw: anchor.yaw + ar.yaw,
  }
}

/** A guest's figure stands where their own view stands, with both feet on the floor. */
export const standing = (pose: Pose, scene: Scene): Pose => ({ ...pose, y: floorHeight(scene) })

/** Turned to face the viewer, upright, however far above or below the viewer is. */
export const billboardYaw = (figure: { x: number; z: number }, camera: { x: number; z: number }): number =>
  Math.atan2(camera.x - figure.x, camera.z - figure.z)
