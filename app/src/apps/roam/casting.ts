// Turning hand reading on and off: the glue between the reader, the sign rules and the room. What it
// judges lives in signs.ts; this starts and stops things in the right order and holds this page's own cast.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cast } from './casting-stage'
import { readHands, type HandReader, type MakeLandmarker } from './hands'
import type { Pose } from './messages'
import { poseAt } from './pose-feed'
import type { Peer } from './presence'
import type { Scene } from './scene'
import { freshWatch, watchHands, type Hand, type Watch } from './signs'
import { playTechnique, type TechniqueSound } from './technique-sound'
import { TECHNIQUES, type TechniqueName } from './techniques'

type Step = 'off' | 'starting' | 'on' | 'cannot'

export type Casting = {
  step: Step
  /** What the reader can see this moment, named for the bar, or null. */
  seen: string | null
  /** This page's own cast: the room sends a cast to everyone but its caster. */
  mine: { technique: TechniqueName; at: number } | null
  turn: () => void
}

/** Hand reading for one live room, off until it is asked for. */
export function useCasting(stream: MediaStream | null, cast: (technique: TechniqueName) => void,
  make?: MakeLandmarker): Casting {
  const [step, setStep] = useState<Step>('off')
  const [seen, setSeen] = useState<TechniqueName | null>(null)
  const [mine, setMine] = useState<{ technique: TechniqueName; at: number } | null>(null)
  const reader = useRef<HandReader | null>(null)
  const watch = useRef<Watch>(freshWatch())

  const stop = useCallback(() => {
    reader.current?.stop()
    reader.current = null
    watch.current = freshWatch()
    setSeen(null)
  }, [])

  // A page that leaves the room, or loses its camera, stops reading with it.
  useEffect(() => () => stop(), [stop])

  const frame = useCallback((hands: readonly Hand[], at: number) => {
    const read = watchHands(watch.current, hands, at)
    watch.current = read.state
    setSeen(read.state.seen)
    if (read.fired === null) return
    setMine({ technique: read.fired, at })
    cast(read.fired)
  }, [cast])

  const turn = useCallback(() => {
    if (step !== 'off') {
      stop()
      setStep('off')
      return
    }
    if (!stream) {
      setStep('cannot')
      return
    }
    setStep('starting')
    readHands(stream, frame, make)
      .then((started) => {
        reader.current = started
        setStep('on')
      })
      .catch(() => setStep('cannot'))
  }, [frame, make, step, stop, stream])

  return { step, seen: seen === null ? null : TECHNIQUES[seen].title, mine, turn }
}

const keyOf = (cast: Cast) => `${cast.id}:${cast.at}`

/** Every cast to draw: each other person's, placed where they were walking, and this page's own. */
export function castsNow(peers: readonly Peer[], mine: Casting['mine'], here: Pose | null, at: number): Cast[] {
  const theirs = peers.flatMap((peer) => {
    const where = peer.cast && peer.motion ? poseAt(peer.motion, at) : null
    return peer.cast && where ? [{ id: peer.member.id, technique: peer.cast.technique, at: peer.cast.at, where }] : []
  })
  return mine && here ? [...theirs, { id: 'me', technique: mine.technique, at: mine.at, where: here }] : theirs
}

/** The casts to draw, rebuilt when somebody starts or stops casting rather than every time they move. */
export function useCasts(peers: readonly Peer[] = [], mine: Casting['mine'] = null, here: Pose | null = null): readonly Cast[] {
  const [casts, setCasts] = useState<readonly Cast[]>([])
  const latest = useRef({ peers, mine, here })
  useEffect(() => { latest.current = { peers, mine, here } })

  const theirs = peers.map((peer) => `${peer.member.id}:${peer.cast?.at ?? 0}`).join(',')
  const own = mine === null ? '' : `${mine.technique}:${mine.at}`
  useEffect(() => {
    const now = latest.current
    setCasts(castsNow(now.peers, now.mine, now.here, performance.now()))
  }, [own, theirs])

  return casts
}

/** Each cast's sound, started once where it was cast and stopped when the cast is over. */
export function useTechniqueSounds(context: AudioContext | null | undefined, casts: readonly Cast[], scene: Scene | null,
  ears: Pose | null): void {
  const playing = useRef(new Map<string, TechniqueSound>())

  useEffect(() => {
    if (!context || !scene) return
    const here = new Set(casts.map(keyOf))
    for (const [key, sound] of [...playing.current]) {
      if (here.has(key)) continue
      sound.stop()
      playing.current.delete(key)
    }
    for (const cast of casts) {
      if (playing.current.has(keyOf(cast))) continue
      const away = ears ? Math.hypot(ears.x - cast.where.x, ears.y - cast.where.y, ears.z - cast.where.z) : 0
      playing.current.set(keyOf(cast), playTechnique(context, cast.technique, cast.where, away, scene))
    }
  }, [casts, context, ears, scene])

  useEffect(() => () => {
    for (const sound of playing.current.values()) sound.stop()
    playing.current.clear()
  }, [])
}
