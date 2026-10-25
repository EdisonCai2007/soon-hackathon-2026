import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three'
import { z } from 'zod'

const vec3 = z.tuple([z.number(), z.number(), z.number()])

// The scan's details from Edison's pipeline (splat_scene.json): how to turn the PLY upright, its bounds, camera
// spots and, for several floors, their heights. Fields the viewer doesn't use are ignored.
const sceneSchema = z.object({
  splats: z.number().int().positive(),
  views: z.number().int().positive(),
  bounds: z.tuple([vec3, vec3]),
  cutHeight: z.number(),
  rotation: z.tuple([vec3, vec3, vec3]),
  translation: vec3,
  floors: z.array(z.number()).min(1).optional(),
  cameras: z.array(z.object({
    name: z.string().min(1),
    eye: vec3,
    target: vec3,
    up: vec3,
    fov_y: z.number().positive().optional(),
  })).min(1),
})

export type Scene = z.infer<typeof sceneSchema>
type Vec3 = [number, number, number]
export type Pose = { position: Vec3; target: Vec3; up: Vec3; fov: number }
export type View = 'room' | 'overview' | 'top' | number

const FOV = 55

/** The checked scene details; throws on anything else, so a bad file fails the load instead of the render. */
export const parseScene = (data: unknown): Scene => sceneSchema.parse(data)

/** The scan's details from the app's own files, checked. Throws, so each page says what it wants to say. */
export async function loadScene(url: string): Promise<Scene> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseScene(await response.json())
}

/** The rotation that stands the scan upright, from the details' row-major 3×3 matrix. */
export function displayQuaternion({ rotation: [a, b, c] }: Scene): Quaternion {
  const matrix = new Matrix4().set(a[0], a[1], a[2], 0, b[0], b[1], b[2], 0, c[0], c[1], c[2], 0, 0, 0, 0, 1)
  return new Quaternion().setFromRotationMatrix(matrix)
}

const measure = ({ bounds: [low, high] }: Scene) => ({
  center: low.map((value, axis) => (value + high[axis]) / 2) as Vec3,
  extent: Math.max(high[0] - low[0], high[2] - low[2]),
})

/** Where each view puts the camera. Room view is the first source camera; a number is that source camera. */
export function poseFor(scene: Scene, view: View): Pose {
  if (typeof view === 'number') {
    const { eye, target, up, fov_y } = scene.cameras[view]
    return { position: eye, target, up, fov: fov_y ?? FOV }
  }
  if (view === 'room') return poseFor(scene, 0)
  const { center, extent } = measure(scene)
  if (view === 'top') {
    return { position: [center[0], center[1] + extent * 1.6, center[2] + 0.001], target: center, up: [0, 0, -1], fov: FOV }
  }
  const target: Vec3 = [center[0], (scene.bounds[0][1] + scene.cutHeight) / 2, center[2]]
  const offset = [-0.68, 0.72, 0.86].map((step) => step * extent)
  return { position: target.map((value, axis) => value + offset[axis]) as Vec3, target, up: [0, 1, 0], fov: FOV }
}

/** Where the camera stands right now, in the same shape a view jump uses, so it can be returned to. */
export function cameraPose(camera: PerspectiveCamera): Pose {
  const forward = camera.getWorldDirection(new Vector3()).add(camera.position)
  return { position: camera.position.toArray(), target: forward.toArray(), up: camera.up.toArray(), fov: camera.fov }
}

export function applyPose(camera: PerspectiveCamera, { position, target, up, fov }: Pose) {
  camera.fov = fov
  camera.updateProjectionMatrix()
  camera.up.fromArray(up)
  camera.position.fromArray(position)
  camera.lookAt(new Vector3().fromArray(target))
}
