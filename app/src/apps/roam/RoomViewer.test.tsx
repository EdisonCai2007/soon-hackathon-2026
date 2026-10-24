// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ fail: false, loop: null as null | ((t: number) => void), progress: null as null | ((e: unknown) => void) }))

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    domElement = document.createElement('canvas')
    constructor() {
      if (state.fail) throw new Error('no webgl')
    }
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    render() {}
    dispose() {}
    setAnimationLoop(fn: ((t: number) => void) | null) {
      state.loop = fn
    }
    outputColorSpace = ''
  }
  return { ...three, WebGLRenderer }
})

vi.mock('@sparkjsdev/spark', async () => {
  const { Object3D } = await vi.importActual<typeof import('three')>('three')
  class SparkRenderer extends Object3D {}
  class SplatMesh extends Object3D {
    initialized = Promise.resolve()
    constructor(options: { onProgress: (e: unknown) => void }) {
      super()
      state.progress = options.onProgress
    }
  }
  return { SparkRenderer, SplatMesh }
})

import { RoomViewer } from './RoomViewer'

const camera = (name: string, z: number) => ({ name, eye: [0, 1, z], target: [0, 1, 0], up: [0, 1, 0], fov_y: 60 })
const scene = {
  splats: 1234,
  views: 2,
  bounds: [[-1, 0, -2], [3, 2, 2]],
  rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  translation: [0, 0, 0],
  cameras: [camera('Video 0s', 2), camera('Video 2s', 3)],
}

class Observer {
  callback: () => void
  constructor(callback: () => void) {
    this.callback = callback
  }
  observe() {
    this.callback()
  }
  disconnect() {}
}

beforeEach(() => {
  state.fail = false
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const open = async (answer: () => Response | Promise<Response> = () => Response.json(scene)) => {
  vi.stubGlobal('fetch', vi.fn(async () => answer()))
  await act(async () => {
    render(<RoomViewer base="/apps/roam" />)
  })
}

it('opens the room, reports progress and moves between views', async () => {
  await open()
  expect(await screen.findByText('2 video views · 1,234 splats')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
  for (const name of ['Overview', 'Top view', 'Room view']) fireEvent.click(screen.getByRole('button', { name }))
  const select = screen.getByLabelText('Source video camera')
  fireEvent.change(select, { target: { value: '1' } })
  fireEvent.change(select, { target: { value: '' } })
  await act(async () => {
    state.loop?.(0)
    state.loop?.(16)
  })
})

it('shows loading progress', async () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
  await act(async () => {
    render(<RoomViewer base="/apps/roam" />)
  })
  expect(screen.getByRole('status').textContent).toBe('Loading the room… 0%')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(scene)))
})

it('says why the scan could not open', async () => {
  await open(() => new Response('', { status: 404 }))
  expect((await screen.findByRole('status')).textContent).toContain('could not be loaded')
  cleanup()
  await open(() => Response.json({}))
  expect((await screen.findByRole('status')).textContent).toContain('not valid')
})

it('says so when the browser has no 3D', async () => {
  state.fail = true
  await open()
  expect((await screen.findByRole('status')).textContent).toContain('can’t show 3D')
})

it('ignores late results after it is closed', async () => {
  let release: (response: Response) => void = () => {}
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (release = resolve))))
  const view = render(<RoomViewer base="/apps/roam" />)
  view.unmount()
  await act(async () => {
    release(Response.json(scene))
  })
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
  const again = render(<RoomViewer base="/apps/roam" />)
  again.unmount()
})

it('follows the download percentage', async () => {
  await open()
  await screen.findByText('2 video views · 1,234 splats')
  act(() => state.progress?.({ loaded: 5, total: 0 }))
  expect(screen.queryByRole('status')).toBeNull()
  act(() => state.progress?.({ loaded: 50, total: 100 }))
  expect(screen.getByRole('status').textContent).toBe('Loading the room… 50%')
  cleanup()
  state.progress?.({ loaded: 60, total: 100 })
})
