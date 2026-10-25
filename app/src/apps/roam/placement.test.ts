/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { anchorAt, billboardYaw, facePlacement, figureSize, floorHeight, handSwing, PHONE_HEIGHT_M, rigParts, sceneExtent, standing, toScanPose, unitsPerMetre } from './placement'
import { parseScene, type Scene } from './scene'

// The real scan, so the scale these numbers carry is the one the demo runs on.
const details: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8'))
const scene = parseScene(details)

const made = (cameras: Scene['cameras'], bounds: Scene['bounds'] = [[-1, -2, -1], [1, 1, 1]]): Scene => ({ ...scene, bounds, cameras, floors: undefined })
const camera = (eye: [number, number, number], target: [number, number, number] = [0, 0, 0]) =>
  ({ name: `at ${eye.join()}`, eye, target, up: [0, 1, 0] as [number, number, number] })

it('stands figures on the floor under them', () => {
  // The real scan has two floors: upstairs, and the floor the stairs lead down to.
  expect(floorHeight(scene)).toBeCloseTo(-1.3, 3)
  expect(standing({ x: 1, y: 9, z: 2, yaw: 1 }, scene)).toEqual({ x: 1, y: -1.3, z: 2, yaw: 1 })
  expect(standing({ x: 1, y: -2.7, z: 2, yaw: 1 }, scene)).toEqual({ x: 1, y: -3.95, z: 2, yaw: 1 })
  // A phone held a little below its floor still stands on it, and below every floor is the lowest.
  expect(floorHeight(scene, -1.45)).toBe(-1.3)
  expect(floorHeight(scene, -9)).toBe(-3.95)
  // A scan that lists no floors has one, the lowest it reaches.
  expect(floorHeight(made([camera([0, 1.5, 0])]), 5)).toBe(-2)
})

it('takes the scale from the height the scan was filmed at', () => {
  // Two cameras, a metre and a half above a floor at zero: one unit to the metre.
  const flat = made([camera([0, 1.5, 0]), camera([2, 1.5, 2])], [[-5, 0, -5], [5, 3, 5]])
  expect(unitsPerMetre(flat)).toBeCloseTo(1)
  // Three cameras take the middle one, so one odd height does not move the scale.
  const odd = made([camera([0, 1.5, 0]), camera([0, 1.5, 1]), camera([0, 9, 2])], [[-5, 0, -5], [5, 3, 5]])
  expect(unitsPerMetre(odd)).toBeCloseTo(1)
  // Cameras on either floor measure from their own floor, so a second floor does not stretch the scale.
  expect(unitsPerMetre(scene)).toBeCloseTo(1.32 / PHONE_HEIGHT_M, 2)
  // The real scan: the figure is as tall as the camera was high.
  expect(figureSize(scene).height).toBeCloseTo(unitsPerMetre(scene) * PHONE_HEIGHT_M, 6)
  expect(figureSize(scene).width).toBeLessThan(figureSize(scene).height)
})

it('builds a body no taller and no wider than the one figure it replaces', () => {
  const { height, width } = figureSize(scene)
  const rig = rigParts(scene)
  // The top of the head is the whole figure's height.
  expect(rig.head.at[1] + rig.head.size[1] / 2).toBeCloseTo(height)
  expect(rig.torso.size[0]).toBeCloseTo(width)
  // A hand sits outside the torso and inside the figure's own reach, and off the floor.
  expect(rig.hand.at[0]).toBeGreaterThan(width / 2)
  expect(rig.hand.at[0] + rig.hand.size[0] / 2).toBeLessThan(height / 2)
  expect(rig.hand.at[1] - rig.hand.size[1] / 2).toBeGreaterThan(0)
  // The face clears the head cube from every angle: past its half-diagonal.
  expect(rig.face.radius).toBeGreaterThan((rig.head.size[0] * Math.SQRT2) / 2 - rig.head.size[0] / 2)
  expect(rig.face.size).toBeLessThan(rig.head.size[0] * 1.2)
})

it('turns a face to the viewer whichever way its body is turned', () => {
  const radius = 2
  // Body and viewer aligned: the face sits straight out in front.
  expect(facePlacement(0, 0, radius)).toMatchObject({ yaw: 0 })
  expect(facePlacement(0, 0, radius).z).toBeCloseTo(radius)
  expect(facePlacement(0, 0, radius).x).toBeCloseTo(0)
  // Body turned a quarter away: the face turns the same quarter back, onto the body's own side.
  const aside = facePlacement(Math.PI / 2, 0, radius)
  expect(aside.yaw).toBeCloseTo(-Math.PI / 2)
  expect(aside.x).toBeCloseTo(-radius)
  expect(aside.z).toBeCloseTo(0)
  // However it is turned, the face stays exactly its radius from the head's middle.
  for (const [body, viewer] of [[1, 2], [-3, 0.5], [0.2, -2.7]]) {
    const { x, z } = facePlacement(body, viewer, radius)
    expect(Math.hypot(x, z)).toBeCloseTo(radius)
  }
})

