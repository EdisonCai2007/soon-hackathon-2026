// Each voice placed by distance and direction. Web Audio does the placing; these are the numbers it is
// fed, kept pure so the curve is tested without a sound card.
import { Quaternion, Vector3 } from 'three'
import { figureSize, sceneExtent } from './placement'
import type { Scene } from './scene'

/** A voice across the room stays faint rather than silent: the viewer needs to hear which way to walk. */
const FLOOR = 0.08
const ROLLOFF = 1.6

export type Range = { ref: number; max: number }

/** Reference and maximum distance in scan units, so the curve follows the scan's own scale. */
export const rangeFor = (scene: Scene): Range => ({ ref: figureSize(scene).height * 2, max: sceneExtent(scene) })

/** An inverse law: full volume within the reference distance, fading to a floor by the far side. */
export function gainFor(distance: number, { ref, max }: Range): number {
  if (distance <= ref) return 1
  const faded = 1 / (1 + ROLLOFF * ((Math.min(distance, max) - ref) / ref))
  return Math.max(FLOOR, faded)
}

export type Listener = { position: [number, number, number]; forward: [number, number, number]; up: [number, number, number] }

const triple = ({ x, y, z }: Vector3): [number, number, number] => [x, y, z]

/** Where the ears are and which way they face, from the viewer's own camera. */
export function listenerFrom(position: Vector3, quaternion: Quaternion): Listener {
  return {
    position: triple(position),
    forward: triple(new Vector3(0, 0, -1).applyQuaternion(quaternion)),
    up: triple(new Vector3(0, 1, 0).applyQuaternion(quaternion)),
  }
}

/** Browsers refuse sound until the person acts, so the page says sound is off until the context runs. */
export type Unlock = 'blocked' | 'running'
export const soundOff = (state: Unlock): boolean => state === 'blocked'
