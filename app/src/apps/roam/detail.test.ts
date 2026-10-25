import { expect, it, vi } from 'vitest'
import { FLOOR_FPS, PATIENCE_MS, STEPS, WARM_MS, watchDetail } from './detail'

// Frames at a steady rate, from a starting time, so a test says "ten seconds at 5 fps" and nothing else.
const run = (watch: { frame: (time: number) => void }, from: number, seconds: number, fps: number) => {
  const gap = 1000 / fps
  let time = from
  for (let drawn = 0; drawn < Math.round(seconds * fps); drawn += 1) {
    time += gap
    watch.frame(time)
  }
  return time
}

it('gives up a step when the floor cannot be held, once the first moments are past', () => {
  const step = vi.fn()
  const watch = watchDetail(step)
  // The warm-up is the upload and the first sort, and it is slow: nothing is given up for it.
  const warm = run(watch, 0, WARM_MS / 1000, 4)
  expect(step).not.toHaveBeenCalled()
  run(watch, warm, PATIENCE_MS / 1000 + 1, 4)
  expect(step).toHaveBeenCalledTimes(1)
  expect(step).toHaveBeenLastCalledWith(STEPS[1], 1)
})

it('holds its setting while the rate is good, however long it runs', () => {
  const step = vi.fn()
  const watch = watchDetail(step)
  run(watch, 0, 30, FLOOR_FPS + 6)
  expect(step).not.toHaveBeenCalled()
})

it('forgives a dip, counting only time spent under the floor', () => {
  const step = vi.fn()
  const watch = watchDetail(step)
  let time = run(watch, 0, WARM_MS / 1000 + 1, 60)
  // A second under, then a good second, then a second under again: never two together, so nothing changes.
  for (let round = 0; round < 3; round += 1) {
    time = run(watch, time, 1.2, 4)
    time = run(watch, time, 1.2, 60)
  }
  expect(step).not.toHaveBeenCalled()
})

it('walks down to the softest setting and stops there, never climbing back', () => {
  const step = vi.fn()
  const watch = watchDetail(step)
  run(watch, 0, 120, 4)
  expect(step.mock.calls.map(([detail]) => detail.name)).toEqual(STEPS.slice(1).map((one) => one.name))
  step.mockClear()
  run(watch, 1e6, 60, 120)
  expect(step).not.toHaveBeenCalled()
})
