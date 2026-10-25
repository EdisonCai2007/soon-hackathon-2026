import { Children, type ComponentProps, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { bubble, gapFor, HEIGHT, type Look, neckPaths, pill, type Size, STROKE } from './pill-look'

type ButtonProps = Omit<ComponentProps<typeof Button>, 'size'>

/** A ROAM button: the shared button part, drawn as the board's pill. */
export function Pill({ look = 'quiet', size = 'big', className, ...props }: ButtonProps & { look?: Look; size?: Size }) {
  return <Button variant="ghost" className={cn(pill(look, size), className)} {...props} />
}

function Neck({ size, look }: { size: Size; look: Look }) {
  const height = HEIGHT[size]
  const gap = gapFor(height)
  const { fill, edge, width } = neckPaths(height, gap)
  return <span aria-hidden="true" className="relative z-10 shrink-0 self-stretch" style={{ width: gap }}>
    <svg className="absolute top-0 overflow-visible" style={{ left: -height / 2 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={fill} className={look === 'loud' ? 'fill-roam-peri' : 'fill-roam-cream'} />
      <path d={edge} className="fill-none stroke-roam-peri" strokeWidth={STROKE} />
    </svg>
  </span>
}

/** Pills joined by necks, as on the board: every part one size, and a loud neck when the parts are loud. */
export function Joined({ size = 'big', look = 'quiet', className, children }: { size?: Size; look?: Look; className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center', className)}>
    {Children.toArray(children).flatMap((part, index) => index === 0 ? [part] : [<Neck key={`neck-${index}`} size={size} look={look} />, part])}
  </span>
}

/** One button drawn as an icon in a bubble joined to its label, for an action that shows its icon. */
export function IconPill({ icon, look, children, ...props }: ButtonProps & { icon: ReactNode; look: Look }) {
  return <Button variant="ghost" className="h-auto rounded-full p-0 hover:bg-transparent" {...props}>
    <Joined look={look}>
      <span className={bubble(look)}>{icon}</span>
      <span className={cn(pill(look), 'inline-flex items-center')}>{children}</span>
    </Joined>
  </Button>
}

/** A status that is not pressed: an icon bubble joined to a short label. */
export function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <Joined size="chip">
    <span aria-hidden="true" className={bubble('quiet', 'chip')}>{icon}</span>
    <span className={cn(pill('quiet', 'chip'), 'inline-flex items-center font-roam font-medium normal-case tracking-normal text-roam-ink')}>{children}</span>
  </Joined>
}
