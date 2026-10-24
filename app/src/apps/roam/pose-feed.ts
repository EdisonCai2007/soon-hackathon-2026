// Positions go up on a gate and are smoothed on the way in, so a figure glides between the ten
// positions a second it reports instead of stepping between them.
import type { Pose } from './messages'

export const SEND_INTERVAL_MS = 100
const TWO_PI = Math.PI * 2

/** Where a person's figure stands now: between the last two positions they reported. */
export type Motion = { from: Pose; to: Pose; at: number }

export const dueToSend = (last: number | null, now: number): boolean => last === null || now - last >= SEND_INTERVAL_MS

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

/** The shorter way round the circle, so a figure turning past half a turn does not spin the long way. */
export function lerpYaw(from: number, to: number, t: number): number {
  const difference = ((to - from + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI
  return from + difference * t
}

export const lerpPose = (from: Pose, to: Pose, t: number): Pose => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
  z: from.z + (to.z - from.z) * t,
  yaw: lerpYaw(from.yaw, to.yaw, t),
})

/** A new position becomes the end of the glide, and wherever the figure had got to becomes its start. */
export const nextMotion = (motion: Motion | null, pose: Pose, at: number): Motion =>
  ({ from: motion ? poseAt(motion, at) : pose, to: pose, at })

export const poseAt = (motion: Motion, now: number): Pose =>
  lerpPose(motion.from, motion.to, clamp01((now - motion.at) / SEND_INTERVAL_MS))
