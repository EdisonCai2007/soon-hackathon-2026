// The phone's own movement, from the browser's AR session: a position in metres from where it started and
// the way it is facing, once a frame. Android Chrome has this; iOS Safari has no WebXR at all.
import { Euler, Quaternion } from 'three'
import type { Pose } from './messages'

type XRLike = { isSessionSupported: (mode: string) => Promise<boolean>; requestSession: (mode: string, options?: object) => Promise<XRSessionLike> }
export type XRSessionLike = {
  requestReferenceSpace: (type: string) => Promise<object>
  requestAnimationFrame: (callback: (time: number, frame: XRFrameLike) => void) => void
  updateRenderState?: (state: object) => void | Promise<void>
  end: () => Promise<void>
  addEventListener: (name: string, listener: () => void) => void
  domOverlayState?: { type?: string } | null
}
type XRFrameLike = { getViewerPose: (space: object) => { transform: { position: { x: number; y: number; z: number }; orientation: { x: number; y: number; z: number; w: number } } } | null | undefined }
type GLLike = { makeXRCompatible?: () => Promise<void> }

export type ArHooks = { onPose: (pose: Pose) => void; onLost: () => void; onEnd: () => void }
export type ArSession = { stop: () => void; overlaid: boolean }

/** Something that draws into the session. Given one, `startAr` hands the session over rather than attaching a
 *  layer nothing draws into, and the poses come from its frames: two loops on one session answers nothing. */
export type ArDrawing = { take: (session: XRSessionLike) => Promise<void> }

const xr = (): XRLike | null => (navigator as { xr?: XRLike }).xr ?? null

/** Whether this browser can follow the phone through the room. */
export async function arSupported(): Promise<boolean> {
  const api = xr()
  if (!api) return false
  return api.isSessionSupported('immersive-ar').catch(() => false)
}

const facing = ({ x, y, z, w }: { x: number; y: number; z: number; w: number }): number =>
  new Euler().setFromQuaternion(new Quaternion(x, y, z, w), 'YXZ').y

/** A session with no layer to draw into answers every frame with no pose at all, so the phone never says where it
 *  is. Nothing is drawn into it: the camera's own picture is the view. */
async function attachLayer(session: XRSessionLike): Promise<void> {
  const layer = (globalThis as { XRWebGLLayer?: new (session: XRSessionLike, gl: unknown) => object }).XRWebGLLayer
  if (!layer || !session.updateRenderState) return
  const gl = document.createElement('canvas').getContext('webgl', { xrCompatible: true, alpha: true }) as GLLike | null
  if (!gl) return
  await gl.makeXRCompatible?.()
  await session.updateRenderState({ baseLayer: new layer(session, gl) })
}

/** Starts the session and reports where the phone is until it is stopped. An `overlay` keeps the page's own
 *  controls over the camera view; a `drawing` takes the session over and its frames carry the poses. */
export async function startAr(hooks: ArHooks, overlay?: HTMLElement | null, drawing?: ArDrawing): Promise<ArSession> {
  const api = xr()
  if (!api) throw new Error('This browser has no AR.')
  const session = await api.requestSession('immersive-ar', {
    requiredFeatures: ['local-floor'],
    ...(overlay ? { optionalFeatures: ['dom-overlay'], domOverlay: { root: overlay } } : {}),
  })
  let running = true
  session.addEventListener('end', () => { running = false; hooks.onEnd() })
  const stop = () => { running = false; void session.end().catch(() => {}) }
  if (drawing) {
    await drawing.take(session)
    return { stop, overlaid: !!session.domOverlayState }
  }
  await attachLayer(session)
  const space = await session.requestReferenceSpace('local-floor')
  const frame = (_time: number, xrFrame: XRFrameLike) => {
    if (!running) return
    session.requestAnimationFrame(frame)
    const pose = xrFrame.getViewerPose(space)
    if (!pose) return hooks.onLost()
    const { position, orientation } = pose.transform
    hooks.onPose({ x: position.x, y: position.y, z: position.z, yaw: facing(orientation) })
  }
  session.requestAnimationFrame(frame)
  return { stop, overlaid: !!session.domOverlayState }
}
