// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mesh, Object3D, PerspectiveCamera, Vector2, Vector3 } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import type { Member } from './messages'
import { figureSize, floorHeight, rigParts } from './placement'
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

/** One named part of a body, so a test says which part it means. */
const part = (figure: Object3D, name: string): Mesh => figure.children.find((one) => one.name === name) as Mesh

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

it('stands a body on the floor and moves it as its positions arrive', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  const at = { x: 1, y: 9, z: 2 }
  stage.sync([peer('a1', at)])
  stage.update(camera([1, 0, 8]), 1000)
  const figure = world.children[0]
  const rig = rigParts(scene)
  // The body's own origin is on the floor, whatever height the person reported, and its parts stand on it.
  expect(figure.position.y).toBeCloseTo(floorHeight(scene))
  expect([figure.position.x, figure.position.z]).toEqual([1, 2])
  expect(part(figure, 'head').position.y).toBeCloseTo(rig.head.at[1])
  expect(part(figure, 'torso').position.y).toBeCloseTo(rig.torso.at[1])
  // A hand on each side, the same distance out.
  expect(part(figure, 'left').position.x).toBeCloseTo(-part(figure, 'right').position.x)
  // The top of the head reaches the height one figure had.
  expect(rig.head.at[1] + rig.head.size[1] / 2).toBeCloseTo(figureSize(scene).height)

  const moved: Peer = { ...peer('a1', at), motion: nextMotion(null, { x: 5, y: 0, z: 2, yaw: 0 }, 2000) }
  stage.sync([moved])
  stage.update(camera([1, 0, 8]), 2000 + SEND_INTERVAL_MS)
  expect(world.children[0].position.x).toBeCloseTo(5)
})

it('turns the body the way its person faces and the face toward whoever is looking', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  const looking: Peer = { member: member('a1'), motion: nextMotion(null, { x: 0, y: 0, z: 0, yaw: Math.PI / 2 }, 1000), stream: null }
  stage.sync([looking])
  stage.update(camera([0, 0, 5]), 1000)
  const figure = world.children[0]
  // The body holds its own facing, a quarter turn from the viewer standing along +z.
  expect(figure.rotation.y).toBeCloseTo(Math.PI / 2)
  // The face makes that quarter turn back, so it ends up square to the viewer.
  const face = part(figure, 'face')
  expect(face.rotation.y).toBeCloseTo(-Math.PI / 2)
  expect(face.position.z).toBeCloseTo(0)
  expect(face.position.x).toBeCloseTo(-rigParts(scene).face.radius)
  // Clear of the head from every angle: the face never sits inside the cube.
  const { radius } = rigParts(scene).face
  expect(radius).toBeGreaterThan(rigParts(scene).head.size[0] / 2)
})

it('swings the hands while a person walks and settles them when they stop', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  const { height } = figureSize(scene)
  const walking = (to: number, at: number): Peer =>
    ({ member: member('a1'), motion: nextMotion(null, { x: to, y: 0, z: 0, yaw: 0 }, at), stream: null })
  stage.sync([walking(0, 0)])
  stage.update(camera([0, 0, 5]), 0)
  const figure = world.children[0]
  const reach = () => Math.abs(part(figure, 'left').position.z - part(figure, 'right').position.z)

  // Half a stride in a tenth of a second: a walking pace. The widest the hands get over the walk.
  let widest = 0
  for (let step = 1; step <= 8; step += 1) {
    stage.sync([walking(step * height * 0.45, step * 100)])
    stage.update(camera([0, 0, 5]), step * 100)
    widest = Math.max(widest, reach())
  }
  expect(widest).toBeGreaterThan(height * 0.1)
  // One hand forward is the other hand back, measured from where a hand rests.
  const rest = rigParts(scene).hand.at[2]
  expect(part(figure, 'left').position.z - rest).toBeCloseTo(rest - part(figure, 'right').position.z)

  // Standing still: the same position reported for a second.
  for (let step = 9; step <= 20; step += 1) {
    stage.sync([walking(8 * height * 0.45, step * 100)])
    stage.update(camera([0, 0, 5]), step * 100)
  }
  expect(reach()).toBeLessThan(widest / 4)
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
  const face = part(world.children[0], 'face')
  const head = part(world.children[0], 'head')
  expect((face.material as { map: unknown }).map).toBeNull()

  stage.sync([peer('a1', { x: 0, y: 0, z: 0 }, theirs)])
  // The video lands on the face alone: the rest of the body stays the person's own colour.
  expect((face.material as { map: unknown }).map).not.toBeNull()
  expect((head.material as { map: unknown }).map).toBeNull()
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
  expect(stage.pick(new Vector2(0, 0), viewer)).toEqual({ kind: 'peer', id: 'a1' })
  expect(stage.pick(new Vector2(-0.99, 0.99), viewer)).toBeNull()

  // A hand is out past the torso's edge, and pressing it still names its person.
  const rig = rigParts(scene)
  const aside = camera([rig.hand.at[0], floorHeight(scene) + rig.hand.at[1], 3])
  aside.lookAt(new Vector3(rig.hand.at[0], floorHeight(scene) + rig.hand.at[1], 0))
  aside.updateMatrixWorld()
  stage.update(aside, 1100)
  expect(stage.pick(new Vector2(0, 0), aside)).toEqual({ kind: 'peer', id: 'a1' })
})

const note = (id: string, kind: 'text' | 'voice' | 'photo', at: { x: number; y: number; z: number }) =>
  ({ id, kind, spot: { ...at, yaw: 0 }, author: 'Dana', words: '', media: kind !== 'text', createdAt: 1 })

it('marks what has been left here, where it was left, and takes a marker away again', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  stage.show([note('n1', 'text', { x: 1, y: -3.9, z: 2 }), note('n2', 'voice', { x: 0, y: -1.3, z: 0 })])
  expect(world.children).toHaveLength(2)
  // Showing the same place again marks nothing twice.
  stage.show([note('n1', 'text', { x: 1, y: -3.9, z: 2 }), note('n2', 'voice', { x: 0, y: -1.3, z: 0 })])
  expect(world.children).toHaveLength(2)
  // A marker sits at the note's own height, not on the floor: it is where the phone was held.
  expect(world.children[0].position.toArray()).toEqual([1, -3.9, 2])

  stage.show([note('n2', 'voice', { x: 0, y: -1.3, z: 0 })])
  expect(world.children).toHaveLength(1)
  stage.dispose()
  expect(world.children).toHaveLength(0)
})

it('turns each marker to face whoever is looking', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  stage.show([note('n1', 'photo', { x: 0, y: 0, z: 0 })])
  stage.update(camera([5, 0, 0]), 1000)
  expect(world.children[0].rotation.y).toBeCloseTo(Math.PI / 2)
})

it('says whether a press landed on a person or on something left here', () => {
  const world = new Object3D()
  const stage = makeStage(world, scene, null)
  const spot = { x: 0, y: floorHeight(scene) + 1, z: 0 }
  stage.show([note('n1', 'text', spot)])
  const viewer = camera([spot.x, spot.y, 3])
  viewer.lookAt(new Vector3(spot.x, spot.y, spot.z))
  viewer.updateMatrixWorld()
  stage.update(viewer, 1000)
  expect(stage.pick(new Vector2(0, 0), viewer)).toEqual({ kind: 'note', id: 'n1' })
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
