import { MapPin, Video } from 'lucide-react'
import { useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { Chip, Pill } from './Pill'
import { pill } from './pill-look'
import type { Pose, Scene } from './scene'

// A count that opens the file it was read from: the views are the scene's cameras, the splats the scan itself.
const DATA_LINK = 'underline underline-offset-2 hover:text-roam-red'

/** How many filmed views and splats the scan holds, each linked to its file. */
export function Counts({ app, scene }: { app: string; scene: Scene }) {
  return <Chip icon={<Video className="size-4" />}>
    <a className={DATA_LINK} href={`/apps/${app}/scene.json`} target="_blank" rel="noreferrer">{scene.views} video views</a>
    <span className="mx-1">·</span>
    <a className={DATA_LINK} href={`/apps/${app}/room.spz`} download>{scene.splats.toLocaleString('en-US')} splats</a>
  </Chip>
}

/** A jump to any filmed camera, by name. */
function Cameras({ scene, camera, go }: { scene: Scene | null; camera: number | null; go: (camera: number) => void }) {
  return <div className={cn(pill('quiet', 'chip'), 'inline-flex items-center gap-1 pr-1 normal-case', !scene && 'opacity-40')}>
    <Label htmlFor="roam-camera" className="font-roam-label text-[15px] font-normal text-roam-red lowercase">Camera</Label>
    <NativeSelect id="roam-camera" className="h-7 border-0 bg-transparent font-roam text-[15px] text-roam-ink shadow-none dark:bg-transparent" disabled={!scene}
      value={camera ?? ''} onChange={(event) => go(Number(event.target.value))}>
      {scene?.cameras.map((one, index) => <NativeSelectOption key={one.name} value={index}>{one.name}</NativeSelectOption>)}
    </NativeSelect>
  </div>
}

// Rounding -0.0001 must read 0.000, not -0.000.
const fixed = (value: number, places: number) => (Object.is(Math.round(value * 10 ** places), -0) ? 0 : value).toFixed(places)

/** Where the camera is and faces, in the scan's own coordinates: one line to paste into a chat. */
function whereText({ position, target }: Pose): string {
  const facing = target.map((value, axis) => value - position[axis])
  return `x ${fixed(position[0], 3)} y ${fixed(position[1], 3)} z ${fixed(position[2], 3)} facing ${facing.map((value) => fixed(value, 2)).join(' ')}`
}

/** The camera's place as text, with a button that copies it. */
function Where({ where }: { where: Pose | null }) {
  // Copied until the person moves: the line then reads somewhere else.
  const [copied, setCopied] = useState<string | null>(null)
  const line = useRef<HTMLElement>(null)
  if (!where) return null
  const text = whereText(where)
  // Some embedded browsers refuse the clipboard API; selecting the line and copying it the old way still works there.
  const byHand = () => {
    const range = document.createRange()
    range.selectNodeContents(line.current!)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(range)
    setCopied(document.execCommand('copy') ? text : null)
  }
  const copy = () => void (navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('no clipboard'))).then(() => setCopied(text), byHand)
  return <div className="flex flex-wrap items-center gap-1.5">
    <Chip icon={<MapPin className="size-4" />}>
      <span className="mr-1.5">You are at</span>
      <code ref={line} className="select-all font-roam tabular-nums" aria-label="Camera position">{text}</code>
    </Chip>
    <Pill type="button" size="small" onClick={copy}>{copied === text ? 'Copied' : 'Copy'}</Pill>
  </div>
}

/** The placing tools at the room's foot: where the camera is, and a jump to any filmed camera. */
export function Placing({ ready, where, go }: { ready: { scene: Scene; camera: number } | null; where: Pose | null; go: (camera: number) => void }) {
  return <div className="grid justify-items-start gap-2.5">
    <Where where={ready && where} />
    <Cameras scene={ready?.scene ?? null} camera={ready?.camera ?? null} go={go} />
  </div>
}
