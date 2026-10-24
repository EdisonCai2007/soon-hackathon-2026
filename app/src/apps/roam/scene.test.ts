/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { applyPose, displayQuaternion, parseScene, poseFor, type Scene } from './scene'

// The real details shipped beside the scan, so a change to either file is checked against the other.
const shipped: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8'))

const box: Scene = {
  splats: 10,
  views: 2,
  bounds: [[-2, -1, -3], [2, 1, 1]],
  cutHeight: 0.5,
  rotation: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
  translation: [0, 0, 0],
  cameras: [
    { name: 'Video 0s', eye: [0, 0, 0], target: [0, 0, -1], up: [0, 1, 0], fov_y: 64 },
    { name: 'Video 2s', eye: [1, 0, 0], target: [1, 0, -1], up: [0, 1, 0] },
  ],
}

it('reads the shipped scan details', () => {
  const scene = parseScene(shipped)
  expect(scene.splats).toBe(546977)
  expect(scene.views).toBe(665)
  expect(scene.cameras).toHaveLength(665)
  expect(scene.floors).toEqual([-3.95, -1.3])
})

it('refuses details it cannot use', () => {
  expect(() => parseScene({ ...box, cameras: [] })).toThrow()
  expect(() => parseScene({ ...box, rotation: [[1, 0, 0]] })).toThrow()
  expect(() => parseScene(null)).toThrow()
})

it('turns the scan upright with the details’ rotation', () => {
  const turned = new Vector3(1, 0, 0).applyQuaternion(displayQuaternion(box))
  expect(turned.x).toBeCloseTo(0, 6)
  expect(turned.z).toBeCloseTo(-1, 6)
  const scene = parseScene(shipped)
  const [a, b, c] = scene.rotation
  const matrix = new Matrix4().set(a[0], a[1], a[2], 0, b[0], b[1], b[2], 0, c[0], c[1], c[2], 0, 0, 0, 0, 1)
  const axis = new Vector3(0, 1, 0)
  expect(axis.clone().applyQuaternion(displayQuaternion(scene)).distanceTo(axis.applyMatrix4(matrix))).toBeLessThan(1e-4)
})

it('puts Room view and each source camera at the recorded spot', () => {
  expect(poseFor(box, 'room')).toEqual({ position: [0, 0, 0], target: [0, 0, -1], up: [0, 1, 0], fov: 64 })
  expect(poseFor(box, 1)).toEqual({ position: [1, 0, 0], target: [1, 0, -1], up: [0, 1, 0], fov: 55 })
})

it('looks down on the room from above for Top view, and from a high corner for Overview', () => {
  expect(poseFor(box, 'top')).toEqual({ position: [0, 6.4, -0.999], target: [0, 0, -1], up: [0, 0, -1], fov: 55 })
  const overview = poseFor(box, 'overview')
  expect(overview.target).toEqual([0, -0.25, -1])
  overview.position.forEach((value, axis) => expect(value).toBeCloseTo([-2.72, 2.63, 2.44][axis], 6))
  expect(overview.up).toEqual([0, 1, 0])
})

it('moves a camera to a pose', () => {
  const camera = new PerspectiveCamera()
  applyPose(camera, poseFor(box, 'room'))
  expect(camera.fov).toBe(64)
  expect(camera.position.toArray()).toEqual([0, 0, 0])
  const facing = camera.getWorldDirection(new Vector3())
  expect(facing.z).toBeCloseTo(-1, 6)
})
