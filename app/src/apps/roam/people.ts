// A filmed moment played back inside the scan: an animated model placed by where someone stood, looping forever.
import { AnimationMixer, DirectionalLight, Group, HemisphereLight, LoopRepeat, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { floorHeight, unitsPerMetre } from './placement'
import type { Scene } from './scene'

type Vec2 = [number, number]
type Vec3 = [number, number, number]

/** Where a clip goes: the scan spot one of its people stands on, which way they face, and where that person
 *  starts inside the model, in model metres, so the spot lands under them and not under the model's origin. */
export type Placement = { url: string; at: Vec3; facing: Vec3; anchor: Vec2 }

// The two of them on the living-room couch: Edison's copied spot and heading, and where the white-shirted
// figure (MH_P002) starts in the clip, its hips over the model's floor.
export const COUCH: Placement = {
  url: '/apps/roam/people.glb',
  at: [-2.208, -2.603, -0.594],
  facing: [0.79, -0.17, 0.59],
  anchor: [-0.336, -0.264],
}

/** The turn about the vertical that points a model's +z (its people's front) along a heading. */
export const yawFor = ([x, , z]: Vec3): number => Math.atan2(x, z)

/** Where the model's origin goes so that its anchor lands on the spot: on the floor under it, in scan units. */
export function originFor(placement: Placement, scene: Scene): { position: Vec3; yaw: number; scale: number } {
  const scale = unitsPerMetre(scene)
  const yaw = yawFor(placement.facing)
  const [ax, az] = placement.anchor
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  // The anchor turned with the model, then scaled into scan units.
  const turned: Vec2 = [(ax * cos + az * sin) * scale, (-ax * sin + az * cos) * scale]
  const [x, y, z] = placement.at
  return { position: [x - turned[0], floorHeight(scene, y), z - turned[1]], yaw, scale }
}

export type People = { update: (seconds: number) => void; dispose: () => void }

/** Loads the clip into the world and starts every animation in it on an endless loop. */
export async function addPeople(world: Object3D, scene: Scene, placement: Placement = COUCH): Promise<People> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(placement.url)
  const { position, yaw, scale } = originFor(placement, scene)
  const group = new Group()
  group.position.fromArray(position)
  group.rotation.y = yaw
  group.scale.setScalar(scale)
  group.add(gltf.scene)
  // The splats carry their own light; the model needs some to be seen at all.
  const sky = new HemisphereLight('#ffffff', '#8a8378', 2.2)
  const sun = new DirectionalLight('#ffffff', 1.2)
  sun.position.set(1, 2, 1)
  world.add(group, sky, sun)
  const mixer = new AnimationMixer(gltf.scene)
  for (const clip of gltf.animations) mixer.clipAction(clip).setLoop(LoopRepeat, Infinity).play()
  return {
    update: (seconds) => mixer.update(seconds),
    dispose: () => {
      mixer.stopAllAction()
      world.remove(group, sky, sun)
    },
  }
}
