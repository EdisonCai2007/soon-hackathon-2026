// The cover's yellow screentone, alive: dots sit on a fixed grid, and a slowly folding field decides how big each one
// is, so the clouds swell, split, merge and drift instead of sliding past as stamped shapes.

/** Dot spacing, in CSS pixels. */
export const PITCH = 9
// How big a cloud is, in CSS pixels, and how fast the field folds and drifts, per second.
const SPAN = 150
const FOLD = 0.3
const DRIFT = 0.05
// Where a cloud starts, and how far past that its dots reach full size.
const EDGE = 0.7
const RAMP = 0.12
// Screentone comes in a few dot sizes, not a smooth blend: that is what keeps it pixelated.
const SIZES = [1.2, 2, 2.8]

/** The field at a point, from 0 to 1: a wave bent by two other waves, so its crests curl and pinch as time runs. */
export function density(x: number, y: number, seconds: number): number {
  const u = x / SPAN - seconds * DRIFT
  // Rows count double, so the clouds lie flat and wide, as on the cover.
  const v = (y * 2) / SPAN
  const t = seconds * FOLD
  const curl = Math.sin(u * 1.1 + 0.9 * Math.sin(v * 1.7 - t)) * Math.sin(v * 1.3 + 0.8 * Math.sin(u * 1.5 + t * 0.8))
  const swell = 0.5 * Math.sin((u + v) * 0.7 + t * 0.6)
  return (curl + swell + 1.5) / 3
}

/** The dot drawn at a point, as a radius in CSS pixels: none outside a cloud, larger towards its middle. */
export function dotRadius(x: number, y: number, seconds: number): number {
  const over = density(x, y, seconds) - EDGE
  if (over <= 0) return 0
  return SIZES[Math.min(SIZES.length - 1, Math.floor((over / RAMP) * SIZES.length))]
}

type Pen = Pick<CanvasRenderingContext2D, 'clearRect' | 'beginPath' | 'moveTo' | 'arc' | 'fill'>

/** Every dot of the screentone at this moment, over a `width` by `height` area, filled in one pass. */
export function drawHalftone(pen: Pen, width: number, height: number, seconds: number) {
  pen.clearRect(0, 0, width, height)
  pen.beginPath()
  for (let y = PITCH / 2; y < height; y += PITCH) {
    for (let x = PITCH / 2; x < width; x += PITCH) {
      const radius = dotRadius(x, y, seconds)
      if (radius === 0) continue
      pen.moveTo(x + radius, y)
      pen.arc(x, y, radius, 0, Math.PI * 2)
    }
  }
  pen.fill()
}
