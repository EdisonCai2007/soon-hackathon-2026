import type { ReactNode } from 'react'
import { Loading } from '@/components/Loading'
import { cn } from '@/lib/utils'
import { card, Centered, Halftone, Screen, title } from './Screen'

/** What both phone screens show while they find out what this phone can do. */
export const Checking = () =>
  <Screen className="grid place-items-center p-6">
    <Loading label="Looking at what this phone can do…" className="contents">
      <Halftone />
      <p className={cn(card, 'relative text-2xl font-bold')}>Looking at what this phone can do…</p>
    </Loading>
  </Screen>

/** A phone that cannot follow itself through the room: what it is for, said plainly, and the way out. */
export const CannotFollow = ({ title: name, children }: { title: string; children: ReactNode }) =>
  <Centered className="max-w-md text-[17px]">
    <h1 className={title}>{name}</h1>
    {children}
  </Centered>
