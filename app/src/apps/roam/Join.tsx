import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pill } from './Pill'
import { Centered, Halftone, title } from './Screen'
import { Wordmark } from './Wordmark'

/** The one screen before the room: who you are, then live. The camera is asked for on the way in. */
export function Join({ onJoin, cameraOffer }: { onJoin: (name: string) => void; cameraOffer?: string }) {
  const [name, setName] = useState('')
  return <Centered behind={<Halftone />}>
      <Wordmark className="h-10" />
      <h1 className={title}>Join the room</h1>
      <div className="grid w-full gap-2">
        <Label htmlFor="roam-name" className="text-[13px] tracking-[0.06em] text-roam-peri uppercase">Your name</Label>
        <Input id="roam-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="What the others see" autoComplete="name"
          className="h-12 rounded-full border-2 border-roam-peri bg-roam-cream px-5 text-[17px] text-roam-ink shadow-none placeholder:text-roam-ink/50 md:text-[17px]" />
      </div>
      <p className="text-[17px]">Your camera and voice go straight to the others in the room. Nothing is recorded.</p>
      <div className="flex flex-wrap items-center gap-4">
        <Pill type="button" look="loud" onClick={() => onJoin(name)}>Go live</Pill>
        {cameraOffer && <a className="font-roam-label text-lg tracking-[-0.07em] text-roam-peri lowercase" href={cameraOffer}>I’m in the room itself</a>}
      </div>
  </Centered>
}
