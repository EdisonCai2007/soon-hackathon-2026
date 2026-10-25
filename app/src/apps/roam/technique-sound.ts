// A technique's sound, made on the spot and placed where its caster stands: no audio file ships, and
// nothing is taken from the anime. audio.ts owns the loudness curve; this holds what the sound card needs.
import { gainFor, rangeFor } from './audio'
import type { Pose } from './messages'
import type { Scene } from './scene'
import { TECHNIQUES, type TechniqueName } from './techniques'

export type TechniqueSound = { stop: () => void }

/** Each technique's one gesture: where its note starts and ends, and whether a rush of noise runs under it. */
const SHAPES: Record<TechniqueName, { from: number; to: number; rush: boolean }> = {
  domain: { from: 64, to: 28, rush: true },
  purple: { from: 150, to: 820, rush: true },
  blue: { from: 440, to: 90, rush: false },
}

const PEAK = 0.5

function rushing(context: AudioContext, seconds: number): AudioBufferSourceNode {
  const samples = Math.max(1, Math.round(context.sampleRate * seconds))
  const buffer = context.createBuffer(1, samples, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let sample = 0; sample < samples; sample += 1) channel[sample] = Math.random() * 2 - 1
  const source = context.createBufferSource()
  source.buffer = buffer
  return source
}

/** Starts a technique's sound where its caster stands, turned down by how far away the listener is. */
export function playTechnique(context: AudioContext, name: TechniqueName, where: Pose, distance: number,
  scene: Scene): TechniqueSound {
  const { from, to, rush } = SHAPES[name]
  const seconds = TECHNIQUES[name].life / 1000
  const now = context.currentTime
  const over = now + seconds

  const tone = context.createOscillator()
  tone.type = 'sawtooth'
  tone.frequency.setValueAtTime(from, now)
  tone.frequency.linearRampToValueAtTime(to, over)

  const gain = context.createGain()
  const loudness = PEAK * gainFor(distance, rangeFor(scene))
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(loudness, now + seconds * 0.15)
  gain.gain.linearRampToValueAtTime(0, over)

  const panner = context.createPanner()
  panner.panningModel = 'HRTF'
  // Loudness is ours, from the room's own curve: the panner only places the sound.
  panner.distanceModel = 'linear'
  panner.rolloffFactor = 0
  for (const [param, value] of [[panner.positionX, where.x], [panner.positionY, where.y], [panner.positionZ, where.z]] as
    [AudioParam | undefined, number][]) param?.setValueAtTime(value, now)

  tone.connect(gain).connect(panner).connect(context.destination)
  tone.start(now)
  tone.stop(over)
  const noise = rush ? rushing(context, seconds) : null
  if (noise) {
    noise.connect(gain)
    noise.start(now)
  }

  let stopped = false
  return {
    stop() {
      if (stopped) return
      stopped = true
      try { tone.stop() }
      catch { /* a sound that already ran out needs no stopping */ }
      gain.disconnect()
      panner.disconnect()
    },
  }
}
