import { useEffect, useRef, useState } from 'react'
import { PerspectiveCamera, Scene as ThreeScene, SRGBColorSpace, Vector3, WebGLRenderer, Matrix4 } from 'three'
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { PovControls } from './pov-controls'
import { overviewPose, parseScene, presetPose, topPose, type Pose, type Scene } from './scene'

type Status = { kind: 'loading'; percent: number } | { kind: 'ready' } | { kind: 'error'; message: string }
type Api = { go: (pose: Pose) => void; scene: Scene }

/** The scan opens in a canvas that fills its container; the viewer walks it with POV controls. */
export function RoomViewer({ base }: { base: string }) {
  const container = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'loading', percent: 0 })
  const [scene, setScene] = useState<Scene | null>(null)

  useEffect(() => {
    const host = container.current as HTMLDivElement
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    } catch {
      const message = 'This browser can’t show 3D. Try a recent Chrome, Safari or Firefox.'
      void Promise.resolve().then(() => setStatus({ kind: 'error', message }))
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.setClearColor('#10151c')
    host.appendChild(renderer.domElement)
    const three = new ThreeScene()
    const camera = new PerspectiveCamera(55, 1, 0.03, 100)
    const controls = new PovControls(camera, renderer.domElement)
    three.add(new SparkRenderer({ renderer }))
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    let live = true

    const go = (pose: Pose) => {
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
      camera.up.set(...pose.up)
      camera.position.set(...pose.eye)
      camera.lookAt(new Vector3(...pose.target))
      controls.sync()
      renderer.domElement.focus({ preventScroll: true })
    }

    const open = async () => {
      const response = await fetch(`${base}/scene.json`)
      if (!response.ok) throw new Error('The scan’s description could not be loaded.')
      const meta = parseScene(await response.json())
      const m = meta.rotation
      const splats = new SplatMesh({
        url: `${base}/room.spz`,
        onProgress: (e: ProgressEvent) => {
          if (live && e.total) setStatus({ kind: 'loading', percent: Math.round((e.loaded / e.total) * 100) })
        },
      })
      splats.quaternion.setFromRotationMatrix(
        new Matrix4().set(m[0][0], m[0][1], m[0][2], 0, m[1][0], m[1][1], m[1][2], 0, m[2][0], m[2][1], m[2][2], 0, 0, 0, 0, 1),
      )
      splats.position.set(...meta.translation)
      three.add(splats)
      await splats.initialized
      if (!live) return
      api.current = { go, scene: meta }
      go(presetPose(meta.cameras[0]))
      setScene(meta)
      setStatus({ kind: 'ready' })
    }
    open().catch((error: Error) => live && setStatus({ kind: 'error', message: `Couldn’t open the room. ${error.message}` }))

    let previous: number | null = null
    renderer.setAnimationLoop((time: number) => {
      controls.update(previous === null ? 0 : (time - previous) / 1000)
      previous = time
      renderer.render(three, camera)
    })
    return () => {
      live = false
      api.current = null
      renderer.setAnimationLoop(null)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [base])

  const move = (pose: (scene: Scene) => Pose) => () => api.current && api.current.go(pose(api.current.scene))

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={!scene} onClick={move((s) => presetPose(s.cameras[0]))}>Room view</Button>
        <Button variant="outline" disabled={!scene} onClick={move(overviewPose)}>Overview</Button>
        <Button variant="outline" disabled={!scene} onClick={move(topPose)}>Top view</Button>
        <NativeSelect
          aria-label="Source video camera"
          disabled={!scene}
          defaultValue=""
          onChange={(e) => e.target.value !== '' && move((s) => presetPose(s.cameras[Number(e.target.value)]))()}
        >
          <option value="">Camera…</option>
          {scene?.cameras.map((camera, i) => <option key={camera.name} value={i}>{camera.name}</option>)}
        </NativeSelect>
        <span className="ml-auto text-sm text-muted-foreground">
          {scene ? `${scene.views} video views · ${scene.splats.toLocaleString()} splats` : ''}
        </span>
      </div>
      <div className="relative h-[70vh] min-h-96 overflow-hidden rounded-lg border bg-black">
        <div ref={container} className="absolute inset-0" aria-label="Interactive 3D scan of a room" />
        {status.kind !== 'ready' && (
          <p className="absolute left-1/2 top-1/2 max-w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background px-4 py-3 text-center text-sm" role="status">
            {status.kind === 'loading' ? `Loading the room… ${status.percent}%` : status.message}
          </p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Click the scene · W/A/S/D move · Q/E down/up · drag to look · Shift faster · scroll forward/back
      </p>
    </div>
  )
}
