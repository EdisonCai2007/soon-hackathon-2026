// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mesh, Object3D, PerspectiveCamera, Vector2, Vector3 } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import type { Member } from './messages'
import { figureSize, floorHeight } from './placement'
import type { Peer } from './presence'
import { nextMotion, SEND_INTERVAL_MS } from './pose-feed'
import { parseScene } from './scene'
import { makeStage, pointerAt, stanceOf } from './stage'

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))

// The sound card, stood in: every node records what it was told, so the placing can be read back.
const param = () => ({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
const chain = () => ({ connect: vi.fn((next: unknown) => next), disconnect: vi.fn() })
function soundCard() {
  const gains: { gain: ReturnType<typeof param> }[] = []
  const panners: Record<string, unknown>[] = []
  const listener = Object.fromEntries(['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ']
    .map((name) => [name, param()]))
  const context = {
    currentTime: 2,
    listener,
    destination: {},
    createGain: vi.fn(() => { const node = { ...chain(), gain: param() }; gains.push(node); return node }),
    createPanner: vi.fn(() => { const node = { ...chain(), panningModel: '', distanceModel: '', rolloffFactor: 1, positionX: param(), positionY: param(), positionZ: param() }; panners.push(node); return node }),
    createMediaStreamSource: vi.fn(() => chain()),
  }
  return { context: context as unknown as AudioContext, gains, panners, listener }
}

const member = (id: string, name = id): Member => ({ id, name, color: '#f97362', role: 'guest', pose: null })
const peer = (id: string, at: { x: number; y: number; z: number }, stream: MediaStream | null = null): Peer =>
  ({ member: member(id), motion: nextMotion(null, { ...at, yaw: 0 }, 1000), stream })
const stream = () => ({ getTracks: () => [] }) as unknown as MediaStream
const camera = (at: [number, number, number]) => {
  const one = new PerspectiveCamera(55, 1, 0.1, 100)
  one.position.set(...at)
  one.updateMatrixWorld()
  return one
}

afterEach(() => vi.unstubAllGlobals())

it('draws a figure for each person and takes it away when they leave', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 }), peer('b2', { x: 1, y: 0, z: 1 })])
  expect(world.children).toHaveLength(2)
  // Syncing the same room again draws nobody twice.
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 }), peer('b2', { x: 1, y: 0, z: 1 })])
  expect(world.children).toHaveLength(2)
  stage.sync([peer('b2', { x: 1, y: 0, z: 1 })])
  expect(world.children).toHaveLength(1)
  stage.dispose()
  expect(world.children).toHaveLength(0)
})

it('stands a figure on the floor, facing the viewer, and moves it as its positions arrive', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  const at = { x: 1, y: 9, z: 2 }
  stage.sync([peer('a1', at)])
  stage.update(camera([1, 0, 8]), 1000)
  const figure = world.children[0]
  const { height } = figureSize(scene)
  // Feet on the floor, whatever height the person reported.
  expect(figure.position.y).toBeCloseTo(floorHeight(scene) + height / 2)
  expect([figure.position.x, figure.position.z]).toEqual([1, 2])
  // Facing a viewer standing further along +z.
  expect(figure.rotation.y).toBeCloseTo(0)
  expect(figure.rotation.x).toBe(0)

  const moved: Peer = { ...peer('a1', at), motion: nextMotion(null, { x: 5, y: 0, z: 2, yaw: 0 }, 2000) }
  stage.sync([moved])
  stage.update(camera([1, 0, 8]), 2000 + SEND_INTERVAL_MS)
  expect(world.children[0].position.x).toBeCloseTo(5)
})

it('leaves a figure where it was until its person says otherwise', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  const still: Peer = { member: member('a1'), motion: null, stream: null }
  stage.sync([still])
  stage.update(camera([0, 0, 5]), 1000)
  expect(world.children[0].position.x).toBe(0)
})

