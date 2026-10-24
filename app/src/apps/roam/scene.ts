type Vec3 = [number, number, number]
export type CameraPreset = { name: string; eye: Vec3; target: Vec3; up: Vec3; fov_y?: number }
export type Scene = {
  splats: number
  views: number
  bounds: [Vec3, Vec3]
  rotation: [Vec3, Vec3, Vec3]
  translation: Vec3
  cameras: CameraPreset[]
}
export type Pose = { eye: Vec3; target: Vec3; up: Vec3; fov: number }

const isVec3 = (value: unknown): value is Vec3 =>
  Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n))

const isCamera = (value: unknown): value is CameraPreset => {
  const camera = value as Partial<CameraPreset> | null
  return !!camera && typeof camera.name === 'string' && isVec3(camera.eye) && isVec3(camera.target) && isVec3(camera.up)
}

/** The scan's metadata, checked. Throws a sentence a viewer can read when the file is not the scan's. */
export function parseScene(json: unknown): Scene {
  const scene = json as Partial<Scene> | null
  const ok =
    !!scene &&
    typeof scene.splats === 'number' &&
    typeof scene.views === 'number' &&
    Array.isArray(scene.bounds) &&
    scene.bounds.length === 2 &&
    scene.bounds.every(isVec3) &&
    Array.isArray(scene.rotation) &&
    scene.rotation.length === 3 &&
    scene.rotation.every(isVec3) &&
    isVec3(scene.translation) &&
    Array.isArray(scene.cameras) &&
    scene.cameras.length > 0 &&
    scene.cameras.every(isCamera)
  if (!ok) throw new Error('The scan’s description is not valid.')
  return scene as Scene
}

const DEFAULT_FOV = 55

/** A source-video camera as a pose, using the fitted field of view when the scan has one. */
export function presetPose(camera: CameraPreset): Pose {
  return { eye: camera.eye, target: camera.target, up: camera.up, fov: camera.fov_y ?? DEFAULT_FOV }
}

const midpoint = (scene: Scene): Vec3 => [0, 1, 2].map((i) => (scene.bounds[0][i] + scene.bounds[1][i]) / 2) as Vec3
const extent = (scene: Scene) =>
  Math.max(scene.bounds[1][0] - scene.bounds[0][0], scene.bounds[1][2] - scene.bounds[0][2])

/** A view of the whole room from above one corner. */
export function overviewPose(scene: Scene): Pose {
  const [x, y, z] = midpoint(scene)
  const size = extent(scene)
  const target: Vec3 = [x, y, z]
  return {
    eye: [x - 0.68 * size, y + 0.72 * size, z + 0.86 * size],
    target,
    up: [0, 1, 0],
    fov: DEFAULT_FOV,
  }
}

/** A view straight down on the room. */
export function topPose(scene: Scene): Pose {
  const [x, y, z] = midpoint(scene)
  return { eye: [x, y + extent(scene) * 1.6, z + 0.001], target: [x, y, z], up: [0, 0, -1], fov: DEFAULT_FOV }
}
