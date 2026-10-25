import { expect, it } from 'vitest'
import { DEAD_PX, pushFrom, REACH_PX, STILL } from './thumb-pad'

const middle = { x: 100, y: 100 }

it('holds still inside the dead zone', () => {
  expect(pushFrom(middle, middle)).toEqual(STILL)
  expect(pushFrom(middle, { x: 100 + DEAD_PX, y: 100 })).toEqual(STILL)
})

it('walks the way the thumb pulls', () => {
  const up = pushFrom(middle, { x: 100, y: 100 - REACH_PX })
  expect(up.forward).toBeCloseTo(1, 6)
  expect(up.side).toBeCloseTo(0, 6)
  const down = pushFrom(middle, { x: 100, y: 100 + REACH_PX })
  expect(down.forward).toBeCloseTo(-1, 6)
  expect(pushFrom(middle, { x: 100 + REACH_PX, y: 100 }).side).toBeCloseTo(1, 6)
  expect(pushFrom(middle, { x: 100 - REACH_PX, y: 100 }).side).toBeCloseTo(-1, 6)
})

it('grows from the dead zone to the pad’s reach and no further', () => {
  const half = pushFrom(middle, { x: 100, y: 100 - (REACH_PX + DEAD_PX) / 2 })
  expect(half.forward).toBeCloseTo(0.5, 2)
  const far = pushFrom(middle, { x: 100, y: 100 - REACH_PX * 4 })
  expect(far.forward).toBeCloseTo(1, 6)
})

it('keeps one strength across a diagonal, and survives a pad with no reach', () => {
  const corner = pushFrom(middle, { x: 100 + REACH_PX, y: 100 - REACH_PX })
  expect(Math.hypot(corner.forward, corner.side)).toBeCloseTo(1, 6)
  expect(corner.forward).toBeCloseTo(corner.side, 6)
  expect(pushFrom(middle, { x: 100 + DEAD_PX + 1, y: 100 }, 0).side).toBeCloseTo(1, 6)
})
