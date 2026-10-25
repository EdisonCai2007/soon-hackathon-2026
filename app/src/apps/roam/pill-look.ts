import { cn } from '@/lib/utils'

// The visuals board's buttons: a rounded pill with a red edge, and pills joined by a pinched neck.
export type Size = 'big' | 'small' | 'chip'
export const HEIGHT: Record<Size, number> = { big: 40, small: 32, chip: 32 }
export const STROKE = 2
export const gapFor = (height: number) => Math.round(height * 0.19)

const LOOK = {
  quiet: 'bg-roam-cream text-roam-red',
  // A loud pill's edge is its fill, so it reads as one blue shape, not a blue pill ringed in red.
  loud: 'border-roam-peri bg-roam-peri text-roam-cream',
}
export type Look = keyof typeof LOOK
// Pressable sizes fill blue with white text under the pointer; a loud pill, blue already, deepens to ink.
// A chip is only read, so it keeps its look and the plain cursor.
const PRESS: Record<Look, string> = {
  quiet: 'cursor-pointer hover:bg-roam-peri hover:text-white',
  loud: 'cursor-pointer hover:border-roam-ink hover:bg-roam-ink hover:text-white',
}
const look = (which: Look, size: Size) => cn(LOOK[which], size !== 'chip' && PRESS[which])
const SIZE: Record<Size, string> = {
  big: 'h-10 px-5 text-xl',
  small: 'h-8 px-3.5 text-base',
  chip: 'h-8 px-3.5 text-[15px]',
}
const EDGE = 'rounded-full border-2 border-roam-red font-roam-label font-normal lowercase tracking-[-0.07em] shadow-none'

/** The pill a ROAM control is drawn as, on any element. */
export const pill = (which: Look = 'quiet', size: Size = 'big') => cn(EDGE, look(which, size), SIZE[size])

/** A round pill holding one icon, the size of a pill of the same size. */
export const bubble = (which: Look = 'quiet', size: Size = 'big') =>
  cn(EDGE, look(which, size), 'inline-grid shrink-0 place-items-center p-0', { big: 'size-10', small: 'size-8', chip: 'size-8' }[size])

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

