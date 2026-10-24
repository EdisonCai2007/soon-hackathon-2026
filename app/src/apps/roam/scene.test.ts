import { expect, it } from 'vitest'
import { overviewPose, parseScene, presetPose, topPose } from './scene'

const camera = { name: 'View 1', eye: [0, 1, 2], target: [0, 1, 0], up: [0, 1, 0] }
const valid = {
  splats: 10,
  views: 1,
  bounds: [[-1, 0, -2], [3, 2, 2]],
  rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  translation: [0, 0, 0],
  cameras: [camera],
}

it('accepts the scan description', () => {
  expect(parseScene(valid).cameras).toHaveLength(1)
})

it.each([
  ['null', null],
  ['no cameras', { ...valid, cameras: [] }],
  ['a camera with no name', { ...valid, cameras: [{ ...camera, name: 1 }] }],
  ['a camera that is not an object', { ...valid, cameras: [null] }],
  ['a vector with a NaN', { ...valid, translation: [0, 0, Number.NaN] }],
  ['one bound', { ...valid, bounds: [[0, 0, 0]] }],
  ['a short rotation', { ...valid, rotation: [[1, 0, 0]] }],
])('rejects %s', (_label, json) => {
  expect(() => parseScene(json)).toThrow('not valid')
})

it('uses a preset’s fitted field of view, else 55 degrees', () => {
  expect(presetPose({ ...camera, fov_y: 64 } as never).fov).toBe(64)
  expect(presetPose(camera as never)).toMatchObject({ fov: 55, eye: [0, 1, 2] })
})

it('looks at the middle of the room from a corner and from above', () => {
  const scene = parseScene(valid)
  expect(overviewPose(scene)).toMatchObject({ target: [1, 1, 0], up: [0, 1, 0] })
  expect(overviewPose(scene).eye[1]).toBeGreaterThan(1)
  expect(topPose(scene)).toMatchObject({ target: [1, 1, 0], up: [0, 0, -1] })
  expect(topPose(scene).eye[1]).toBeCloseTo(1 + 4 * 1.6)
})
