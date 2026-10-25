// A note's own voice, heard from the spot it was left at: the clip plays through a panner placed there, so walking
// while it plays changes what reaches the ears. audio.ts owns the curve; this holds what the sound card needs.
import type { Vector3 } from 'three'
import { gainFor, rangeFor } from './audio'
import type { Pose } from './messages'
import type { Scene } from './scene'

export type NoteVoice = { hear: (ears: Vector3) => void; stop: () => void }

/** Fetches the clip and starts it where it was left, or null when there is nothing to play it with. */
export async function playNote(context: AudioContext, url: string, spot: Pose, scene: Scene,
  onEnd: () => void): Promise<NoteVoice | null> {
  let clip: AudioBuffer
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    clip = await context.decodeAudioData(await response.arrayBuffer())
  } catch { return null }

  const range = rangeFor(scene)
  const source = context.createBufferSource()
  source.buffer = clip
  const gain = context.createGain()
  const panner = context.createPanner()
  panner.panningModel = 'HRTF'
  // Loudness is ours, from the same curve a voice in the room follows: the panner only places the clip.
  panner.distanceModel = 'linear'
  panner.rolloffFactor = 0
  for (const [param, value] of [[panner.positionX, spot.x], [panner.positionY, spot.y], [panner.positionZ, spot.z]] as
    [AudioParam | undefined, number][]) param?.setValueAtTime(value, context.currentTime)
  source.connect(gain).connect(panner).connect(context.destination)
  source.onended = onEnd
  source.start()

  let stopped = false
  return {
    hear(ears) {
      if (stopped) return
      const distance = Math.hypot(ears.x - spot.x, ears.y - spot.y, ears.z - spot.z)
      gain.gain.setTargetAtTime(gainFor(distance, range), context.currentTime, 0.08)
    },
    stop() {
      if (stopped) return
      stopped = true
      source.onended = null
      try { source.stop() }
      catch { /* a clip that already finished needs no stopping */ }
      gain.disconnect()
      panner.disconnect()
    },
  }
}
