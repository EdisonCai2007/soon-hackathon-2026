// The phone's own movement, from the browser's AR session: a position in metres from where it started and
// the way it is facing, once a frame. Android Chrome has this; iOS Safari has no WebXR at all.
import { Euler, Quaternion } from 'three'
import type { Pose } from './messages'

type XRLike = { isSessionSupported: (mode: string) => Promise<boolean>; requestSession: (mode: string, options?: object) => Promise<XRSessionLike> }
type XRSessionLike = {
  requestReferenceSpace: (type: string) => Promise<object>
  requestAnimationFrame: (callback: (time: number, frame: XRFrameLike) => void) => void
  end: () => Promise<void>
  addEventListener: (name: string, listener: () => void) => void
}
type XRFrameLike = { getViewerPose: (space: object) => { transform: { position: { x: number; y: number; z: number }; orientation: { x: number; y: number; z: number; w: number } } } | null | undefined }

export type ArHooks = { onPose: (pose: Pose) => void; onLost: () => void; onEnd: () => void }
export type ArSession = { stop: () => void }

const xr = (): XRLike | null => (navigator as { xr?: XRLike }).xr ?? null

/** Whether this browser can follow the phone through the room. */
export async function arSupported(): Promise<boolean> {
  const api = xr()
  if (!api) return false
  return api.isSessionSupported('immersive-ar').catch(() => false)
}

const facing = ({ x, y, z, w }: { x: number; y: number; z: number; w: number }): number =>
  new Euler().setFromQuaternion(new Quaternion(x, y, z, w), 'YXZ').y

/** Starts the session and reports where the phone is until it is stopped. */
export async function startAr(hooks: ArHooks): Promise<ArSession> {
  const api = xr()
  if (!api) throw new Error('This browser has no AR.')
  const session = await api.requestSession('immersive-ar', { requiredFeatures: ['local-floor'] })
  const space = await session.requestReferenceSpace('local-floor')
  let running = true
  session.addEventListener('end', () => { running = false; hooks.onEnd() })
  const frame = (_time: number, xrFrame: XRFrameLike) => {
    if (!running) return
    session.requestAnimationFrame(frame)
    const pose = xrFrame.getViewerPose(space)
    if (!pose) return hooks.onLost()
    const { position, orientation } = pose.transform
    hooks.onPose({ x: position.x, y: position.y, z: position.z, yaw: facing(orientation) })
  }
  session.requestAnimationFrame(frame)
  return { stop: () => { running = false; void session.end().catch(() => {}) } }
}
