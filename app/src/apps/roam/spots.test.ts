/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { anchorAt } from './placement'
import { parseScene, type Scene } from './scene'
import { floorOf, markedSpots, SPOTS } from './spots'

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))

it('offers a few spots the scan itself knows, each with its own place and facing', () => {
  const spots = markedSpots(scene)
  expect(spots).toHaveLength(SPOTS.length)
  expect(spots.map((spot) => spot.name)).toEqual(SPOTS.map((spot) => spot.name))
  expect(spots[0].anchor).toEqual(anchorAt(scene, SPOTS[0].camera))
  // No two spots stand on the same camera, or two taped crosses would mean one place.
  expect(new Set(spots.map((spot) => spot.camera)).size).toBe(spots.length)
})

it('leaves out a spot this scan has no camera for, rather than sliding it to the nearest one', () => {
  const small: Scene = { ...scene, cameras: scene.cameras.slice(0, 1) }
  const spots = markedSpots(small)
  expect(spots).toHaveLength(1)
  expect(spots[0].camera).toBe(0)
})

it('says which floor a spot is on, counted from the bottom', () => {
  const spots = markedSpots(scene)
  const floors = spots.map((spot) => floorOf(scene, spot))
  // Both floors of the home are covered, and the stairs are taped at each end.
  expect(new Set(floors)).toEqual(new Set([1, 2]))
  expect(Math.min(...floors)).toBe(1)
})

it('counts one floor where a scan lists none', () => {
  const flat: Scene = { ...scene, floors: undefined }
  const spots = markedSpots(flat)
  expect(floorOf(flat, spots[0])).toBe(1)
})
