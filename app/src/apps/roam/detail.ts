// How much of the scan to draw. Measured, not guessed: the owner's phone runs the whole scan at 2 fps and the
// owner's laptop at 2 to 28, where another laptop holds 90, so the setting is found at runtime, not chosen here.

/** One setting of how much is drawn: how many splats, how big they may be, and how many pixels to fill. */
export type Detail = {
  name: string
  lod: boolean
  splats: number
  renderScale: number
  pixels: number
  stdDev: number
}

/** Heaviest first. Each step draws fewer splats, lets them be bigger on screen, and fills fewer pixels. */
export const STEPS: readonly Detail[] = [
  { name: 'everything', lod: false, splats: 0, renderScale: 1, pixels: 1.5, stdDev: Math.sqrt(8) },
  { name: '250k splats', lod: true, splats: 250_000, renderScale: 2, pixels: 1.25, stdDev: Math.sqrt(8) },
  { name: '120k splats', lod: true, splats: 120_000, renderScale: 3, pixels: 1, stdDev: Math.sqrt(5) },
  { name: '60k splats', lod: true, splats: 60_000, renderScale: 4, pixels: 0.6, stdDev: Math.sqrt(4) },
]

/** What a phone draws at. Measured on the owner's: this setting holds 65–80 fps, where the whole scan holds 2. */
export const PHONE_DETAIL = STEPS[STEPS.length - 1]

/** Under this many frames a second the view is not worth looking at, so detail is given up to get back over it. */
export const FLOOR_FPS = 24
/** A dip is not a problem; this long under the floor is. */
export const PATIENCE_MS = 2_000
/** The first moments of drawing are the upload and the first sort, which are slow and say nothing. */
export const WARM_MS = 2_000

export type FrameWatch = { frame: (time: number) => void }

/** Watches the frame rate and says so when the floor has not been held for long enough to matter. The laptop
 *  answers by giving up detail and the phone by giving up the drawing, so what to do about it is the caller's. */
export function watchFrames(low: (fps: number) => void, floor = FLOOR_FPS, patience = PATIENCE_MS): FrameWatch {
  let began: number | null = null
  let since = 0
  let frames = 0
  let under = 0

  return {
    frame(time) {
      if (began === null) { began = time; since = time }
      frames += 1
      if (time - since < 1_000) return
      const fps = (frames * 1_000) / (time - since)
      under = time - began >= WARM_MS && fps < floor ? under + (time - since) : 0
      frames = 0
      since = time
      if (under < patience) return
      under = 0
      low(fps)
    },
  }
}

/** Gives up detail when the floor cannot be held. It never climbs back: a view flickering between two settings
 *  is worse to look at than a softer one that holds. */
export function watchDetail(step: (detail: Detail, index: number) => void): FrameWatch {
  let index = 0
  return watchFrames(() => {
    if (index >= STEPS.length - 1) return
    index += 1
    step(STEPS[index], index)
  })
}
