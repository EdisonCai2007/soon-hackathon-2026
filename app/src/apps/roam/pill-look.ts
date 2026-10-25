import { cn } from '@/lib/utils'

// The visuals board's buttons: a rounded pill with a periwinkle edge, and pills joined by a pinched neck.
export type Size = 'big' | 'small' | 'chip'
export const HEIGHT: Record<Size, number> = { big: 48, small: 36, chip: 32 }
export const STROKE = 2
export const gapFor = (height: number) => Math.round(height * 0.19)

const LOOK = {
  quiet: 'bg-roam-cream text-roam-peri hover:bg-roam-mist hover:text-roam-peri',
  loud: 'bg-roam-peri text-roam-cream hover:bg-roam-peri/90 hover:text-roam-cream',
}
export type Look = keyof typeof LOOK
const SIZE: Record<Size, string> = {
  big: 'h-12 px-6 text-2xl',
  small: 'h-9 px-4 text-lg',
  chip: 'h-8 px-3.5 text-[15px]',
}
const EDGE = 'rounded-full border-2 border-roam-peri font-roam-label font-normal lowercase tracking-[-0.07em] shadow-none'

/** The pill a ROAM control is drawn as, on any element. */
export const pill = (look: Look = 'quiet', size: Size = 'big') => cn(EDGE, LOOK[look], SIZE[size])

/** A round pill holding one icon, the size of a pill of the same size. */
export const bubble = (look: Look = 'quiet', size: Size = 'big') =>
  cn(EDGE, LOOK[look], 'inline-grid shrink-0 place-items-center p-0', { big: 'size-12', small: 'size-9', chip: 'size-8' }[size])

const r2 = (value: number) => Math.round(value * 100) / 100
const point = ([x, y]: number[]) => `${r2(x)} ${r2(y)}`

/** The neck between two round ends `height` tall and `gap` apart, drawn from the left end's centre. */
export function neckPaths(height: number, gap: number) {
  const r = height / 2
  const [mid, inner] = [r - STROKE / 2, r - STROKE]
  const angle = (38 * Math.PI) / 180
  const [sin, cos] = [Math.sin(angle), Math.cos(angle)]
  const right = 2 * r + gap
  const reach = (mid * sin - 0.14 * height) / (0.75 * cos)
  const top = [[mid * cos, r - mid * sin], [mid * cos + reach * sin, r - mid * sin + reach * cos],
    [right - mid * cos - reach * sin, r - mid * sin + reach * cos], [right - mid * cos, r - mid * sin]]
  const bottom = top.map(([x, y]) => [x, height - y])
  const curve = (p: number[][]) => `M ${point(p[0])} C ${point(p[1])} ${point(p[2])} ${point(p[3])}`
  const at = (cx: number, turn: number) => [cx + inner * Math.cos(turn), r + inner * Math.sin(turn)]
  // A round end's inner edge, so the fill hides the two edges where the neck joins them.
  const arc = (cx: number, from: number, to: number) => {
    const k = (4 / 3) * Math.tan((to - from) / 4) * inner
    const [a, b] = [at(cx, from), at(cx, to)]
    return `L ${point(a)} C ${point([a[0] - k * Math.sin(from), a[1] + k * Math.cos(from)])} `
      + `${point([b[0] + k * Math.sin(to), b[1] - k * Math.cos(to)])} ${point(b)}`
  }
  const back = [...bottom].reverse()
  const fill = `${curve(top)} ${arc(right, Math.PI + angle, Math.PI - angle)} L ${point(back[0])} `
    + `C ${point(back[1])} ${point(back[2])} ${point(back[3])} ${arc(0, angle, -angle)} Z`
  return { fill, edge: `${curve(top)} ${curve(bottom)}`, width: right }
}