it("shows a person's video on their figure once it arrives, and only once", () => {
  const world = new Object3D()
  const sound = soundCard()
  const stage = makeStage(world, scene, sound.context)
  const theirs = stream()
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 })])
  const figure = world.children[0] as Mesh
  expect((figure.material as { map: unknown }).map).toBeNull()

  stage.sync([peer('a1', { x: 0, y: 0, z: 0 }, theirs)])
  expect((figure.material as { map: unknown }).map).not.toBeNull()
  expect(sound.context.createMediaStreamSource).toHaveBeenCalledTimes(1)
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 }, theirs)])
  expect(sound.context.createMediaStreamSource).toHaveBeenCalledTimes(1)
  stage.dispose()
})

it('draws a person with no sound card to place their voice on', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 }, stream())])
  stage.update(camera([0, 0, 3]), 1000)
  expect(world.children).toHaveLength(1)
  stage.dispose()
})

it('places a voice the old way where the panner has no parameters', () => {
  const world = new Object3D()
  const sound = soundCard()
  const plain = { ...sound.context, createPanner: () => ({ connect: (next: unknown) => next, disconnect: () => {}, panningModel: '', distanceModel: '', rolloffFactor: 1 }) } as unknown as AudioContext
  const stage = makeStage(world, scene, plain)
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 }, stream())])
  expect(() => stage.update(camera([0, 0, 3]), 1000)).not.toThrow()
})

it('places each voice where its person stands and turns it down with distance', () => {
  const world = new Object3D()
  const sound = soundCard()
  const stage = makeStage(world, scene, sound.context)
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 }, stream())])

  stage.update(camera([0, 0, 0.2]), 1000)
  const close = sound.gains[0].gain.setTargetAtTime.mock.calls.at(-1)![0] as number
  stage.update(camera([0, 0, 20]), 1000)
  const far = sound.gains[0].gain.setTargetAtTime.mock.calls.at(-1)![0] as number
  expect(close).toBeGreaterThan(far)
  expect(sound.panners[0].panningModel).toBe('HRTF')
  expect((sound.panners[0].positionZ as ReturnType<typeof param>).setValueAtTime).toHaveBeenCalled()
  // The ears follow the viewer.
  expect(sound.listener.positionZ.setValueAtTime).toHaveBeenCalledWith(20, 2)
})

it('places the ears the old way where the sound card has no parameters', () => {
  const world = new Object3D()
  const sound = soundCard()
  const setPosition = vi.fn()
  const context = { ...sound.context, listener: { setPosition } } as unknown as AudioContext
  const stage = makeStage(world, scene, context)
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 })])
  stage.update(camera([1, 2, 3]), 1000)
  expect(setPosition).toHaveBeenCalledWith(1, 2, 3)
})

it('picks the person the pointer is on, and nobody where there is nobody', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  stage.sync([peer('a1', { x: 0, y: 0, z: 0 })])
  const viewer = camera([0, floorHeight(scene) + figureSize(scene).height / 2, 3])
  viewer.lookAt(new Vector3(0, floorHeight(scene) + figureSize(scene).height / 2, 0))
  viewer.updateMatrixWorld()
  stage.update(viewer, 1000)
  expect(stage.pick(new Vector2(0, 0), viewer)).toBe('a1')
  expect(stage.pick(new Vector2(-0.99, 0.99), viewer)).toBeNull()
})

it('turns a pointer press into where it fell on the view', () => {
  const box = { left: 100, top: 50, width: 200, height: 100 } as DOMRect
  // Adding zero so the middle of the view reads as 0 rather than -0.
  expect(pointerAt({ clientX: 200, clientY: 100 }, box, new Vector2()).toArray().map((part) => part + 0)).toEqual([0, 0])
  expect(pointerAt({ clientX: 100, clientY: 50 }, box, new Vector2()).toArray()).toEqual([-1, 1])
  expect(pointerAt({ clientX: 300, clientY: 150 }, box, new Vector2()).toArray()).toEqual([1, -1])
})

it("reads this page's own stance off its camera", () => {
  const one = camera([1, 2, 3])
  one.rotation.set(0, Math.PI / 2, 0)
  expect(stanceOf(one)).toMatchObject({ x: 1, y: 2, z: 3 })
  expect(stanceOf(one).yaw).toBeCloseTo(Math.PI / 2)
})
