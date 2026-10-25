import type { ReactNode } from 'react'
import { Loading } from '@/components/Loading'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** What both phone screens show while they find out what this phone can do. */
export const Checking = () =>
  <Loading label="Looking at what this phone can do…" className="grid gap-4"><Skeleton className="h-40 rounded-xl" /></Loading>

/** A phone that cannot follow itself through the room: what it is for, said plainly, and the way out. */
export const CannotFollow = ({ title, children }: { title: string; children: ReactNode }) =>
  <Card className="grid justify-items-start gap-4 p-6">
    <h1>{title}</h1>
    {children}
  </Card>