it('swings the hands on the distance walked, and stills them at rest', () => {
  const height = 1
  // Standing still: a drift and nothing more, and the two hands mirror each other.
  const still = handSwing(0, 0, 1414, height)
  expect(still.left.z).toBeCloseTo(-still.right.z)
  expect(Math.abs(still.left.z)).toBeGreaterThan(0)
  expect(Math.abs(still.left.z)).toBeLessThan(height * 0.01)
  expect(still.left.y).toBeCloseTo(0)

  // Walking: a quarter stride in, one hand is forward and the other back.
  const walking = handSwing(height * 0.45 / 2, height, 0, height)
  expect(walking.left.z).toBeGreaterThan(height * 0.05)
  expect(walking.right.z).toBeLessThan(-height * 0.05)
  expect(walking.left.y).toBeGreaterThan(0)

  // The swing repeats: two strides on is the same place in the swing.
  const again = handSwing(height * 0.45 / 2 + height * 1.8, height, 0, height)
  expect(again.left.z).toBeCloseTo(walking.left.z)

  // A faster walk does not reach further than a full swing.
  expect(Math.abs(handSwing(height * 0.45 / 2, height * 50, 0, height).left.z)).toBeCloseTo(Math.abs(walking.left.z))
})

it('measures the room across its widest floor span', () => {
  expect(sceneExtent(scene)).toBeCloseTo(14.059, 2)
})

it("takes the taped spot from one of the scan's own cameras", () => {
  const anchor = anchorAt(made([camera([1, 1.5, 2], [1, 1.5, 5])]), 0)
  expect(anchor).toMatchObject({ x: 1, z: 2 })
  // Facing along +z is a yaw of zero; the camera above looks that way.
  expect(anchor.yaw).toBeCloseTo(0)
  expect(anchorAt(made([camera([0, 1.5, 0], [3, 1.5, 0])]), 0).yaw).toBeCloseTo(Math.PI / 2)
  // An index outside the list is pulled back to one that exists.
  expect(anchorAt(scene, 999)).toEqual(anchorAt(scene, scene.cameras.length - 1))
  expect(anchorAt(scene, -3)).toEqual(anchorAt(scene, 0))
})

it("turns a phone's own metres into a place in the scan", () => {
  const flat = made([camera([0, 1.5, 0]), camera([2, 1.5, 2])], [[-5, 0, -5], [5, 3, 5]])
  const anchor = { x: 1, z: 2, yaw: 0, floor: 0 }
  // Standing still on the spot is the spot itself, with both feet on the floor.
  expect(toScanPose({ x: 0, y: 0, z: 0, yaw: 0 }, anchor, flat)).toEqual({ x: 1, y: 0, z: 2, yaw: 0 })
  // Two metres forward, facing the same way as the anchor, is two units along +z.
  expect(toScanPose({ x: 0, y: 0, z: 2, yaw: 0 }, anchor, flat)).toMatchObject({ x: 1, z: 4 })
  // Lined up facing +x instead: the same two metres forward now goes along +x.
  const turned = toScanPose({ x: 0, y: 0, z: 2, yaw: 0 }, { ...anchor, yaw: Math.PI / 2 }, flat)
  expect([turned.x, turned.z]).toEqual([expect.closeTo(3), expect.closeTo(2)])
  expect(turned.yaw).toBeCloseTo(Math.PI / 2)
  // Height follows the same scale, from the floor up.
  expect(toScanPose({ x: 0, y: 1.5, z: 0, yaw: 0 }, anchor, flat).y).toBeCloseTo(1.5)
})

it('turns a figure to face the viewer, wherever the viewer is', () => {
  expect(billboardYaw({ x: 0, z: 0 }, { x: 0, z: 5 })).toBeCloseTo(0)
  expect(billboardYaw({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(Math.PI / 2)
  // Directly above, where there is no direction to face, is answered rather than left undefined.
  expect(billboardYaw({ x: 0, z: 0 }, { x: 0, z: 0 })).toBe(0)
})
