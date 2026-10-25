/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { Group, PerspectiveCamera, Vector3 } from 'three'
import { placingFor, sessionSpot } from './ar-place'
import { anchorAt, fromOrigin, toScanPose, unitsPerMetre } from './placement'
import { parseScene } from './scene'

const details: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8'))
const scene = parseScene(details)
const anchor = anchorAt(scene, 0)
const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 6)

it('puts the anchor at the session’s origin, standing on its own floor', () => {
  const placing = placingFor(anchor, scene)
  const origin = sessionSpot({ x: anchor.x, y: anchor.floor, z: anchor.z }, placing)
  near(origin.x, 0)
  near(origin.y, 0)
  near(origin.z, 0)
})

it('turns the scan so the anchor’s facing is the session’s forward', () => {
  const placing = placingFor(anchor, scene)
  const metre = unitsPerMetre(scene)
  // A metre along the way the spot faces must come out as a metre straight ahead, which is −z in the session.
  const ahead = sessionSpot({
    x: anchor.x + Math.sin(anchor.yaw) * metre,
    y: anchor.floor,
    z: anchor.z + Math.cos(anchor.yaw) * metre,
  }, placing)
  near(ahead.x, 0)
  near(ahead.z, 1)
})

it('makes one real metre one metre of scan, whichever way it is measured', () => {
  const placing = placingFor(anchor, scene)
  const metre = unitsPerMetre(scene)
  const up = sessionSpot({ x: anchor.x, y: anchor.floor + metre, z: anchor.z }, placing)
  near(up.y, 1)
  const side = sessionSpot({ x: anchor.x + metre, y: anchor.floor, z: anchor.z }, placing)
  near(Math.hypot(side.x, side.z), 1)
})

it('is the inverse of the placing a note uses, from a taped spot and from a view alike', () => {
  const walked = { x: 0.8, y: 1.5, z: -2.3, yaw: 0.6 }
  const anchors = [anchor, { x: 1.4, z: -0.7, yaw: 1.1, floor: anchor.floor }]
  for (const one of anchors) {
    const there = toScanPose(walked, one, scene)
    const back = sessionSpot(there, placingFor(one, scene))
    near(back.x, walked.x)
    near(back.y, walked.y)
    near(back.z, walked.z)
  }
})

it('maps arbitrary tracked origins back to the same rendered position and heading', () => {
  const origin = { x: 2, y: 1.7, z: -3, yaw: 0.8 }
  for (const floor of scene.floors!) {
    const start = { x: -1, floor: floor + 1.4, z: 4, yaw: -1.1 }
    const placing = placingFor(start, scene, origin)
    const outer = new Group()
    const inner = new Group()
    outer.add(inner)
    outer.position.fromArray(placing.outer)
    outer.rotation.y = placing.yaw
    outer.scale.setScalar(placing.scale)
    inner.position.fromArray(placing.inner)
    outer.updateMatrixWorld(true)
    for (const pose of [origin, { ...origin, x: 3, z: -4, y: 2, yaw: 2.4 }]) {
      const scan = toScanPose(fromOrigin(pose, origin), start, scene)
      const back = new Vector3(scan.x, scan.y, scan.z).applyMatrix4(inner.matrixWorld)
      expect(back.distanceTo(new Vector3(pose.x, pose.y, pose.z))).toBeLessThan(1e-6)
      const calculated = sessionSpot(scan, placing)
      expect(back.distanceTo(new Vector3(calculated.x, calculated.y, calculated.z))).toBeLessThan(1e-6)
      const camera = new PerspectiveCamera()
      camera.rotation.set(0, scan.yaw, 0, 'YXZ')
      const direction = camera.getWorldDirection(new Vector3()).transformDirection(inner.matrixWorld)
      camera.rotation.y = pose.yaw
      expect(direction.distanceTo(camera.getWorldDirection(new Vector3()))).toBeLessThan(1e-6)
    }
    const ahead = {
      ...origin, x: origin.x - Math.sin(origin.yaw), z: origin.z - Math.cos(origin.yaw),
    }
    const scan = toScanPose(fromOrigin(ahead, origin), start, scene)
    near(scan.x, start.x - Math.sin(start.yaw) * unitsPerMetre(scene))
    near(scan.z, start.z - Math.cos(start.yaw) * unitsPerMetre(scene))
    near(scan.y, start.floor)
  }
})
