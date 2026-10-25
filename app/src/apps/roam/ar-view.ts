// The scan drawn inside an AR session. Three.js owns the session, so the camera belongs to the phone and the
// scan is moved to meet it: openspec roam-ar-view. Everything a GPU needs is here; the maths is in ar-place.ts.
import { Euler, Group, PerspectiveCamera, Quaternion, Scene as World, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { SparkRenderer, type SplatMesh } from '@sparkjsdev/spark'
import type { XRSessionLike } from './ar-session'
import { placingFor } from './ar-place'
import { PHONE_DETAIL, watchFrames } from './detail'
import type { Pose } from './messages'
import type { Anchor } from './placement'
import type { Scene } from './scene'
import { loadSplats } from './splat-scene'

export type ArViewHooks = {
  /** How much of the scan has arrived, while the session already tracks. */
  onProgress?: (fraction: number) => void
  /** Where the phone is each frame, taken from the camera three.js has already moved. */
  onPose?: (pose: Pose) => void
  /** The drawing could not go on: too slow to look at, or the 3D view was lost. */
  onGaveUp?: (why: 'rate' | 'lost') => void
}

export type ArView = {
  /** Hands the session to three.js and starts drawing. */
  take: (session: XRSessionLike) => Promise<void>
  /** Puts the scan where this anchor says, so that place sits where the person is standing. */
  lineUp: (anchor: Anchor, scene: Scene) => void
  show: (on: boolean) => void
  shown: () => boolean
  dispose: () => void
}

/** The session type three.js wants is the browser's own, which this app does not have types for: ar-session.ts
 *  describes the parts that are used instead, and this is where the two meet. */
type ThreeSession = Parameters<WebGLRenderer['xr']['setSession']>[0]

export function makeArView(splatUrl: string, hooks: ArViewHooks = {}, shown = true): ArView {
  const renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(Math.min(devicePixelRatio, PHONE_DETAIL.pixels))
  renderer.xr.enabled = true
  renderer.domElement.style.display = 'none'
  document.body.appendChild(renderer.domElement)

  const world = new World()
  const camera = new PerspectiveCamera(55, 1, 0.03, 100)
  const spark = new SparkRenderer({ renderer })
  spark.maxStdDev = PHONE_DETAIL.stdDev
  spark.enableLod = PHONE_DETAIL.lod
  spark.lodRenderScale = PHONE_DETAIL.renderScale
  spark.lodSplatCount = PHONE_DETAIL.splats
  spark.lodDirty = true
  world.add(spark)

  // The inner group puts the anchor at the origin; the outer one turns and scales the scan around it.
  const placed = new Group()
  const pivot = new Group()
  placed.add(pivot)
  placed.visible = shown
  world.add(placed)

  let splats: SplatMesh | undefined
  let stopped = false
  const gaveUp = (why: 'rate' | 'lost') => {
    placed.visible = false
    hooks.onGaveUp?.(why)
  }
  // Both of these are detached by dispose, so neither needs to ask whether the view is still here.
  const lost = (event: Event) => {
    event.preventDefault()
    gaveUp('lost')
  }
  renderer.domElement.addEventListener('webglcontextlost', lost)

  const where = new Vector3()
  const turn = new Quaternion()
  const facing = new Euler(0, 0, 0, 'YXZ')
  const watch = watchFrames(() => gaveUp('rate'))

  const load = async (scene: Scene) => {
    const mesh = loadSplats(scene, {
      url: splatUrl,
      lod: PHONE_DETAIL.lod,
      onProgress: ({ loaded, total }) => {
        if (total && !stopped) hooks.onProgress?.(loaded / total)
      },
    })
    pivot.add(mesh)
    await mesh.initialized
    if (stopped) return mesh.dispose()
    splats = mesh
  }

  return {
    async take(session) {
      renderer.xr.setReferenceSpaceType('local-floor')
      await renderer.xr.setSession(session as unknown as ThreeSession)
      renderer.domElement.style.display = ''
      renderer.setAnimationLoop((time) => {
        watch.frame(time)
        const eye = renderer.xr.getCamera()
        eye.getWorldPosition(where)
        eye.getWorldQuaternion(turn)
        hooks.onPose?.({ x: where.x, y: where.y, z: where.z, yaw: facing.setFromQuaternion(turn, 'YXZ').y })
        renderer.render(world, camera)
      })
    },

    lineUp(anchor, scene) {
      const { inner, yaw, scale } = placingFor(anchor, scene)
      pivot.position.fromArray(inner)
      placed.rotation.set(0, yaw, 0)
      placed.scale.setScalar(scale)
      if (!splats) void load(scene).catch(() => { if (!stopped) gaveUp('lost') })
    },

    show(on) { placed.visible = on },
    shown: () => placed.visible,

    dispose() {
      stopped = true
      renderer.setAnimationLoop(null)
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      splats?.dispose()
      spark.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
