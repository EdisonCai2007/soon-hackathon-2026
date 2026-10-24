import { useEffect, useRef } from 'react'
import { PerspectiveCamera, Scene as World, SRGBColorSpace, WebGLRenderer } from 'three'
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'
import { PovControls } from './pov-controls'
import { applyPose, displayQuaternion, parseScene, type Pose } from './scene'
import type { ViewerEvent } from './viewer-state'

type Viewer = { camera: PerspectiveCamera; controls: PovControls }
type Props = { sceneUrl: string; splatUrl: string; pose: Pose | null; onEvent: (event: ViewerEvent) => void }

// Three.js r180 draws with WebGL 2 alone, so a browser without it gets a plain message, not a blank box.
const hasWebGL = () => document.createElement('canvas').getContext('webgl2') !== null

async function loadScene(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseScene(await response.json())
}

/** Edison's room viewer inside the page: the renderer, Spark and the scan live for as long as this part is shown,
 *  sized to its box, and each new `pose` moves the camera. */
export function RoomViewer({ sceneUrl, splatUrl, pose, onEvent }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer | null>(null)

  useEffect(() => {
    if (!hasWebGL()) {
      onEvent({ type: 'no-webgl' })
      return
    }
    const box = host.current!
    let stopped = false
    const fail = (message: string) => {
      if (!stopped) onEvent({ type: 'error', message })
    }
    const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    renderer.setClearColor('#10151c')
    renderer.outputColorSpace = SRGBColorSpace
    box.appendChild(renderer.domElement)
    const world = new World()
    const camera = new PerspectiveCamera(55, 1, 0.03, 100)
    const controls = new PovControls(camera, renderer.domElement)
    const spark = new SparkRenderer({ renderer })
    world.add(spark)
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = box
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(box)
    const lost = (event: Event) => {
      event.preventDefault()
      fail('The 3D view stopped.')
    }
    renderer.domElement.addEventListener('webglcontextlost', lost)
    let splats: SplatMesh | undefined

    void (async () => {
      const scene = await loadScene(sceneUrl)
      if (stopped) return
      splats = new SplatMesh({
        url: splatUrl,
        onProgress: ({ loaded, total }) => {
          if (total && !stopped) onEvent({ type: 'progress', progress: loaded / total })
        },
      })
      splats.quaternion.copy(displayQuaternion(scene))
      splats.position.fromArray(scene.translation)
      world.add(splats)
      await splats.initialized
      if (stopped) return
      viewer.current = { camera, controls }
      let previous: number | null = null
      renderer.setAnimationLoop((time) => {
        controls.update(previous === null ? 0 : (time - previous) / 1000)
        previous = time
        renderer.render(world, camera)
      })
      onEvent({ type: 'ready', scene })
    })().catch((error: unknown) => {
      console.error(error)
      fail('The room didn’t load.')
    })

    return () => {
      stopped = true
      viewer.current = null
      observer.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      renderer.setAnimationLoop(null)
      controls.dispose()
      splats?.dispose()
      spark.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [sceneUrl, splatUrl, onEvent])

  useEffect(() => {
    const current = viewer.current
    if (!pose || !current) return
    applyPose(current.camera, pose)
    current.controls.sync()
  }, [pose])

  return <div ref={host} className="absolute inset-0" />
}
