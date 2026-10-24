import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** The one screen before the room: who you are, then live. The camera is asked for on the way in. */
export function Join({ onJoin, cameraOffer }: { onJoin: (name: string) => void; cameraOffer?: string }) {
  const [name, setName] = useState('')
  return <Card className="grid max-w-xl justify-items-start gap-4 p-6">
    <h1>Join the room</h1>
    <div className="grid w-full gap-2">
      <Label htmlFor="roam-name">Your name</Label>
      <Input id="roam-name" value={name} onChange={(event) => setName(event.target.value)}
        placeholder="What the others see" autoComplete="name" />
    </div>
    <p className="text-sm text-muted-foreground">
      Your camera and voice go straight to the others in the room. Nothing is recorded.
    </p>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={() => onJoin(name)}>Go live</Button>
      {cameraOffer && <a className="text-sm underline" href={cameraOffer}>I’m in the room itself</a>}
    </div>
  </Card>
}
