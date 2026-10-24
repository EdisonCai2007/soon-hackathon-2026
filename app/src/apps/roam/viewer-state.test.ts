import { expect, it } from 'vitest'
import { poseFor, type Scene } from './scene'
import { initialViewer, viewerReducer, type ViewerState } from './viewer-state'

const scene: Scene = {
  splats: 10,
  views: 2,
  bounds: [[-1, -1, -1], [1, 1, 1]],
  cutHeight: 0,
  rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  translation: [0, 0, 0],
  cameras: [
    { name: 'A', eye: [0, 0, 0], target: [0, 0, -1], up: [0, 1, 0] },
    { name: 'B', eye: [1, 0, 0], target: [1, 0, -1], up: [0, 1, 0] },
  ],
}
const ready = viewerReducer(initialViewer, { type: 'ready', scene })

it('starts loading, then shows progress while it loads', () => {
  expect(initialViewer).toEqual({ status: 'loading', progress: null })
  expect(viewerReducer(initialViewer, { type: 'progress', progress: 0.5 })).toEqual({ status: 'loading', progress: 0.5 })
})

it('opens at Room view once the scan is in', () => {
  expect(ready).toEqual({ status: 'ready', scene, camera: 0, pose: poseFor(scene, 'room') })
  expect(viewerReducer(ready, { type: 'progress', progress: 1 })).toBe(ready)
})

it('jumps to a source camera, a preset, and back to Room view, each time with a new pose', () => {
  const second = viewerReducer(ready, { type: 'go', view: 1 }) as Extract<ViewerState, { status: 'ready' }>
  expect(second.camera).toBe(1)
  expect(second.pose).toEqual(poseFor(scene, 1))
  const top = viewerReducer(second, { type: 'go', view: 'top' }) as typeof second
  expect(top.camera).toBe(1)
  expect(top.pose).toEqual(poseFor(scene, 'top'))
  const room = viewerReducer(top, { type: 'go', view: 'room' }) as typeof second
  expect(room.camera).toBe(0)
  const again = viewerReducer(room, { type: 'go', view: 'room' }) as typeof second
  expect(again.pose).not.toBe(room.pose)
  expect(viewerReducer(initialViewer, { type: 'go', view: 'top' })).toBe(initialViewer)
})

it('stops on an error or a browser without 3D, and tries again from the start', () => {
  const failed = viewerReducer(ready, { type: 'error', message: 'The room didn’t load.' })
  expect(failed).toEqual({ status: 'error', message: 'The room didn’t load.' })
  expect(viewerReducer(failed, { type: 'progress', progress: 1 })).toBe(failed)
  expect(viewerReducer(initialViewer, { type: 'no-webgl' })).toEqual({ status: 'no-webgl' })
  expect(viewerReducer(failed, { type: 'retry' })).toEqual(initialViewer)
})
