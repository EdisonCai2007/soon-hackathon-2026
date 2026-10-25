/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { anchorAt, billboardYaw, figureSize, floorHeight, fromOrigin, PHONE_HEIGHT_M, sceneExtent, standing, toScanPose, unitsPerMetre } from './placement'
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

it('measures a walk from a new starting point, keeping where it had reached', () => {
  const origin = { x: 1, y: 0, z: 1, yaw: 0 }
  // Standing still at the new origin means no movement at all.
  expect(fromOrigin(origin, origin)).toMatchObject({ x: 0, y: 0, z: 0, yaw: 0 })
  // A metre further along the way it was facing, whichever way that was.
  expect(fromOrigin({ x: 1, y: 0, z: 2, yaw: 0 }, origin)).toMatchObject({ x: 0, z: 1 })
  const turned = fromOrigin({ x: 2, y: 0.5, z: 1, yaw: Math.PI / 2 }, { ...origin, yaw: Math.PI / 2 })
  expect(turned.z).toBeCloseTo(1, 6)
  expect(turned.x).toBeCloseTo(0, 6)
  expect(turned.y).toBe(0.5)
  expect(turned.yaw).toBeCloseTo(0, 6)
})
