import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** ROAM's room fills the screen under the bar, as on the iteration 4 board, instead of sitting in the page's frame. */
export function Screen({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('fixed inset-x-0 top-14 bottom-0 z-30 overflow-auto bg-roam-cream font-roam text-roam-ink', className)}>
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

/** A card on the cream: the board's big rounded box with a periwinkle edge. */
export const card = 'grid justify-items-start gap-4 rounded-[36px] border-2 border-roam-peri bg-roam-cream p-9 text-roam-ink shadow-none'
/** The board's loud red title. */
export const title = 'font-roam text-[44px]/[1.05] font-black tracking-[-0.02em] text-roam-red lowercase'

// Where each yellow cloud of dots sits, in the cover's halftone style.
const CLOUDS = ['left-[8%] top-[22%] h-28 w-80', 'left-[52%] top-[14%] h-24 w-64', 'left-[30%] top-[58%] h-32 w-[26rem]',
  'left-[68%] top-[62%] h-24 w-72', 'left-[2%] top-[70%] h-20 w-56']

/** The cover's yellow halftone clouds, behind a screen with no room to show yet. */
export function Halftone() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    {CLOUDS.map((place) => <span key={place} className={cn('absolute rounded-[50%] bg-[radial-gradient(circle,var(--color-roam-yellow)_2.6px,transparent_3.2px)] bg-size-[9px_9px]', place)} />)}
  </div>
}
