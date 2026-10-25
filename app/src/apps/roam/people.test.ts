/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { COUCH, originFor, yawFor } from './people'
import { floorHeight, unitsPerMetre } from './placement'
import { parseScene } from './scene'

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
