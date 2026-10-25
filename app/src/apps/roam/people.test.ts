/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Group, Scene as World, type Material } from 'three'
import { expect, it, vi } from 'vitest'
import { addPeople, CLIPS, eyeMaterials, originFor, yawFor } from './people'
import { floorHeight, unitsPerMetre } from './placement'
import { parseScene } from './scene'

// A stand-in model that slides two units along x over two seconds, holding a body and its eyes.
const model = vi.hoisted(() => ({ loaded: [] as string[], eyes: [] as import('three').Material[] }))
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', async () => {
  const { AnimationClip, Group, Mesh, MeshStandardMaterial, VectorKeyframeTrack } = await vi.importActual<typeof import('three')>('three')
  const named = (name: string) => Object.assign(new MeshStandardMaterial(), { name })
  class GLTFLoader {
    setMeshoptDecoder() { return this }
    async loadAsync(url: string) {
      model.loaded.push(url)
      const scene = new Group()
      const eyes = named('MH_P001_Body.high-poly')
      model.eyes.push(eyes)
      scene.add(new Mesh(undefined, named('MH_P001_Body.body')), new Mesh(undefined, [eyes, eyes]))
      return { scene, animations: [new AnimationClip('slide', 2, [new VectorKeyframeTrack('.position', [0, 2], [0, 0, 0, 2, 0, 0])])] }
    }
  }
  return { GLTFLoader }
})

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))

it('turns a model to face a heading', () => {
  expect(yawFor([0, 0, 1])).toBeCloseTo(0)
  expect(yawFor([1, 0, 0])).toBeCloseTo(Math.PI / 2)
  // Height plays no part in the turn.
  expect(yawFor([0.79, -0.17, 0.59])).toBeCloseTo(yawFor([0.79, 5, 0.59]))
})

it.each(CLIPS)('puts the anchored person of $url on the spot, on the floor under it', (clip) => {
  const { position, yaw, scale } = originFor(clip, scene)
  expect(scale).toBeCloseTo(unitsPerMetre(scene))
  expect(position[1]).toBe(floorHeight(scene, clip.at[1]))
  // The anchor, turned and scaled as the model is, lands where it was asked to.
  const [ax, az] = clip.anchor
  const x = position[0] + (ax * Math.cos(yaw) + az * Math.sin(yaw)) * scale
  const z = position[2] + (-ax * Math.sin(yaw) + az * Math.cos(yaw)) * scale
  expect(x).toBeCloseTo(clip.at[0])
  expect(z).toBeCloseTo(clip.at[2])
})

it('adds every clip where it belongs and replays each without end', async () => {
  const world = new World()
  const people = await addPeople(world, scene)
  expect(model.loaded).toEqual(CLIPS.map(({ url }) => url))
  const placed = world.children.filter((child) => child instanceof Group)
  expect(placed).toHaveLength(CLIPS.length)
  CLIPS.forEach((clip, index) => {
    const { position, yaw, scale } = originFor(clip, scene)
    expect(placed[index].position.toArray()).toEqual(position)
    expect(placed[index].rotation.y).toBeCloseTo(yaw)
    expect(placed[index].scale.x).toBeCloseTo(scale)
  })
  // Lit once for all of them, so the models are seen at all.
  expect(world.children).toHaveLength(CLIPS.length + 2)
  const parts = placed.map((group) => group.children[0])
  people.update(1)
  for (const part of parts) expect(part.position.x).toBeCloseTo(1)
  // Past its two seconds a clip starts again rather than stopping at the end.
  people.update(2.5)
  for (const part of parts) expect(part.position.x).toBeCloseTo(1.5)
  people.dispose()
  expect(world.children).toHaveLength(0)
})

it('draws the eyes without their solid cornea, so the pupils show', async () => {
  const world = new World()
  const people = await addPeople(world, scene)
  const placed = world.children.find((child) => child instanceof Group)!
  // Only the eyes' material, once each, however many parts share it.
  expect(eyeMaterials(placed)).toEqual([model.eyes.at(-CLIPS.length)])
  const shader = { fragmentShader: 'before\n#include <map_fragment>\nafter' } as Parameters<Material['onBeforeCompile']>[0]
  model.eyes[0].onBeforeCompile(shader, undefined as never)
  expect(shader.fragmentShader).toBe('before\nif (vMapUv.x > 0.87 && vMapUv.y > 0.87) discard;\n#include <map_fragment>\nafter')
  people.dispose()
})
