import { expect, it } from 'vitest'
import { clamp01, dueToSend, lerpPose, lerpYaw, nextMotion, poseAt, SEND_INTERVAL_MS } from './pose-feed'

const here = { x: 0, y: 0, z: 0, yaw: 0 }
const there = { x: 10, y: 2, z: -4, yaw: 1 }

it('sends a position ten times a second, and not more often', () => {
  expect(dueToSend(null, 0)).toBe(true)
  expect(dueToSend(1000, 1000 + SEND_INTERVAL_MS)).toBe(true)
  expect(dueToSend(1000, 1000 + SEND_INTERVAL_MS - 1)).toBe(false)
})

it('keeps a share of the way between 0 and 1', () => {
  expect([clamp01(-2), clamp01(0.4), clamp01(9)]).toEqual([0, 0.4, 1])
})

it('turns the shorter way round the circle', () => {
  expect(lerpYaw(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4)
  // Just short of a full turn is a small step back, not nearly all the way round.
  expect(lerpYaw(0.1, Math.PI * 2 - 0.1, 0.5)).toBeCloseTo(0)
  expect(lerpYaw(Math.PI * 2 - 0.1, 0.1, 0.5)).toBeCloseTo(Math.PI * 2)
})

it('glides from one position to the next', () => {
  expect(lerpPose(here, there, 0)).toEqual(here)
  expect(lerpPose(here, there, 1)).toEqual(there)
  expect(lerpPose(here, there, 0.5)).toEqual({ x: 5, y: 1, z: -2, yaw: 0.5 })
})

it('starts each new glide wherever the figure had got to', () => {
  const first = nextMotion(null, here, 1000)
  expect(poseAt(first, 1000)).toEqual(here)
  // A position arriving halfway through the last glide carries on from the middle.
  const second = nextMotion(first, there, 1000 + SEND_INTERVAL_MS / 2)
  expect(second.from).toEqual(here)
  expect(poseAt(second, 1000 + SEND_INTERVAL_MS)).toEqual(lerpPose(here, there, 0.5))
  // Past the interval the figure waits at the last position it was told about.
  expect(poseAt(second, 9999)).toEqual(there)
})
