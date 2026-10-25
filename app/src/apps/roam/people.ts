// A filmed moment played back inside the scan: an animated model placed by where someone stood, looping forever.
import { AnimationMixer, DirectionalLight, Group, HemisphereLight, LoopRepeat, type Material, type Mesh, type Object3D } from 'three'
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
const COUCH: Placement = {
  url: '/apps/roam/people.glb',
  at: [-2.208, -2.603, -0.594],
  facing: [0.79, -0.17, 0.59],
  anchor: [-0.336, -0.264],
}

// In front of the fireplace: the woman in the headscarf (MH_P002) on Edison's spot, turned so the man in the
// blue hooded jacket lands on his own spot, (-0.291, 1.641), within a few centimetres.
const FIREPLACE: Placement = {
  url: '/apps/roam/fireplace.glb',
  at: [0.603, -2.527, 0.641],
  facing: [-0.938, 0, -0.347],
  anchor: [-0.801, -0.281],
}

// Seated by the white desk under the stairs: the woman in the cream sweater (MH_W) half a body nearer the desk
// than Edison's spot (-3.592, 2.618); the heading best fits her copied facing and the grey-shirted man's.
const CHAIRS: Placement = {
  url: '/apps/roam/chairs.glb',
  at: [-3.808, -3.159, 2.282],
  facing: [0.903, 0, 0.429],
  anchor: [-0.861, -0.282],
}

/** Every filmed clip the scan plays. */
export const CLIPS: readonly Placement[] = [COUCH, FIREPLACE, CHAIRS]

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

// MakeHuman's eyes wrap a clear cornea over the iris, mapped to the eye texture's bottom-right corner. The export
// draws it solid, hiding iris and pupil, so the eyes' material skips that corner of the texture.
const CORNEA_FROM_UV = 0.87
const showPupils = (material: Material) => {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      `if (vMapUv.x > ${CORNEA_FROM_UV} && vMapUv.y > ${CORNEA_FROM_UV}) discard;\n#include <map_fragment>`)
  }
}

/** Every material of a model's eyes, which MakeHuman names `<body>.high-poly`. */
export function eyeMaterials(model: Object3D): Material[] {
  const found = new Set<Material>()
  model.traverse((part) => {
    for (const material of [(part as Mesh).material ?? []].flat()) if (material.name.endsWith('.high-poly')) found.add(material)
  })
  return [...found]
}

/** Loads one clip into a group placed on its spot, with every animation in it on an endless loop. */
async function placeClip(loader: GLTFLoader, placement: Placement, scene: Scene) {
  const gltf = await loader.loadAsync(placement.url)
  for (const material of eyeMaterials(gltf.scene)) showPupils(material)
  const { position, yaw, scale } = originFor(placement, scene)
  const group = new Group()
  group.position.fromArray(position)
  group.rotation.y = yaw
  group.scale.setScalar(scale)
  group.add(gltf.scene)
  const mixer = new AnimationMixer(gltf.scene)
  for (const clip of gltf.animations) mixer.clipAction(clip).setLoop(LoopRepeat, Infinity).play()
  return { group, mixer }
}

/** Loads every clip into the world together; one that fails to load fails them all, leaving the room as it was. */
export async function addPeople(world: Object3D, scene: Scene, placements: readonly Placement[] = CLIPS): Promise<People> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const clips = await Promise.all(placements.map((placement) => placeClip(loader, placement, scene)))
  // The splats carry their own light; the models need some to be seen at all.
  const sky = new HemisphereLight('#ffffff', '#8a8378', 2.2)
  const sun = new DirectionalLight('#ffffff', 1.2)
  sun.position.set(1, 2, 1)
  world.add(...clips.map(({ group }) => group), sky, sun)
  return {
    update: (seconds) => { for (const { mixer } of clips) mixer.update(seconds) },
    dispose: () => {
      for (const { group, mixer } of clips) {
        mixer.stopAllAction()
        world.remove(group)
      }
      world.remove(sky, sun)
    },
  }
}
