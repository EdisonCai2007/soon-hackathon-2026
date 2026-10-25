import { expect, it, vi } from 'vitest'
import { density, dotRadius, drawHalftone, PITCH } from './halftone'

// A screen's worth of grid points, to read the field over.
const grid = (seconds: number) => {
  const points: number[] = []
  for (let y = PITCH / 2; y < 1080; y += PITCH) for (let x = PITCH / 2; x < 1920; x += PITCH) points.push(dotRadius(x, y, seconds))
  return points
}

it('keeps the field between 0 and 1', () => {
  for (const seconds of [0, 7.5, 60]) {
    for (const value of [0, 333, 1500].flatMap((x) => [0, 250, 900].map((y) => density(x, y, seconds)))) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  }
})

it('draws clouds over a part of the screen, in a few dot sizes, smaller at their edges', () => {
  const radii = grid(0)
  const drawn = radii.filter((radius) => radius > 0)
  expect(drawn.length / radii.length).toBeGreaterThan(0.1)
  expect(drawn.length / radii.length).toBeLessThan(0.3)
  expect(new Set(drawn)).toEqual(new Set([1.2, 2, 2.8]))
})

it('reshapes the clouds as time runs, not only moving them', () => {
  const [before, after] = [grid(0), grid(20)]
  const changed = before.filter((radius, index) => radius !== after[index]).length
  expect(changed).toBeGreaterThan(before.length * 0.1)
  expect(after.filter((radius) => radius > 0).length).not.toBe(before.filter((radius) => radius > 0).length)
})

it('fills every dot in one pass over a cleared area', () => {
  const pen = { clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), arc: vi.fn(), fill: vi.fn() }
  drawHalftone(pen, 400, 300, 0)
  const dots = pen.arc.mock.calls.length
  expect(pen.clearRect).toHaveBeenCalledWith(0, 0, 400, 300)
  expect(pen.beginPath).toHaveBeenCalledOnce()
  expect(pen.fill).toHaveBeenCalledOnce()
  expect(dots).toBeGreaterThan(0)
  expect(pen.moveTo).toHaveBeenCalledTimes(dots)
  const [x, y, radius] = pen.arc.mock.calls[0]
  expect(radius).toBe(dotRadius(x, y, 0))
  expect(pen.moveTo.mock.calls[0]).toEqual([x + radius, y])
})
