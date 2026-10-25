// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Halftone } from './Screen'

type Frame = (time: number) => void
let frames: Frame[]
let pen: Record<string, ReturnType<typeof vi.fn> | string>

const motion = (reduced: boolean) => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })))
const box = (width: number, height: number) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
}
const step = (time: number) => frames.shift()!(time)

beforeEach(() => {
  frames = []
  pen = { setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillStyle: '' }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(pen as never)
  vi.stubGlobal('requestAnimationFrame', vi.fn((frame: Frame) => frames.push(frame)))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('devicePixelRatio', 2)
  box(400, 300)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('keeps the clouds moving, sized to its box at the screen’s sharpness', () => {
  motion(false)
  const { container } = render(<Halftone />)
  const canvas = container.querySelector('canvas')!
  expect(canvas.getAttribute('aria-hidden')).toBe('true')
  step(0)
  expect([canvas.width, canvas.height]).toEqual([800, 600])
  expect(pen.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
  expect(pen.fill).toHaveBeenCalledTimes(1)
  expect(frames).toHaveLength(1)

  // A box that has not changed is not resized, which would wipe it; one that has, is.
  const resized = vi.spyOn(canvas, 'width', 'set')
  step(16)
  expect(resized).not.toHaveBeenCalled()
  box(500, 300)
  step(32)
  expect(resized).toHaveBeenCalledWith(1000)
  expect(pen.fill).toHaveBeenCalledTimes(3)
})

it('draws once and holds still when the person asks for less motion', () => {
  motion(true)
  render(<Halftone />)
  step(0)
  expect(pen.fill).toHaveBeenCalledOnce()
  expect(frames).toHaveLength(0)
})

it('stops drawing once it is gone', () => {
  motion(false)
  const { unmount } = render(<Halftone />)
  step(0)
  unmount()
  expect(cancelAnimationFrame).toHaveBeenCalled()
})

it('draws nothing where the browser has no 2D canvas', () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
  render(<Halftone />)
  expect(requestAnimationFrame).not.toHaveBeenCalled()
})
