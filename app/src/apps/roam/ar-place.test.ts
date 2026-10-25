/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { placingFor, sessionSpot } from './ar-place'
import { anchorAt, toScanPose, unitsPerMetre } from './placement'
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

it('is the inverse of the placing a phone’s pose uses, from a taped spot and from a view alike', () => {
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
