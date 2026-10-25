import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { drawHalftone } from './halftone'

/** ROAM's room fills the whole window, over the workspace bar, instead of sitting in the page's frame. */
export function Screen({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('fixed inset-0 z-50 overflow-auto bg-roam-cream font-roam text-roam-ink', className)}>
    {children}
  </div>
}

/** A screen with nothing but one card in its middle, and whatever is drawn `behind` it. */
export function Centered({ behind, className, children }: { behind?: ReactNode; className?: string; children: ReactNode }) {
  return <Screen className="grid place-items-center p-6">
    {behind}
    <div className={cn(card, 'relative w-full max-w-xl', className)}>{children}</div>
  </Screen>
}

/** A card on the cream: the board's big rounded box with a red edge. */
export const card = 'grid justify-items-start gap-4 rounded-[36px] border-2 border-roam-red bg-roam-cream p-9 text-roam-ink shadow-none'
/** The board's loud red title. */
export const title = 'font-roam text-[44px]/[1.05] font-black tracking-[-0.02em] text-roam-red lowercase'

/** The cover's yellow halftone clouds, flowing, behind a screen with no room to show yet. With reduced motion asked
 *  for, they are drawn once and hold still. */
export function Halftone() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current!
    const pen = element.getContext('2d')
    if (!pen) return
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    // The dots take the canvas's text colour, so the yellow stays the theme's.
    const ink = getComputedStyle(element).color
    let size = ''
    let frame = 0
    const draw = (time: number) => {
      const [width, height, scale] = [element.clientWidth, element.clientHeight, devicePixelRatio]
      // Resizing clears the canvas, so it happens only when the box has changed.
      if (size !== `${width}x${height}x${scale}`) {
        size = `${width}x${height}x${scale}`
        element.width = width * scale
        element.height = height * scale
      }
      pen.setTransform(scale, 0, 0, scale, 0, 0)
      pen.fillStyle = ink
      drawHalftone(pen, width, height, time / 1000)
      if (!still) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full text-roam-yellow" />
}
