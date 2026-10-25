// The techniques a hand sign fires: what each is called, how long it lives, how long before another, and
// what it looks like at a moment of its life. Pure numbers: casting-stage.ts turns them into meshes.
export const TECHNIQUE_NAMES = ['domain', 'purple', 'blue'] as const
export type TechniqueName = (typeof TECHNIQUE_NAMES)[number]

export type Technique = {
  title: string
  /** The sign that fires it, in plain words, for the readout in the bar. */
  sign: string
  /** How long it is drawn, and how long after that before anything can be cast again, in milliseconds. */
  life: number
  wait: number
  color: string
}

export const TECHNIQUES: Record<TechniqueName, Technique> = {
  domain: { title: 'Domain expansion', sign: 'thumb and middle finger joined', life: 4000, wait: 2000, color: '#1b0f2e' },
  purple: { title: 'Hollow purple', sign: 'both index fingers together', life: 2600, wait: 1500, color: '#a855f7' },
  blue: { title: 'Blue', sign: 'an open palm pulled toward you', life: 1600, wait: 1200, color: '#4fb8ff' },
}

export const isTechnique = (value: unknown): value is TechniqueName =>
  typeof value === 'string' && Object.hasOwn(TECHNIQUES, value)

/** How far through its life a cast is: 0 to 1, or null once it is over. */
export function through(name: TechniqueName, started: number, now: number): number | null {
  const part = (now - started) / TECHNIQUES[name].life
  return part >= 0 && part < 1 ? part : null
}

/** What is drawn, each 0 when that part is not in this technique. Metres and opacities are the stage's. */
export type Look = {
  /** The dome's radius in metres, and how solid it is. */
  dome: number
  domeFade: number
  /** The orb's radius in metres, how far ahead of the caster it has travelled, and how solid it is. */
  orb: number
  reach: number
  orbFade: number
  /** The two points gathering before they meet: how far apart, and how solid. */
  gather: number
  gatherFade: number
  /** A brief wash over the whole view. */
  glow: number
}

const NOTHING: Look = { dome: 0, domeFade: 0, orb: 0, reach: 0, orbFade: 0, gather: 0, gatherFade: 0, glow: 0 }

// The dome sweeps out over the first half of its life and fades over the second; the flash is the moment it opens.
const domainLook = (part: number): Look => ({
  ...NOTHING,
  dome: Math.min(part * 2, 1) * 9,
  domeFade: part < 0.5 ? 0.85 : 0.85 * (1 - (part - 0.5) * 2),
  glow: part < 0.2 ? 1 - part / 0.2 : 0,
})

// Red and blue gather for the first third, then meet and cross the room.
function purpleLook(part: number): Look {
  if (part < 0.35) return { ...NOTHING, gather: 0.9 * (1 - part / 0.35) + 0.1, gatherFade: 1 }
  const gone = (part - 0.35) / 0.65
  return { ...NOTHING, orb: 0.55 - gone * 0.15, reach: gone * 7, orbFade: 1 - gone * gone }
}

// The blue draws inward: the orb shrinks toward the caster, then lets go.
const blueLook = (part: number): Look => ({
  ...NOTHING,
  orb: 1.2 * (1 - part) + 0.1,
  orbFade: part < 0.8 ? 0.9 : 0.9 * (1 - (part - 0.8) * 5),
  glow: part < 0.15 ? part / 0.15 * 0.4 : 0,
})

const LOOKS: Record<TechniqueName, (part: number) => Look> = { domain: domainLook, purple: purpleLook, blue: blueLook }

/** What this technique looks like that far through its life. */
export const lookOf = (name: TechniqueName, part: number): Look => LOOKS[name](part)
