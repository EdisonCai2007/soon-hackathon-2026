/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Group, Scene as World } from 'three'
import { expect, it, vi } from 'vitest'
import { addPeople, COUCH, originFor, yawFor } from './people'
import { floorHeight, unitsPerMetre } from './placement'
import { parseScene } from './scene'

// A stand-in model: one part that slides two units along x over two seconds.
const model = vi.hoisted(() => ({ loaded: [] as string[] }))
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', async () => {
  const { AnimationClip, Group, VectorKeyframeTrack } = await vi.importActual<typeof import('three')>('three')
  class GLTFLoader {
    setMeshoptDecoder() { return this }
    async loadAsync(url: string) {
      model.loaded.push(url)
      return { scene: new Group(), animations: [new AnimationClip('slide', 2, [new VectorKeyframeTrack('.position', [0, 2], [0, 0, 0, 2, 0, 0])])] }
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

it('puts the anchored person on the spot, on the floor under it', () => {
  const { position, yaw, scale } = originFor(COUCH, scene)
  expect(scale).toBeCloseTo(unitsPerMetre(scene))
  expect(position[1]).toBe(floorHeight(scene, COUCH.at[1]))
  // The anchor, turned and scaled as the model is, lands where it was asked to.
  const [ax, az] = COUCH.anchor
  const x = position[0] + (ax * Math.cos(yaw) + az * Math.sin(yaw)) * scale
  const z = position[2] + (-ax * Math.sin(yaw) + az * Math.cos(yaw)) * scale
  expect(x).toBeCloseTo(COUCH.at[0])
  expect(z).toBeCloseTo(COUCH.at[2])
})

it('adds the clip where it belongs and replays it without end', async () => {
  const world = new World()
  const people = await addPeople(world, scene)
  expect(model.loaded).toEqual([COUCH.url])
  const placed = world.children.find((child) => child instanceof Group)!
  const { position, yaw, scale } = originFor(COUCH, scene)
  expect(placed.position.toArray()).toEqual(position)
  expect(placed.rotation.y).toBeCloseTo(yaw)
  expect(placed.scale.x).toBeCloseTo(scale)
  // Lit, so the model is seen at all.
  expect(world.children).toHaveLength(3)
  const [part] = placed.children
  people.update(1)
  expect(part.position.x).toBeCloseTo(1)
  // Past its two seconds the clip starts again rather than stopping at the end.
  people.update(2.5)
  expect(part.position.x).toBeCloseTo(1.5)
  people.dispose()
  expect(world.children).toHaveLength(0)
})
