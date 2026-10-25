import { useEffect, useRef } from 'react'
import { PerspectiveCamera, Scene as World, SRGBColorSpace, Vector2, WebGLRenderer } from 'three'
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'
import { makeCastStage, type Cast, type CastStage } from './casting-stage'
import { PovControls } from './pov-controls'
import { applyPose, cameraPose, displayQuaternion, loadScene, type Pose } from './scene'
import { dueToSend } from './pose-feed'
import { makeStage, pointerAt, stanceOf, type Picked, type Stage } from './stage'
import type { Peer } from './presence'
import type { Pose as Stance } from './messages'
import type { Note } from './notes'
import type { NoteVoice } from './note-sound'
import type { ViewerEvent } from './viewer-state'

type Viewer = { camera: PerspectiveCamera; controls: PovControls; stage: Stage | null; spells: CastStage | null }
type Props = {
  sceneUrl: string
  splatUrl: string
  pose: Pose | null
  onEvent: (event: ViewerEvent) => void
  /** Everyone else in the room, drawn as figures. Empty when walking the scan alone. */
  peers?: readonly Peer[]
  /** What has been left in this place, drawn as markers where it was left. */
  notes?: readonly Note[]
  /** The sound card to place their voices on, once the browser has let sound start. */
  audio?: AudioContext | null
  /** A press on somebody or on something left here, with the camera pose to come back to. */
  onPick?: (picked: Picked, pose: Pose) => void
  /** A note's clip, playing: it is told where the ears are each frame, so walking changes what is heard. */
  voice?: NoteVoice | null
  /** Where this page's own person stands, ten times a second, for the others to draw. */
  onStance?: (stance: Stance) => void
  /** The techniques running right now, drawn where whoever cast them stands. */
  casts?: readonly Cast[]
}

// Three.js r180 draws with WebGL 2 alone, so a browser without it gets a plain message, not a blank box.
const hasWebGL = () => document.createElement('canvas').getContext('webgl2') !== null

/** Edison's room viewer inside the page: the renderer, Spark and the scan live for as long as this part is shown,
 *  sized to its box, and each new `pose` moves the camera. */
export function RoomViewer({ sceneUrl, splatUrl, pose, onEvent, peers = [], notes = [], audio = null, onPick, voice = null,
  onStance, casts = [] }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const wash = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer | null>(null)
  // The room changes every tenth of a second; reading it through a ref keeps the renderer from being rebuilt.
  const latest = useRef({ peers, notes, onPick, voice, onStance, casts })
  useEffect(() => { latest.current = { peers, notes, onPick, voice, onStance, casts } })

  useEffect(() => {
    if (!hasWebGL()) {
      onEvent({ type: 'no-webgl' })
      return
    }
    const box = host.current!
    const washing = wash.current!
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
    // A press on a person watches them, one on a marker opens its note; a press on the room does nothing but take
    // the keyboard, as before.
    const pointer = new Vector2()
    const picked = (event: PointerEvent) => {
      const stage = viewer.current?.stage
      const pick = latest.current.onPick
      if (!stage || !pick) return
      const found = stage.pick(pointerAt(event, renderer.domElement.getBoundingClientRect(), pointer), camera)
      if (found) pick(found, cameraPose(camera))
    }
    renderer.domElement.addEventListener('click', picked)
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
      const stage = makeStage(world, scene, audio)
      const spells = makeCastStage(world, scene)
      stage.sync(latest.current.peers)
      stage.show(latest.current.notes)
      let previous: number | null = null
      let told: number | null = null
      renderer.setAnimationLoop((time) => {
        controls.update(previous === null ? 0 : (time - previous) / 1000)
        previous = time
        stage.update(camera, time)
        // A technique is drawn over the room's people, and its brightest moment washes the whole view.
        washing.style.opacity = String(spells.draw(latest.current.casts, time))
        latest.current.voice?.hear(camera.position)
        // The others are told where this person stands on the same gate their figures are drawn on.
        if (latest.current.onStance && dueToSend(told, time)) {
          told = time
          latest.current.onStance(stanceOf(camera))
        }
        renderer.render(world, camera)
      })
      viewer.current = { camera, controls, stage, spells }
      onEvent({ type: 'ready', scene })
    })().catch((error: unknown) => {
      console.error(error)
      fail('The room didn’t load.')
    })

    return () => {
      stopped = true
      viewer.current?.stage?.dispose()
      viewer.current?.spells?.dispose()
      viewer.current = null
      observer.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      renderer.domElement.removeEventListener('click', picked)
      renderer.setAnimationLoop(null)
      controls.dispose()
      splats?.dispose()
      spark.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [sceneUrl, splatUrl, onEvent, audio])

  useEffect(() => {
    const current = viewer.current
    if (!pose || !current) return
    applyPose(current.camera, pose)
    current.controls.sync()
  }, [pose])

  // Who is in the room changes as people come and go; the figures follow.
  useEffect(() => { viewer.current?.stage?.sync(peers) }, [peers])

  // What is left here changes when somebody leaves or takes back a note; the markers follow.
  useEffect(() => { viewer.current?.stage?.show(notes) }, [notes])

  return <div ref={host} className="absolute inset-0">
    <div ref={wash} className="pointer-events-none absolute inset-0 z-10 bg-white opacity-0" aria-hidden="true" />
  </div>
}
