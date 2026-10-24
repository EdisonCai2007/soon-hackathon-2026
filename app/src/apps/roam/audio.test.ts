import { Quaternion, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { gainFor, listenerFrom, rangeFor, soundOff } from './audio'

const range = { ref: 2, max: 10 }
const looking = (at: [number, number, number]) => {
  const camera = new Vector3(0, 0, 0)
  const matrix = new Vector3(...at).sub(camera)
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), matrix.normalize())
  return listenerFrom(new Vector3(1, 2, 3), quaternion)
}

it('is at full volume up close and fainter the further away, never silent', () => {
  expect(gainFor(0, range)).toBe(1)
  expect(gainFor(range.ref, range)).toBe(1)
  const middle = gainFor(5, range)
  expect(middle).toBeLessThan(1)
  expect(middle).toBeGreaterThan(0)
  const far = gainFor(range.max, range)
  expect(far).toBeLessThan(middle)
  expect(far).toBeGreaterThan(0)
  // Past the far side it stops falling: a voice across the room stays audible.
  expect(gainFor(1000, range)).toBe(far)
})

it('never grows with distance', () => {
  const steps = [...Array(40).keys()].map((step) => gainFor(step * 0.5, range))
  expect(steps.every((gain, at) => at === 0 || gain <= steps[at - 1])).toBe(true)
})

it('takes its distances from the scan, so the curve follows the room', () => {
  const scene = { bounds: [[-2, -1, -3], [2, 1, 3]], cameras: [{ eye: [0, 0.5, 0] }] }
  const found = rangeFor(scene as never)
  expect(found.ref).toBeGreaterThan(0)
  expect(found.max).toBeCloseTo(6)
})

it('puts the ears where the viewer is, facing where they look', () => {
  const ahead = looking([0, 0, -1])
  expect(ahead.position).toEqual([1, 2, 3])
  expect(ahead.forward[2]).toBeCloseTo(-1)
  expect(ahead.up[1]).toBeCloseTo(1)
  expect(looking([1, 0, 0]).forward[0]).toBeCloseTo(1)
  expect(looking([-1, 0, 0]).forward[0]).toBeCloseTo(-1)
  // Straight down: looking at the floor leaves the ears level with the world, not upside down.
  const down = looking([0, -1, 0])
  expect(down.forward[1]).toBeCloseTo(-1)
  expect(down.up[2]).toBeCloseTo(-1)
})

it('says sound is off until the browser lets it run', () => {
  expect([soundOff('blocked'), soundOff('running')]).toEqual([true, false])
})
